import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './details'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('TMDB details proxy', () => {
  it('returns the numeric episode total for tracking', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      number_of_episodes: 24,
      number_of_seasons: 2,
      genres: [],
    }), { status: 200 })))

    const response = await GET(new Request('http://localhost/api/details?externalId=tv:42'))
    const body = await response.json() as { details: { totalEpisodes?: number } }

    expect(body.details.totalEpisodes).toBe(24)
  })
})
