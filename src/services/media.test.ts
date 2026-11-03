import { afterEach, describe, expect, it, vi } from 'vitest'
import { discoverAnilist, discoverMedia, fetchAnilistMedia, fetchMedia, searchAnilist, searchMedia } from './media'
import { discoverTmdb, fetchTmdbMedia, searchTmdb } from './tmdb'

vi.mock('./tmdb', () => ({
  discoverTmdb: vi.fn(),
  fetchTmdbMedia: vi.fn(),
  searchTmdb: vi.fn(),
}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('provider-neutral media service', () => {
  it.each([undefined, '', 'false', 'TRUE', '1'])('does not contact AniList when client flag is %s', async (enabled) => {
    vi.stubEnv('VITE_ANILIST_ENABLED', enabled)
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(searchAnilist('anime')).resolves.toEqual([])
    await expect(discoverAnilist()).resolves.toEqual([])
    await expect(fetchAnilistMedia('101')).rejects.toThrow('AniList integration is disabled.')
    await expect(fetchMedia('anilist', '101')).rejects.toThrow('AniList integration is disabled.')
    vi.mocked(searchTmdb).mockResolvedValue([])
    vi.mocked(discoverTmdb).mockResolvedValue([])
    await expect(searchMedia('movie')).resolves.toEqual([])
    await expect(discoverMedia()).resolves.toEqual([])
    expect(fetcher).not.toHaveBeenCalled()
    expect(searchTmdb).toHaveBeenCalled()
    expect(discoverTmdb).toHaveBeenCalled()
    fetchMedia('tmdb', 'movie:1')
    expect(fetchTmdbMedia).toHaveBeenCalledWith('movie:1', {})
  })

  it('does not mask TMDB failure with a disabled provider', async () => {
    vi.stubEnv('VITE_ANILIST_ENABLED', 'false')
    vi.mocked(searchTmdb).mockRejectedValue(new Error('TMDB unavailable'))
    await expect(searchMedia('movie')).rejects.toThrow('TMDB unavailable')
  })
  it('normalizes AniList details into a saveable media item', async () => {
    vi.stubEnv('VITE_ANILIST_ENABLED', 'true')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      item: { externalId: '101', source: 'anilist', title: 'Anime', type: 'Anime', year: '2026', poster: '/p', backdrop: '/b', rating: '8.8', description: 'Story' },
      details: { genres: ['Action'], countries: ['JP'], format: 'TV' },
    }), { status: 200, headers: { 'content-type': 'application/json' } })))
    const result = await fetchAnilistMedia('101')
    expect(result.item).toMatchObject({ id: 'anilist-101', source: 'anilist', externalId: '101', status: 'Planned' })
    expect(result.details.format).toBe('TV')
  })

  it('keeps a working provider when the other search fails', async () => {
    vi.stubEnv('VITE_ANILIST_ENABLED', 'true')
    const tmdb = { externalId: 'movie:1', source: 'tmdb' as const, title: 'Movie', type: 'Movie' as const, year: '2026', poster: '', backdrop: '', rating: '8', description: '' }
    vi.mocked(searchTmdb).mockResolvedValue([tmdb])
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'offline' }), { status: 502, headers: { 'content-type': 'application/json' } })))
    await expect(searchMedia('Movie')).resolves.toEqual([tmdb])
  })
})
