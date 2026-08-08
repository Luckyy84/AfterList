import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './details'

function tmdbResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    title: 'Star Wars',
    release_date: '1977-05-25',
    vote_average: 8.2,
    overview: 'A galaxy far away.',
    runtime: 121,
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    genres: [],
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('TMDB details proxy', () => {
  it('returns a normalized movie snapshot and preserves the existing details payload', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(tmdbResponse()), { status: 200 })))

    const response = await GET(new Request('http://localhost/api/details?externalId=movie:11'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('s-maxage=1800')
    expect(body.item).toEqual({
      externalId: 'movie:11',
      source: 'tmdb',
      title: 'Star Wars',
      type: 'Movie',
      year: '1977',
      poster: 'https://image.tmdb.org/t/p/w500/poster.jpg',
      backdrop: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
      rating: '8.2',
      description: 'A galaxy far away.',
    })
    expect(body.details).toMatchObject({
      runtimeMinutes: 121,
      runtimeLabel: '2h 1m',
      poster: 'https://image.tmdb.org/t/p/w500/poster.jpg',
      backdrop: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
      tmdbUrl: 'https://www.themoviedb.org/movie/11',
    })
  })

  it('returns TV tracking details and detects Japanese animation as anime', async () => {
    vi.stubEnv('TMDB_ACCESS_TOKEN', 'server-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(tmdbResponse({
      id: 42,
      title: undefined,
      name: 'Anime Series',
      release_date: undefined,
      first_air_date: '2024-01-02',
      runtime: undefined,
      number_of_episodes: 24,
      number_of_seasons: 2,
      episode_run_time: [0, 28],
      genres: [{ id: 16, name: 'Animation' }],
      original_language: 'ja',
      origin_country: ['JP'],
    })), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(new Request('http://localhost/api/details?externalId=tv:42'))
    const body = await response.json()

    expect(body.item).toMatchObject({ externalId: 'tv:42', title: 'Anime Series', type: 'Anime', year: '2024' })
    expect(body.details).toMatchObject({ totalEpisodes: 24, runtimeMinutes: 28, seasonsLabel: '2 seasons', episodesLabel: '24 episodes' })
    expect(fetchMock.mock.calls[0][0]).not.toContain('server-token')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer server-token')
  })

  it('falls back to the latest TV episode runtime and placeholder artwork', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(tmdbResponse({
      id: 42,
      title: undefined,
      name: 'Series',
      episode_run_time: [],
      last_episode_to_air: { runtime: 52 },
      poster_path: null,
      backdrop_path: null,
    })), { status: 200 })))

    const response = await GET(new Request('http://localhost/api/details?externalId=tv:42'))
    const body = await response.json()

    expect(body.details.runtimeMinutes).toBe(52)
    expect(body.item.poster).toMatch(/^data:image\/svg\+xml/)
    expect(body.item.backdrop).toBe(body.item.poster)
  })

  it.each(['', 'movie:0', 'movie:-1', 'movie:1.5', 'movie:11:extra', 'tv:01', 'person:11', 'MOVIE:11', ' movie:11', 'movie:999999999999999999999'])('rejects invalid externalId %j before fetching', async (externalId) => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(new Request(`http://localhost/api/details?externalId=${encodeURIComponent(externalId)}`))

    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a stable not-found error without caching it', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })))

    const response = await GET(new Request('http://localhost/api/details?externalId=movie:11'))

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ error: 'TMDB title not found.' })
  })

  it('preserves a numeric Retry-After on rate limits', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'retry-after': '30' } })))

    const response = await GET(new Request('http://localhost/api/details?externalId=movie:11'))

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('30')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('maps upstream failures to a no-store 502 without leaking the response', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('upstream secret', { status: 503 })))

    const response = await GET(new Request('http://localhost/api/details?externalId=movie:11'))

    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).not.toContain('upstream secret')
  })

  it.each([
    ['invalid JSON', new Response('{', { status: 200 })],
    ['missing title', new Response(JSON.stringify({ id: 11, genres: [] }), { status: 200 })],
    ['wrong ID', new Response(JSON.stringify(tmdbResponse({ id: 12 })), { status: 200 })],
  ])('rejects malformed success responses: %s', async (_label, upstream) => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream))

    const response = await GET(new Request('http://localhost/api/details?externalId=movie:11'))

    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('maps timeouts to a no-store 504', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await GET(new Request('http://localhost/api/details?externalId=movie:11'))

    expect(response.status).toBe(504)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('returns no-store 503 when server credentials are absent', async () => {
    vi.stubEnv('TMDB_API_KEY', '')
    vi.stubEnv('TMDB_ACCESS_TOKEN', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(new Request('http://localhost/api/details?externalId=movie:11'))

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
