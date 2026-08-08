import type { MediaDetails, MediaItem } from '../types/media'
import type { SearchResultItem } from '../types/search'
import { searchResultToMediaItem } from '../utils/media'
import { discoverTmdb, fetchTmdbMedia, searchTmdb, type DiscoverFeed, type DiscoverMediaType } from './tmdb'

type RequestOptions = { signal?: AbortSignal }
type MediaResponse = { item: MediaItem; details: MediaDetails }
type SearchResponse = { results?: SearchResultItem[]; error?: string }
type DetailsResponse = { item?: SearchResultItem; details?: MediaDetails; error?: string }

async function fetchJson<T>(url: string, options: RequestOptions = {}) {
  const response = await fetch(url, { signal: options.signal, headers: { accept: 'application/json' } })
  const data = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(data.error || `Media request failed with status ${response.status}`)
  return data
}

export async function searchAnilist(query: string, options: RequestOptions = {}) {
  const trimmed = query.trim()
  if (!trimmed) return []
  const data = await fetchJson<SearchResponse>(`/api/anilist?operation=search&q=${encodeURIComponent(trimmed)}`, options)
  return data.results ?? []
}

export async function discoverAnilist(page = 1, options: RequestOptions = {}) {
  const data = await fetchJson<SearchResponse>(`/api/anilist?operation=discover&page=${page}`, options)
  return data.results ?? []
}

export async function fetchAnilistMedia(id: string, options: RequestOptions = {}): Promise<MediaResponse> {
  const data = await fetchJson<DetailsResponse>(`/api/anilist?operation=details&id=${encodeURIComponent(id)}`, options)
  if (!data.item || !data.details) throw new Error('AniList returned incomplete title details.')
  return { item: searchResultToMediaItem(data.item), details: data.details }
}

function mergeResults(groups: SearchResultItem[][]) {
  const seen = new Set<string>()
  return groups.flat().filter((item) => {
    const key = `${item.source}:${item.externalId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function settledResults(requests: Array<Promise<SearchResultItem[]>>) {
  const settled = await Promise.allSettled(requests)
  const groups = settled.filter((result): result is PromiseFulfilledResult<SearchResultItem[]> => result.status === 'fulfilled').map((result) => result.value)
  if (!groups.length) throw (settled.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined)?.reason ?? new Error('Media providers are unavailable.')
  return mergeResults(groups)
}

export function searchMedia(query: string, options: RequestOptions = {}) {
  return settledResults([searchTmdb(query, options), searchAnilist(query, options)])
}

export function discoverMedia(options: RequestOptions & { feed?: DiscoverFeed; mediaType?: DiscoverMediaType; page?: number; externalId?: string } = {}) {
  const tmdb = discoverTmdb(options)
  const includeAnime = !options.externalId && options.mediaType !== 'movie'
  return settledResults(includeAnime ? [tmdb, discoverAnilist(options.page, options)] : [tmdb])
}

export function fetchMedia(source: 'tmdb' | 'anilist', externalId: string, options: RequestOptions = {}) {
  return source === 'anilist' ? fetchAnilistMedia(externalId, options) : fetchTmdbMedia(externalId, options)
}
