// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import router from '../api/router'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

it.each([
  ['account/avatar', 'POST'], ['account/avatar', 'DELETE'], ['account/delete', 'DELETE'],
  ['v1/tokens', 'GET'], ['v1/tokens', 'POST'], ['v1/tokens', 'DELETE'],
  ['v1/watchlist', 'GET'], ['v1/watchlist', 'PUT'], ['v1/resolve', 'GET'],
  ['cron/refresh-watchlist', 'GET'],
])('keeps real %s %s authentication even on direct router requests', async (route, method) => {
  vi.stubEnv('CRON_SECRET', 'not-a-client-value')
  const fetcher = vi.fn(() => { throw new Error('Unauthenticated request reached a service') })
  vi.stubGlobal('fetch', fetcher)
  const response = await router.fetch(new Request(`https://test/api/router?__afterlist_route=${route}&force=true&user_id=admin&authenticated=true`, { method }))
  expect(response.status).toBe(401)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(fetcher).not.toHaveBeenCalled()
})

it('keeps the public-profile feature gate on real handlers', async () => {
  vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'false')
  for (const route of ['public/profile', 'public/library', 'public/list']) {
    expect((await router.fetch(new Request(`https://test/api/router?__afterlist_route=${route}&username=lucky`))).status).toBe(404)
  }
})

it('ships only one Vercel entry point and forwards wildcard paths without consuming application parameters', () => {
  const root = new URL('../', import.meta.url)
  expect(readdirSync(new URL('api/', root), { recursive: true }).filter(name => /\.(ts|js|mjs|cjs)$/.test(String(name)))).toEqual(['router.ts'])
  const config = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'))
  expect(config.rewrites[0]).toEqual({ source: '/api/:__afterlist_route*', destination: '/api/router?__afterlist_route=:__afterlist_route*' })
  expect(config.crons.every((cron: { path: string }) => cron.path === '/api/cron/refresh-watchlist')).toBe(true)
  const ignore = readFileSync(new URL('.vercelignore', root), 'utf8')
  expect(ignore.split('\n')).toContain('**/*.test.ts')
  expect(ignore.split('\n')).toContain('test-results/')
})
