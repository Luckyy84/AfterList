import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from '../../api/details'

describe('GET /api/details', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('rejects an invalid external ID before calling TMDB', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const response = await GET(new Request('https://afterlist.test/api/details?externalId=person:1'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'A valid TMDB externalId is required.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('normalizes TV details', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      episode_run_time: [0, 47],
      genres: [{ id: 1, name: 'Drama' }, { id: 2, name: 'Mystery' }],
      homepage: ' https://example.test/show ',
      number_of_episodes: 12,
      number_of_seasons: 1,
      original_language: 'ja',
      production_countries: [{ iso_3166_1: 'JP', name: 'Japan' }],
      status: 'Ended',
      tagline: ' A mystery. ',
      vote_count: 450,
    })))

    const response = await GET(new Request('https://afterlist.test/api/details?externalId=tv:42'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      details: {
        genres: ['Drama', 'Mystery'],
        runtimeLabel: '47m',
        seasonsLabel: '1 season',
        episodesLabel: '12 episodes',
        status: 'Ended',
        tagline: 'A mystery.',
        homepage: 'https://example.test/show',
        tmdbUrl: 'https://www.themoviedb.org/tv/42',
        originalLanguage: 'JA',
        countries: ['Japan'],
        voteCount: 450,
      },
    })
  })

  it('reports missing server credentials', async () => {
    vi.stubEnv('TMDB_API_KEY', '')
    vi.stubEnv('TMDB_ACCESS_TOKEN', '')

    const response = await GET(new Request('https://afterlist.test/api/details?externalId=movie:42'))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'TMDB is not configured on the server.' })
  })
})
