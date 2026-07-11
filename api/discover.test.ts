import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './discover'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('TMDB discovery proxy', () => {
  it('rejects invalid input without caching or contacting TMDB', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(new Request('http://localhost/api/discover?feed=nope'))

    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires a valid external ID for recommendations', async () => {
    const response = await GET(new Request('http://localhost/api/discover?feed=recommendations&externalId=bad'))

    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('normalizes successful public results and caches them', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{
      id: 42,
      media_type: 'movie',
      title: 'The Answer',
      release_date: '2025-01-01',
      vote_average: 8.25,
      overview: 'Found it.',
    }] }), { status: 200 })))

    const response = await GET(new Request('http://localhost/api/discover?feed=trending&mediaType=all&page=1'))
    const body = await response.json() as { results: Array<{ externalId: string; title: string }> }

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('public')
    expect(body.results[0]).toMatchObject({ externalId: 'movie:42', title: 'The Answer' })
  })
})
