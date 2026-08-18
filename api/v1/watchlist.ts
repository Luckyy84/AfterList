import { adminClient, authenticateIntegration, hashToken, json } from '../_lib/afterlistApi.js'

type IncomingItem = Record<string, unknown>

type TmdbSeason = {
  episode_count?: number
  season_number?: number
}

type TmdbTvDetails = {
  number_of_episodes?: number
  seasons?: TmdbSeason[]
}

const LEGACY_WATCHLIST_COLUMNS = [
  'id', 'user_id', 'external_id', 'source', 'title', 'type', 'status', 'poster', 'backdrop',
  'progress', 'rating', 'description', 'year', 'current_episode', 'total_episodes',
  'runtime_minutes', 'personal_rating', 'is_favorite', 'created_at', 'updated_at',
].join(',')

function text(value: unknown, max: number) {
  return typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null
}

function integer(value: unknown, minimum: number, maximum: number) {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum ? Number(value) : null
}

function date(value: unknown) {
  const result = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
  return result && !Number.isNaN(new Date(`${result}T00:00:00.000Z`).getTime()) ? result : null
}

export function cumulativeEpisode(seasons: TmdbSeason[], seasonNumber: number, episodeNumber: number) {
  const currentSeason = seasons.find((season) => season.season_number === seasonNumber)
  if (!currentSeason?.episode_count || episodeNumber > currentSeason.episode_count) return null
  return seasons
    .filter((season) => Number(season.season_number) > 0 && Number(season.season_number) < seasonNumber)
    .reduce((total, season) => total + (season.episode_count ?? 0), episodeNumber)
}

function normalizeItem(input: IncomingItem) {
  const source = input.source === 'tmdb' ? input.source : null
  const externalId = text(input.externalId, 80)
  const title = text(input.title, 300)
  const type = ['Anime', 'Movie', 'TV Series'].includes(String(input.type)) ? String(input.type) : null
  const requestedStatus = ['Planned', 'Watching', 'Watched', 'Dropped'].includes(String(input.status)) ? String(input.status) : null
  const updatedAt = text(input.updatedAt, 40)
  const updatedDate = updatedAt ? new Date(updatedAt) : null
  const currentEpisode = input.currentEpisode === undefined ? 0 : integer(input.currentEpisode, 0, 1_000_000)
  const totalEpisodes = input.totalEpisodes == null ? null : integer(input.totalEpisodes, 1, 1_000_000)
  const seasonNumber = input.seasonNumber == null ? null : integer(input.seasonNumber, 1, 10_000)
  const episodeNumber = input.episodeNumber == null ? null : integer(input.episodeNumber, 1, 1_000_000)

  if (!source || !externalId || !/^(movie|tv):[1-9]\d*$/.test(externalId) || !title || !type || !requestedStatus
    || !updatedDate || Number.isNaN(updatedDate.getTime()) || currentEpisode === null
    || (totalEpisodes !== null && currentEpisode > totalEpisodes)
    || ((seasonNumber === null) !== (episodeNumber === null))) return null
  if ((externalId.startsWith('movie:')) !== (type === 'Movie')) return null

  const status = totalEpisodes && currentEpisode >= totalEpisodes ? 'Watched' : requestedStatus
  const trackingDate = updatedDate.toISOString().slice(0, 10)
  const isRewatching = typeof input.isRewatching === 'boolean' ? input.isRewatching : null

  return {
    source,
    external_id: externalId,
    title,
    type,
    status,
    poster: text(input.poster, 2000) ?? '',
    backdrop: text(input.backdrop, 2000) ?? '',
    progress: text(input.progress, 200) ?? '',
    rating: text(input.rating, 30) ?? 'N/A',
    description: text(input.description, 5000) ?? '',
    year: text(input.year, 10),
    current_episode: currentEpisode,
    total_episodes: totalEpisodes,
    runtime_minutes: input.runtimeMinutes == null ? null : integer(input.runtimeMinutes, 1, 100_000),
    personal_rating: input.personalRating == null ? null : integer(input.personalRating, 1, 10),
    is_favorite: input.isFavorite === true,
    is_rewatching: isRewatching,
    rewatch_count: input.rewatchCount == null ? null : integer(input.rewatchCount, 0, 1_000_000),
    started_on: date(input.startedOn) ?? (status === 'Watching' ? trackingDate : null),
    completed_on: date(input.completedOn) ?? (status === 'Watched' ? trackingDate : null),
    updated_at: updatedDate.toISOString(),
    season_number: seasonNumber,
    episode_number: episodeNumber,
  }
}

async function enrichEpisodeProgress(item: NonNullable<ReturnType<typeof normalizeItem>>) {
  if (item.season_number === null || item.episode_number === null || !item.external_id.startsWith('tv:')) return item
  const apiKey = process.env.TMDB_API_KEY?.trim()
  const accessToken = process.env.TMDB_ACCESS_TOKEN?.trim()
  if (!apiKey && !accessToken) return item

  const params = new URLSearchParams({ language: 'en-US' })
  if (!accessToken && apiKey) params.set('api_key', apiKey)
  const response = await fetch(`https://api.themoviedb.org/3/tv/${item.external_id.slice(3)}?${params}`, {
    headers: { accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  })
  if (!response.ok) return item

  const details = await response.json() as TmdbTvDetails
  const currentEpisode = cumulativeEpisode(details.seasons ?? [], item.season_number, item.episode_number)
  if (currentEpisode === null) return item
  const totalEpisodes = integer(details.number_of_episodes, 1, 1_000_000) ?? item.total_episodes
  return {
    ...item,
    current_episode: currentEpisode,
    total_episodes: totalEpisodes,
    status: totalEpisodes && currentEpisode >= totalEpisodes ? 'Watched' : 'Watching',
    progress: totalEpisodes ? `${currentEpisode}/${totalEpisodes} episodes` : `${currentEpisode} episodes`,
  }
}

export async function GET(request: Request) {
  const integration = await authenticateIntegration(request, 'watchlist:read')
  if (!integration) return json({ error: 'Unauthorized.' }, 401)
  const since = new URL(request.url).searchParams.get('updatedAfter')
  let query = adminClient().from('watchlist_items').select(LEGACY_WATCHLIST_COLUMNS)
    .eq('user_id', integration.user_id)
    .is('merged_into_id', null)
    .order('updated_at')
  if (since && !Number.isNaN(new Date(since).getTime())) query = query.gt('updated_at', new Date(since).toISOString())
  const { data, error } = await query
  return error ? json({ error: 'Could not load watchlist.' }, 500) : json({ items: data })
}

export async function PUT(request: Request) {
  const integration = await authenticateIntegration(request, 'watchlist:write')
  if (!integration) return json({ error: 'Unauthorized.' }, 401)
  const body = await request.json().catch(() => null) as IncomingItem | null
  const item = body ? normalizeItem(body) : null
  if (!item) return json({ error: 'Invalid watchlist item.' }, 400)
  const enrichedItem = await enrichEpisodeProgress(item)
  const { data, error } = await adminClient().rpc('upsert_watchlist_from_api', {
    p_token_hash: hashToken(integration.rawToken),
    p_item: enrichedItem,
  })
  return error ? json({ error: 'Could not update watchlist.' }, 500) : json(data)
}
