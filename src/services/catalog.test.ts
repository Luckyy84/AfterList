import { expect, it, vi } from 'vitest'
import { fetchCatalogMedia } from './catalog'
vi.mock('./media', () => ({ fetchMedia: vi.fn(async () => ({ item: { title: 'Fallback' }, details: {} })) }))
it('normalizes shared metadata into a media item and preserves refresh provenance', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ item: { source: 'anilist', externalId: '1', title: 'Anime', type: 'Anime', year: '2026' }, details: {}, catalog: { status: 'fresh', refreshedAt: '2026-10-30' } })))
  const result = await fetchCatalogMedia('anilist', '1')
  expect(result.item.id).toBe('anilist-1')
  expect(result.catalog?.refreshedAt).toBe('2026-10-30')
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('&refresh=false'), expect.anything())
  vi.restoreAllMocks()
})
