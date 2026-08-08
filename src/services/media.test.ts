import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAnilistMedia, searchMedia } from './media'
import { searchTmdb } from './tmdb'

vi.mock('./tmdb', () => ({
  discoverTmdb: vi.fn(),
  fetchTmdbMedia: vi.fn(),
  searchTmdb: vi.fn(),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('provider-neutral media service', () => {
  it('normalizes AniList details into a saveable media item', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      item: { externalId: '101', source: 'anilist', title: 'Anime', type: 'Anime', year: '2026', poster: '/p', backdrop: '/b', rating: '8.8', description: 'Story' },
      details: { genres: ['Action'], countries: ['JP'], format: 'TV' },
    }), { status: 200, headers: { 'content-type': 'application/json' } })))
    const result = await fetchAnilistMedia('101')
    expect(result.item).toMatchObject({ id: 'anilist-101', source: 'anilist', externalId: '101', status: 'Planned' })
    expect(result.details.format).toBe('TV')
  })

  it('keeps a working provider when the other search fails', async () => {
    const tmdb = { externalId: 'movie:1', source: 'tmdb' as const, title: 'Movie', type: 'Movie' as const, year: '2026', poster: '', backdrop: '', rating: '8', description: '' }
    vi.mocked(searchTmdb).mockResolvedValue([tmdb])
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'offline' }), { status: 502, headers: { 'content-type': 'application/json' } })))
    await expect(searchMedia('Movie')).resolves.toEqual([tmdb])
  })
})
