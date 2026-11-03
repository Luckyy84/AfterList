import { fetchMedia } from './media'
import { searchResultToMediaItem } from '../utils/media'
import type { MediaDetails, MediaItem, MediaSource } from '../types/media'
import type { SearchResultItem } from '../types/search'
export type CatalogState = { status: string; refreshedAt?: string | null }
export type CatalogEntry = { provider: MediaSource; external_id: string; title: string; payload: { item: SearchResultItem; details: MediaDetails }; refreshed_at: string }
export async function fetchCatalogMedia(source: MediaSource, externalId: string, options: { signal?: AbortSignal } = {}): Promise<{ item: MediaItem; details: MediaDetails; catalog: CatalogState }> {
  let catalog: CatalogState = { status: 'unavailable' }
  try {
    const refresh = source === 'anilist' && import.meta.env.VITE_ANILIST_ENABLED !== 'true' ? '&refresh=false' : ''
    const response = await fetch(`/api/catalog?source=${source}&externalId=${encodeURIComponent(externalId)}${refresh}`, { signal: options.signal })
    const data = await response.json() as { item?: SearchResultItem; details?: MediaDetails; catalog?: CatalogState }
    catalog = data.catalog ?? catalog
    if (response.ok && data.item && data.details) return { item: searchResultToMediaItem(data.item), details: data.details, catalog }
    if (response.status === 429) throw new Error('Too many requests. Try again shortly.')
  } catch (cause) {
    if (options.signal?.aborted || (cause instanceof Error && cause.message.startsWith('Too many requests'))) throw cause
  }
  return { ...await fetchMedia(source, externalId, options), catalog }
}
export async function searchCatalog(query: string, signal?: AbortSignal): Promise<CatalogEntry[]> {
  const response = await fetch(`/api/catalog?q=${encodeURIComponent(query.trim())}`, { signal })
  const data = await response.json() as { results?: CatalogEntry[]; error?: string }
  if (!response.ok) throw new Error(data.error || 'Catalog search unavailable.')
  return data.results ?? []
}
