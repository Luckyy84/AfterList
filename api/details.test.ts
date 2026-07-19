import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './details'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('TMDB details proxy', () => {
  it('returns movie runtime minutes', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      runtime: 121,
      genres: [],
    }), { status: 200 })))

    const response = await GET(new Request('http://localhost/api/details?externalId=movie:11'))
    const body = await response.json() as { details: { runtimeMinutes?: number; runtimeLabel?: string } }

    expect(body.details).toMatchObject({ runtimeMinutes: 121, runtimeLabel: '2h 1m' })
  })

  it('returns TV episode runtime and episode total for tracking', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      number_of_episodes: 24,
      number_of_seasons: 2,
      episode_run_time: [0, 28],
      genres: [],
    }), { status: 200 })))

    const response = await GET(new Request('http://localhost/api/details?externalId=tv:42'))
    const body = await response.json() as { details: { totalEpisodes?: number; runtimeMinutes?: number } }

    expect(body.details).toMatchObject({ totalEpisodes: 24, runtimeMinutes: 28 })
  })

  it('falls back to the latest TV episode runtime', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      episode_run_time: [],
      last_episode_to_air: { runtime: 52 },
      genres: [],
    }), { status: 200 })))

    const response = await GET(new Request('http://localhost/api/details?externalId=tv:42'))
    const body = await response.json() as { details: { runtimeMinutes?: number } }

    expect(body.details.runtimeMinutes).toBe(52)
  })

  it('omits invalid or missing runtime values', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      runtime: 0,
      genres: [],
    }), { status: 200 })))

    const response = await GET(new Request('http://localhost/api/details?externalId=movie:11'))
    const body = await response.json() as { details: { runtimeMinutes?: number } }

    expect(body.details.runtimeMinutes).toBeUndefined()
  })
})
