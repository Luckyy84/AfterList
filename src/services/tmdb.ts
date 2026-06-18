import type { SearchResultItem } from '../types/search'

type SearchTmdbOptions = {
  signal?: AbortSignal
}

type SearchProxyResponse = {
  results?: SearchResultItem[]
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
