import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MediaItem } from '../types/media'
import { canFetchTmdbDetails, fetchTmdbDetails, searchTmdb } from './tmdb'

const tmdbItem: MediaItem = {
  id: 'item-1',
  title: 'Example',
  type: 'Movie',
  status: 'Planned',
  poster: '',
  backdrop: '',
  progress: '',
  rating: '8.0',
  description: '',
  source: 'tmdb',
  externalId: 'movie:42',
}

describe('TMDB proxy client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('skips search for whitespace-only input', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    await expect(searchTmdb('   ')).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('encodes search input and returns proxy results', async () => {
    const results = [{ externalId: 'movie:42', source: 'tmdb', title: 'A & B' }]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ results })))

    await expect(searchTmdb('  A & B  ')).resolves.toEqual(results)
    expect(fetchMock).toHaveBeenCalledWith('/api/search?query=A%20%26%20B', expect.objectContaining({
      headers: { accept: 'application/json' },
    }))
  })

  it('uses the proxy error message for failed detail requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Not available.' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    }))

    await expect(fetchTmdbDetails(tmdbItem)).rejects.toThrow('Not available.')
  })

  it('only allows TMDB items with an external ID to fetch details', () => {
    expect(canFetchTmdbDetails(tmdbItem)).toBe(true)
    expect(canFetchTmdbDetails({ ...tmdbItem, source: 'anilist' })).toBe(false)
    expect(canFetchTmdbDetails({ ...tmdbItem, externalId: undefined })).toBe(false)
  })
})
