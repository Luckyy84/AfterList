import { adminClient, authenticateIntegration, hashToken, json } from '../_lib/afterlistApi.js'

type IncomingItem = Record<string, unknown>

function text(value: unknown, max: number) {
  return typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null
}

function integer(value: unknown, minimum: number, maximum: number) {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum ? Number(value) : null
}

function normalizeItem(input: IncomingItem) {
  const source = input.source === 'tmdb' ? input.source : null
  const externalId = text(input.externalId, 80)
  const title = text(input.title, 300)
  const type = ['Anime', 'Movie', 'TV Series'].includes(String(input.type)) ? String(input.type) : null
  const status = ['Planned', 'Watching', 'Watched', 'Dropped'].includes(String(input.status)) ? String(input.status) : null
  const updatedAt = text(input.updatedAt, 40)
  const updatedDate = updatedAt ? new Date(updatedAt) : null
  const currentEpisode = input.currentEpisode === undefined ? 0 : integer(input.currentEpisode, 0, 1_000_000)
  const totalEpisodes = input.totalEpisodes == null ? null : integer(input.totalEpisodes, 1, 1_000_000)

  if (!source || !externalId || !/^(movie|tv):[1-9]\d*$/.test(externalId) || !title || !type || !status
    || !updatedDate || Number.isNaN(updatedDate.getTime()) || currentEpisode === null
    || (totalEpisodes !== null && currentEpisode > totalEpisodes)) return null
  if ((externalId.startsWith('movie:')) !== (type === 'Movie')) return null

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
    updated_at: updatedDate.toISOString(),
  }
}

export async function GET(request: Request) {
  const integration = await authenticateIntegration(request, 'watchlist:read')
  if (!integration) return json({ error: 'Unauthorized.' }, 401)
  const since = new URL(request.url).searchParams.get('updatedAfter')
  let query = adminClient().from('watchlist_items').select('*').eq('user_id', integration.user_id).order('updated_at')
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
  const { data, error } = await adminClient().rpc('upsert_watchlist_from_api', {
    p_token_hash: hashToken(integration.rawToken),
    p_item: item,
  })
  return error ? json({ error: 'Could not update watchlist.' }, 500) : json(data)
}
