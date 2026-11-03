import { afterEach, expect, it, vi } from 'vitest'
import { GET } from './resolve'
vi.mock('../_lib/afterlistApi.js', () => ({
  authenticateIntegration: vi.fn(async () => ({ userId: 'test' })),
  json: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'cache-control': 'no-store' } }),
}))
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })
it('disables the legacy AniList resolver without any upstream request', async () => {
  vi.stubEnv('ANILIST_ENABLED', 'false')
  vi.stubEnv('TMDB_API_KEY', 'test')
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"data":{"Media":null}}'))
  const response = await GET(new Request('http://localhost/api/v1/resolve?source=anilist&id=101'))
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: 'AniList integration is disabled.' })
  expect(fetcher).not.toHaveBeenCalled()
})