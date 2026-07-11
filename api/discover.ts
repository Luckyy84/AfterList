const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'
const TMDB_ANIMATION_GENRE_ID = 16

type RequestedMediaType = 'all' | 'movie' | 'tv'
type TmdbMediaType = Exclude<RequestedMediaType, 'all'>
type MediaType = 'Anime' | 'Movie' | 'TV Series'

type SearchResultItem = {
  externalId: string
  source: 'tmdb'
  title: string
  type: MediaType
  year: string
  poster: string
  backdrop: string
  rating: string
  description: string
  genreIds: number[]
}

type TmdbResult = {
  id: number
  media_type?: string
  adult?: boolean
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  backdrop_path?: string | null
  vote_average?: number
  overview?: string
  genre_ids?: number[]
  origin_country?: string[]
  original_language?: string
  popularity?: number
}

type TmdbResponse = { results?: TmdbResult[] }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status >= 400 ? 'no-store' : 'public, max-age=60, s-maxage=900, stale-while-revalidate=1800',
    },
  })
}

function parseExternalId(value: string) {
  const [kind, rawId] = value.split(':')
  const id = Number(rawId)
  return (kind === 'movie' || kind === 'tv') && Number.isInteger(id) && id > 0
    ? { kind, id }
    : null
}

function placeholder(title: string, type: MediaType) {
  const label = `${type}: ${title}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1350"><rect width="100%" height="100%" fill="#111318"/><text x="70" y="680" fill="#f4efe5" font-family="Arial" font-size="42">${label.slice(0, 60)}</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function image(path: string | null | undefined, size: 'w500' | 'w1280', title: string, type: MediaType) {
  return path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : placeholder(title, type)
}

function mapResult(result: TmdbResult, fallbackKind?: TmdbMediaType): SearchResultItem | null {
  const kind = result.media_type === 'movie' || result.media_type === 'tv' ? result.media_type : fallbackKind
  if (!kind || result.adult || !Number.isInteger(result.id) || result.id <= 0) return null

  const title = (kind === 'movie' ? result.title : result.name)?.trim()
  if (!title) return null

  const anime = kind === 'tv'
    && Boolean(result.genre_ids?.includes(TMDB_ANIMATION_GENRE_ID))
    && (result.original_language === 'ja' || Boolean(result.origin_country?.includes('JP')))
  const type: MediaType = anime ? 'Anime' : kind === 'movie' ? 'Movie' : 'TV Series'

  return {
    externalId: `${kind}:${result.id}`,
    source: 'tmdb',
    title,
    type,
    year: (kind === 'movie' ? result.release_date : result.first_air_date)?.slice(0, 4) || 'Unknown',
    poster: image(result.poster_path, 'w500', title, type),
    backdrop: image(result.backdrop_path, 'w1280', title, type),
    rating: typeof result.vote_average === 'number' && result.vote_average > 0 ? result.vote_average.toFixed(1) : 'N/A',
    description: result.overview?.trim() || `No ${type.toLowerCase()} description is available from TMDB yet.`,
    genreIds: result.genre_ids ?? [],
  }
}

async function fetchTmdb(path: string, page: number, accessToken?: string, apiKey?: string) {
  const params = new URLSearchParams({ language: 'en-US', page: String(page), include_adult: 'false' })
  if (!accessToken && apiKey) params.set('api_key', apiKey)

  const response = await fetch(`${TMDB_API_BASE_URL}${path}?${params}`, {
    headers: {
      accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })
  if (!response.ok) throw new Error(`TMDB returned ${response.status}`)
  return (await response.json()) as TmdbResponse
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const feed = params.get('feed') ?? 'trending'
    const mediaType = params.get('mediaType') ?? 'all'
    const page = Number(params.get('page') ?? '1')

    if (!['trending', 'popular', 'recommendations'].includes(feed)) {
      return jsonResponse({ error: 'feed must be trending, popular, or recommendations.' }, 400)
    }
    if (!['all', 'movie', 'tv'].includes(mediaType)) {
      return jsonResponse({ error: 'mediaType must be all, movie, or tv.' }, 400)
    }
    if (!Number.isInteger(page) || page < 1 || page > 500) {
      return jsonResponse({ error: 'page must be an integer from 1 to 500.' }, 400)
    }

    let requests: Array<{ path: string; kind?: TmdbMediaType }>
    if (feed === 'recommendations') {
      const externalId = parseExternalId(params.get('externalId')?.trim() ?? '')
      if (!externalId) return jsonResponse({ error: 'A valid TMDB externalId is required for recommendations.' }, 400)
      requests = [{ path: `/${externalId.kind}/${externalId.id}/recommendations`, kind: externalId.kind }]
    } else if (feed === 'popular' && mediaType === 'all') {
      requests = [{ path: '/movie/popular', kind: 'movie' }, { path: '/tv/popular', kind: 'tv' }]
    } else {
      requests = [{
        path: feed === 'trending' ? `/trending/${mediaType}/week` : `/${mediaType}/popular`,
        kind: mediaType === 'all' ? undefined : mediaType as TmdbMediaType,
      }]
    }

    const accessToken = process.env.TMDB_ACCESS_TOKEN?.trim()
    const apiKey = process.env.TMDB_API_KEY?.trim()
    if (!accessToken && !apiKey) return jsonResponse({ error: 'TMDB is not configured on the server.' }, 503)

    const responses = await Promise.all(requests.map(async ({ path, kind }) => ({
      data: await fetchTmdb(path, page, accessToken, apiKey),
      kind,
    })))
    const results = responses
      .flatMap(({ data, kind }) => (data.results ?? []).map((item) => ({ item, kind })))
      .sort((a, b) => (b.item.popularity ?? 0) - (a.item.popularity ?? 0))
      .map(({ item, kind }) => mapResult(item, kind))
      .filter((item): item is SearchResultItem => Boolean(item))
      .slice(0, 20)

    return jsonResponse({ results })
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: 'TMDB discovery is temporarily unavailable.' }, 502)
  }
}
