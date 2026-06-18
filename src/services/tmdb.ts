import type { SearchCatalogItem } from '../data/searchCatalog'
import type { MediaType } from '../types/media'

const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'

const getTmdbApiKey = () => import.meta.env.VITE_TMDB_API_KEY?.trim()
const getTmdbAccessToken = () => import.meta.env.VITE_TMDB_ACCESS_TOKEN?.trim()

export function isTmdbSearchConfigured() {
  return Boolean(getTmdbAccessToken() || getTmdbApiKey())
}

type TmdbMediaType = 'movie' | 'tv'

type TmdbSearchResult = {
  id: number
  media_type: TmdbMediaType | 'person' | string
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  backdrop_path?: string | null
  vote_average?: number
  overview?: string
}

type TmdbSearchResponse = {
  results?: TmdbSearchResult[]
}

type SearchTmdbOptions = {
  signal?: AbortSignal
}

function isMovieOrTvResult(result: TmdbSearchResult): result is TmdbSearchResult & { media_type: TmdbMediaType } {
  return result.media_type === 'movie' || result.media_type === 'tv'
}

function getYear(date?: string) {
  return date?.slice(0, 4) || 'Unknown'
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function createPlaceholderImage(title: string, type: MediaType) {
  const safeTitle = escapeSvgText(title.slice(0, 42))
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1350" viewBox="0 0 900 1350">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#20242e"/>
          <stop offset="0.5" stop-color="#11131a"/>
          <stop offset="1" stop-color="#05060a"/>
        </linearGradient>
      </defs>
      <rect width="900" height="1350" fill="url(#bg)"/>
      <circle cx="710" cy="190" r="210" fill="#ffffff" opacity="0.06"/>
      <text x="76" y="610" fill="#f4f6fb" font-family="Inter, Arial, sans-serif" font-size="72" font-weight="700">AfterList</text>
      <text x="80" y="720" fill="#aeb7c8" font-family="Inter, Arial, sans-serif" font-size="36">${type}</text>
      <text x="80" y="810" fill="#f4f6fb" font-family="Inter, Arial, sans-serif" font-size="46" font-weight="600">${safeTitle || 'Untitled'}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function buildTmdbImageUrl(path: string | null | undefined, size: 'w500' | 'w1280', title: string, type: MediaType) {
  if (!path) return createPlaceholderImage(title, type)
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`
}

function mapTmdbResult(result: TmdbSearchResult & { media_type: TmdbMediaType }): SearchCatalogItem | null {
  const isMovie = result.media_type === 'movie'
  const title = (isMovie ? result.title : result.name)?.trim()

  if (!title) return null

  const type: MediaType = isMovie ? 'Movie' : 'TV Series'
  const year = getYear(isMovie ? result.release_date : result.first_air_date)
  const rating = typeof result.vote_average === 'number' && result.vote_average > 0 ? result.vote_average.toFixed(1) : 'N/A'

  return {
    externalId: `${result.media_type}:${result.id}`,
    source: 'tmdb',
    title,
    type,
    year,
    poster: buildTmdbImageUrl(result.poster_path, 'w500', title, type),
    backdrop: buildTmdbImageUrl(result.backdrop_path, 'w1280', title, type),
    rating,
    description: result.overview?.trim() || `No ${type.toLowerCase()} description is available from TMDB yet.`,
  }
}

export async function searchTmdb(query: string, options: SearchTmdbOptions = {}) {
  const trimmedQuery = query.trim()
  const apiKey = getTmdbApiKey()
  const accessToken = getTmdbAccessToken()

  if (!trimmedQuery || (!apiKey && !accessToken)) return []

  const params = new URLSearchParams({
    query: trimmedQuery,
    include_adult: 'false',
    language: 'en-US',
    page: '1',
  })

  if (!accessToken && apiKey) {
    params.set('api_key', apiKey)
  }

  const response = await fetch(`${TMDB_API_BASE_URL}/search/multi?${params.toString()}`, {
    signal: options.signal,
    headers: {
      accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })

  if (!response.ok) {
    throw new Error(`TMDB search failed with status ${response.status}`)
  }

  const data = (await response.json()) as TmdbSearchResponse

  return (data.results ?? [])
    .filter(isMovieOrTvResult)
    .map(mapTmdbResult)
    .filter((item): item is SearchCatalogItem => Boolean(item))
    .slice(0, 8)
}
