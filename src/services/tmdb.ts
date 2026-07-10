import type { MediaDetails, MediaItem } from '../types/media'
import type { SearchResultItem } from '../types/search'

type SearchTmdbOptions = {
  signal?: AbortSignal
}

type SearchProxyResponse = {
  results?: SearchResultItem[]
  error?: string
}

type DetailsProxyResponse = {
  details?: MediaDetails
  error?: string
}

export type DiscoverFeed = 'trending' | 'popular' | 'recommendations'
export type DiscoverMediaType = 'all' | 'movie' | 'tv'

type DiscoverTmdbOptions = SearchTmdbOptions & {
  feed?: DiscoverFeed
  mediaType?: DiscoverMediaType
  page?: number
  externalId?: string
}

export function isTmdbSearchConfigured() {
  return true
}

export async function searchTmdb(query: string, options: SearchTmdbOptions = {}) {
  const trimmedQuery = query.trim()

  if (!trimmedQuery) return []

  const response = await fetch(`/api/search?query=${encodeURIComponent(trimmedQuery)}`, {
    signal: options.signal,
    headers: {
      accept: 'application/json',
    },
  })

  const data = (await response.json()) as SearchProxyResponse

  if (!response.ok) {
    throw new Error(data.error || `TMDB proxy search failed with status ${response.status}`)
  }

  return data.results ?? []
}

export async function discoverTmdb(options: DiscoverTmdbOptions = {}) {
  const params = new URLSearchParams({
    feed: options.feed ?? 'trending',
    mediaType: options.mediaType ?? 'all',
    page: String(options.page ?? 1),
  })
  if (options.externalId) params.set('externalId', options.externalId)

  const response = await fetch(`/api/discover?${params}`, {
    signal: options.signal,
    headers: { accept: 'application/json' },
  })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('TMDB discovery is unavailable in this development server.')
  }
  const data = (await response.json()) as SearchProxyResponse
  if (!response.ok) throw new Error(data.error || `TMDB discovery failed with status ${response.status}`)
  return data.results ?? []
}

export function canFetchTmdbDetails(item: MediaItem) {
  return item.source === 'tmdb' && Boolean(item.externalId)
}

export async function fetchTmdbDetails(item: Pick<MediaItem, 'externalId'>, options: SearchTmdbOptions = {}) {
  if (!item.externalId) {
    throw new Error('Missing TMDB external ID.')
  }

  const response = await fetch(`/api/details?externalId=${encodeURIComponent(item.externalId)}`, {
    signal: options.signal,
    headers: {
      accept: 'application/json',
    },
  })

  const data = (await response.json()) as DetailsProxyResponse

  if (!response.ok) {
    throw new Error(data.error || `TMDB details failed with status ${response.status}`)
  }

  return data.details ?? null
}
