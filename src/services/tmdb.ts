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

export function canFetchTmdbDetails(item: MediaItem) {
  return item.source === 'tmdb' && Boolean(item.externalId)
}

export async function fetchTmdbDetails(item: MediaItem, options: SearchTmdbOptions = {}) {
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
