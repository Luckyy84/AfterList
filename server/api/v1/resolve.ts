import { authenticateIntegration, json } from '../_lib/afterlistApi.js'

const ANILIST_API_URL = 'https://graphql.anilist.co'
const TMDB_API_URL = 'https://api.themoviedb.org/3'
const TMDB_ANIMATION_GENRE_ID = 16
const REQUEST_TIMEOUT_MS = 10_000

type AniListMedia = {
  title?: { romaji?: string | null; english?: string | null; native?: string | null }
  synonyms?: string[] | null
  seasonYear?: number | null
  countryOfOrigin?: string | null
}

type TmdbResult = {
  id?: number
  media_type?: string
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  release_date?: string
  first_air_date?: string
  genre_ids?: number[]
  origin_country?: string[]
  original_language?: string
  popularity?: number
}

const ANILIST_QUERY = `
  query ($id: Int!) {
    Media(id: $id, type: ANIME) {
      title { romaji english native }
      synonyms
      seasonYear
      countryOfOrigin
    }
  }
`

function normalize(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function uniqueTitles(media: AniListMedia) {
  return [...new Set([
    media.title?.english,
    media.title?.romaji,
    media.title?.native,
    ...(media.synonyms ?? []),
  ].filter((value): value is string => Boolean(value?.trim())))]
}

function resultTitle(result: TmdbResult) {
  return result.media_type === 'movie' ? result.title : result.name
}

function scoreResult(result: TmdbResult, media: AniListMedia, titles: string[]) {
  if (!result.id || !['movie', 'tv'].includes(result.media_type ?? '')) return -1
  if (!result.genre_ids?.includes(TMDB_ANIMATION_GENRE_ID)) return -1

  const knownTitles = new Set(titles.map(normalize))
  const candidateTitles = [resultTitle(result), result.original_title, result.original_name]
    .filter((value): value is string => Boolean(value))
    .map(normalize)
  const exactTitle = candidateTitles.some((title) => knownTitles.has(title))
  if (!exactTitle) return -1

  const date = result.media_type === 'movie' ? result.release_date : result.first_air_date
  const year = Number(date?.slice(0, 4)) || null
  const yearDifference = media.seasonYear && year ? Math.abs(media.seasonYear - year) : null
  if (yearDifference !== null && yearDifference > 1) return -1

  const countryMatches = !media.countryOfOrigin
    || result.origin_country?.includes(media.countryOfOrigin)
    || (media.countryOfOrigin === 'JP' && result.original_language === 'ja')

  return 100 + (yearDifference === 0 ? 20 : yearDifference === 1 ? 8 : 0)
    + (countryMatches ? 10 : 0) + Math.min(result.popularity ?? 0, 100) / 100
}

async function fetchAniListMedia(id: number) {
  const response = await fetch(ANILIST_API_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { id } }),
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`AniList returned ${response.status}`)
  const body = await response.json() as { data?: { Media?: AniListMedia | null } }
  return body.data?.Media ?? null
}

async function searchTmdb(query: string, apiKey: string | undefined, accessToken: string | undefined) {
  const params = new URLSearchParams({ query, include_adult: 'false', language: 'en-US', page: '1' })
  if (!accessToken && apiKey) params.set('api_key', apiKey)
  const response = await fetch(`${TMDB_API_URL}/search/multi?${params}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  })
  if (!response.ok) throw new Error(`TMDB returned ${response.status}`)
  const body = await response.json() as { results?: TmdbResult[] }
  return body.results ?? []
}

export async function GET(request: Request) {
  const integration = await authenticateIntegration(request, 'watchlist:write')
  if (!integration) return json({ error: 'Unauthorized.' }, 401)

  const url = new URL(request.url)
  if (url.searchParams.get('source') !== 'anilist') return json({ error: 'Only source=anilist is supported.' }, 400)
  const rawId = url.searchParams.get('id') ?? ''
  if (!/^[1-9]\d{0,9}$/.test(rawId)) return json({ error: 'A valid AniList ID is required.' }, 400)

  const apiKey = process.env.TMDB_API_KEY?.trim()
  const accessToken = process.env.TMDB_ACCESS_TOKEN?.trim()
  if (!apiKey && !accessToken) return json({ error: 'TMDB is not configured on the server.' }, 503)

  try {
    const media = await fetchAniListMedia(Number(rawId))
    if (!media) return json({ error: 'AniList title not found.' }, 404)
    const titles = uniqueTitles(media)
    if (!titles.length) return json({ error: 'AniList title has no searchable name.' }, 404)

    const searches = await Promise.all(titles.slice(0, 3).map((title) => searchTmdb(title, apiKey, accessToken)))
    const candidates = [...new Map(searches.flat().map((item) => [`${item.media_type}:${item.id}`, item])).values()]
      .map((result) => ({ result, score: scoreResult(result, media, titles) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)

    const match = candidates[0]?.result
    const title = match ? resultTitle(match) : null
    if (!match?.id || !title || !['movie', 'tv'].includes(match.media_type ?? '')) {
      return json({ error: 'No confident TMDB match was found.' }, 404)
    }

    return json({ source: 'tmdb', externalId: `${match.media_type}:${match.id}`, title })
  } catch (error) {
    console.error('Media identity resolution failed:', error instanceof Error ? error.message : 'UnknownError')
    return json({ error: 'Media identity resolution is temporarily unavailable.' }, 502)
  }
}
