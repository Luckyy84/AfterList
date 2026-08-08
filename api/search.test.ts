import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './search'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('TMDB search proxy security bounds', () => {
  it('rejects oversized queries before contacting TMDB', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(new Request(`http://localhost/api/search?query=${'x'.repeat(121)}`))

    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('adds an abort signal to legitimate upstream searches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))
    vi.stubEnv('TMDB_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(new Request('http://localhost/api/search?query=dune'))

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })
})
