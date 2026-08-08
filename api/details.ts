const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'
const TMDB_ANIMATION_GENRE_ID = 16
const TMDB_TIMEOUT_MS = 10_000

type TmdbMediaKind = 'movie' | 'tv'
type MediaType = 'Anime' | 'Movie' | 'TV Series'

type TmdbGenre = { id: number; name: string }
type TmdbProductionCountry = { iso_3166_1: string; name: string }

type TmdbDetails = {
  id?: number
  title?: string
  name?: string
  backdrop_path?: string | null
  poster_path?: string | null
  genres?: TmdbGenre[]
  homepage?: string | null
  original_language?: string
  origin_country?: string[]
  production_countries?: TmdbProductionCountry[]
  overview?: string
  release_date?: string
  first_air_date?: string
  runtime?: number | null
  episode_run_time?: number[]
  last_episode_to_air?: { runtime?: number | null } | null
  number_of_episodes?: number
  number_of_seasons?: number
  in_production?: boolean
  status?: string
  tagline?: string | null
  vote_average?: number
  vote_count?: number
}

type DetailsResponse = {
  item: {
    externalId: string
    source: 'tmdb'
    title: string
    type: MediaType
    year: string
    poster: string
    backdrop: string
    rating: string
    description: string
  }
  details: {
    genres: string[]
    poster?: string
    backdrop?: string
    runtimeLabel?: string
    runtimeMinutes?: number
    seasonsLabel?: string
    episodesLabel?: string
    totalEpisodes?: number
    status?: string
    tagline?: string
    homepage?: string
    tmdbUrl: string
    originalLanguage?: string
    countries: string[]
    voteCount?: number
  }
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  const status = init?.status ?? 200
  const cacheControl = status >= 400 ? 'no-store' : 'public, max-age=300, s-maxage=1800, stale-while-revalidate=3600'
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
      ...init?.headers,
    },
  })
}

function parseExternalId(externalId: string) {
  const match = /^(movie|tv):([1-9]\d*)$/.exec(externalId)
  if (!match) return null
  const id = Number(match[2])
  return Number.isSafeInteger(id) ? { kind: match[1] as TmdbMediaKind, id } : null
}

function imageUrl(path: string | null | undefined, size: 'w500' | 'w1280') {
  return path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : undefined
}

