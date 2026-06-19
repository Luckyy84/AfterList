import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from '../../api/search'

describe('GET /api/search', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns an empty result without calling TMDB for a blank query', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const response = await GET(new Request('https://afterlist.test/api/search?query=%20'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ results: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('normalizes movie and anime results and filters unsupported entries', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      results: [
        {
          id: 10,
          media_type: 'movie',
          title: '  Example Movie  ',
          release_date: '2024-04-10',
          poster_path: '/poster.jpg',
          backdrop_path: '/backdrop.jpg',
          vote_average: 8.26,
          overview: '  A movie description.  ',
          genre_ids: [18],
        },
        {
          id: 20,
          media_type: 'tv',
          name: 'Example Anime',
          first_air_date: '2022-01-01',
          vote_average: 0,
          genre_ids: [16],
          original_language: 'ja',
        },
        { id: 30, media_type: 'person', name: 'Not media' },
      ],
    })))

    const response = await GET(new Request('https://afterlist.test/api/search?query=example'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.results).toHaveLength(2)
    expect(body.results[0]).toMatchObject({
      externalId: 'movie:10',
      source: 'tmdb',
      title: 'Example Movie',
      type: 'Movie',
      year: '2024',
      rating: '8.3',
      description: 'A movie description.',
    })
    expect(body.results[0].poster).toBe('https://image.tmdb.org/t/p/w500/poster.jpg')
    expect(body.results[1]).toMatchObject({
      externalId: 'tv:20',
      type: 'Anime',
      rating: 'N/A',
    })
    expect(body.results[1].poster).toMatch(/^data:image\/svg\+xml/)
  })

  it('preserves an upstream error status', async () => {
    vi.stubEnv('TMDB_ACCESS_TOKEN', 'test-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 429 }))

    const response = await GET(new Request('https://afterlist.test/api/search?query=example'))

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({ error: 'TMDB search failed with status 429.' })
  })
})