function escapeSvgText(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function placeholderImage(title: string, type: MediaType) {
  const safeTitle = escapeSvgText(title.slice(0, 42))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1350" viewBox="0 0 900 1350"><rect width="900" height="1350" fill="#11131a"/><text x="76" y="610" fill="#f4f6fb" font-family="Arial,sans-serif" font-size="72" font-weight="700">AfterList</text><text x="80" y="720" fill="#aeb7c8" font-family="Arial,sans-serif" font-size="36">${type}</text><text x="80" y="810" fill="#f4f6fb" font-family="Arial,sans-serif" font-size="46" font-weight="600">${safeTitle || 'Untitled'}</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function mediaType(data: TmdbDetails, kind: TmdbMediaKind): MediaType {
  const isAnimation = data.genres?.some((genre) => genre.id === TMDB_ANIMATION_GENRE_ID) ?? false
  const isJapanese = data.original_language === 'ja' || data.origin_country?.includes('JP')
  if (isAnimation && isJapanese) return 'Anime'
  return kind === 'movie' ? 'Movie' : 'TV Series'
}

function snapshot(data: TmdbDetails, kind: TmdbMediaKind, id: number): DetailsResponse['item'] | null {
  if (data.id !== id) return null
  const title = (kind === 'movie' ? data.title : data.name)?.trim()
  if (!title) return null
  const type = mediaType(data, kind)
  const date = kind === 'movie' ? data.release_date : data.first_air_date
  const placeholder = placeholderImage(title, type)
  return {
    externalId: `${kind}:${id}`,
    source: 'tmdb',
    title,
    type,
    year: /^\d{4}/.test(date ?? '') ? date!.slice(0, 4) : 'Unknown',
    poster: imageUrl(data.poster_path, 'w500') ?? placeholder,
    backdrop: imageUrl(data.backdrop_path, 'w1280') ?? placeholder,
    rating: typeof data.vote_average === 'number' && Number.isFinite(data.vote_average) && data.vote_average > 0 ? data.vote_average.toFixed(1) : 'N/A',
    description: data.overview?.trim() || `No ${type.toLowerCase()} description is available from TMDB yet.`,
  }
}

function formatRuntime(minutes?: number | null) {
  if (!minutes || minutes <= 0) return undefined
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (!hours) return `${remainingMinutes}m`
  if (!remainingMinutes) return `${hours}h`
  return `${hours}h ${remainingMinutes}m`
}

function formatCount(value: number | undefined, singular: string, plural: string) {
  return value && value > 0 ? `${value} ${value === 1 ? singular : plural}` : undefined
}

function countryNames(countries?: TmdbProductionCountry[]) {
  return (countries ?? []).map((country) => country.name?.trim()).filter((name): name is string => Boolean(name)).slice(0, 3)
}

function mapDetails(data: TmdbDetails, kind: TmdbMediaKind, id: number, item: DetailsResponse['item']): DetailsResponse {
  const runtimeMinutes = kind === 'movie'
    ? (data.runtime && data.runtime > 0 ? data.runtime : undefined)
    : data.episode_run_time?.find((runtime) => runtime > 0)
      ?? (data.last_episode_to_air?.runtime && data.last_episode_to_air.runtime > 0 ? data.last_episode_to_air.runtime : undefined)

  return {
    item,
    details: {
      genres: (data.genres ?? []).map((genre) => genre.name).filter(Boolean).slice(0, 5),
      poster: imageUrl(data.poster_path, 'w500'),
      backdrop: imageUrl(data.backdrop_path, 'w1280'),
      runtimeLabel: formatRuntime(runtimeMinutes),
      runtimeMinutes,
      seasonsLabel: kind === 'tv' ? formatCount(data.number_of_seasons, 'season', 'seasons') : undefined,
      episodesLabel: kind === 'tv' ? formatCount(data.number_of_episodes, 'episode', 'episodes') : undefined,
      totalEpisodes: kind === 'tv' ? data.number_of_episodes : undefined,
      status: data.status ?? (kind === 'tv' && data.in_production ? 'In Production' : undefined),
      tagline: data.tagline?.trim() || undefined,
      homepage: data.homepage?.trim() || undefined,
      tmdbUrl: `https://www.themoviedb.org/${kind}/${id}`,
      originalLanguage: data.original_language?.toUpperCase(),
      countries: countryNames(data.production_countries),
      voteCount: data.vote_count,
    },
  }
}

export async function GET(request: Request) {
  try {
    const externalId = new URL(request.url).searchParams.get('externalId') ?? ''
    const parsedId = parseExternalId(externalId)
    if (!parsedId) return jsonResponse({ error: 'A valid TMDB externalId is required.' }, { status: 400 })

    const apiKey = process.env.TMDB_API_KEY?.trim()
    const accessToken = process.env.TMDB_ACCESS_TOKEN?.trim()
    if (!apiKey && !accessToken) return jsonResponse({ error: 'TMDB is not configured on the server.' }, { status: 503 })

    const params = new URLSearchParams({ language: 'en-US' })
    if (!accessToken && apiKey) params.set('api_key', apiKey)
    const response = await fetch(`${TMDB_API_BASE_URL}/${parsedId.kind}/${parsedId.id}?${params}`, {
      signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
      headers: { accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    })

    if (!response.ok) {
      if (response.status === 404) return jsonResponse({ error: 'TMDB title not found.' }, { status: 404 })
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after')
        return jsonResponse({ error: 'TMDB rate limit exceeded. Try again shortly.' }, {
          status: 429,
          headers: retryAfter && /^\d+$/.test(retryAfter) ? { 'retry-after': retryAfter } : undefined,
        })
      }
      return jsonResponse({ error: 'TMDB details are temporarily unavailable.' }, { status: 502 })
    }

    const data = await response.json().catch(() => null) as TmdbDetails | null
    if (!data || typeof data !== 'object') return jsonResponse({ error: 'TMDB returned an invalid details response.' }, { status: 502 })
    const item = snapshot(data, parsedId.kind, parsedId.id)
    if (!item) return jsonResponse({ error: 'TMDB returned an invalid details response.' }, { status: 502 })
    return jsonResponse(mapDetails(data, parsedId.kind, parsedId.id, item))
  } catch (error) {
    console.error('TMDB details proxy failed:', error instanceof Error ? error.name : 'UnknownError')
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      return jsonResponse({ error: 'TMDB details request timed out.' }, { status: 504 })
    }
    return jsonResponse({ error: 'TMDB details proxy failed. Try again in a moment.' }, { status: 502 })
  }
}
