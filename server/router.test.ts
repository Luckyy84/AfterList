// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import router from '../api/router'

vi.mock('./api/search.js', () => ({ GET: echo('search') }))
vi.mock('./api/details.js', () => ({ GET: echo('details') }))
vi.mock('./api/discover.js', () => ({ GET: echo('discover') }))
vi.mock('./api/anilist.js', () => ({ GET: echo('anilist') }))
vi.mock('./api/catalog.js', () => ({ GET: echo('catalog') }))
vi.mock('./api/account/avatar.js', () => ({ POST: echo('account/avatar'), DELETE: echo('account/avatar') }))
vi.mock('./api/account/delete.js', () => ({ DELETE: echo('account/delete') }))
vi.mock('./api/cron/refresh-watchlist.js', () => ({ GET: echo('cron/refresh-watchlist') }))
vi.mock('./api/public/profile.js', () => ({ GET: echo('public/profile') }))
vi.mock('./api/public/library.js', () => ({ GET: echo('public/library') }))
vi.mock('./api/public/list.js', () => ({ GET: echo('public/list') }))
vi.mock('./api/v1/tokens.js', () => ({ GET: echo('v1/tokens'), POST: echo('v1/tokens'), DELETE: echo('v1/tokens') }))
vi.mock('./api/v1/watchlist.js', () => ({ GET: echo('v1/watchlist'), PUT: echo('v1/watchlist') }))
vi.mock('./api/v1/resolve.js', () => ({ GET: echo('v1/resolve') }))

function echo(route: string) {
  return async (request: Request) => new Response(JSON.stringify({
    route, method: request.method, url: request.url,
    authorization: request.headers.get('authorization'),
    cookie: request.headers.get('cookie'),
    contentType: request.headers.get('content-type'),
    body: await request.text(),
  }), { status: 202, headers: { 'x-handler': route, 'cache-control': 'no-store' } })
}

afterEach(() => vi.restoreAllMocks())

const endpoints = [
  ['search', 'GET'], ['details', 'GET'], ['discover', 'GET'], ['anilist', 'GET'], ['catalog', 'GET'],
  ['account/avatar', 'POST'], ['account/avatar', 'DELETE'], ['account/delete', 'DELETE'],
  ['cron/refresh-watchlist', 'GET'], ['public/profile', 'GET'], ['public/library', 'GET'], ['public/list', 'GET'],
  ['v1/tokens', 'GET'], ['v1/tokens', 'POST'], ['v1/tokens', 'DELETE'],
  ['v1/watchlist', 'GET'], ['v1/watchlist', 'PUT'], ['v1/resolve', 'GET'],
]

it.each(endpoints)('dispatches %s %s without changing application input', async (route, method) => {
  const params = new URLSearchParams({ __afterlist_route: route, externalId: 'tv:42', q: 'a & b', query: 'Dune', id: 'token-id', source: 'tmdb', operation: 'details', username: 'lucky', slug: 'my-list', force: 'true', status: 'true', updatedAfter: '2026-01-01', path: 'user-value', route: 'user-value' })
  params.append('q', 'second')
  const body = method === 'GET' ? undefined : 'raw upload or JSON body'
  const response = await router.fetch(new Request(`https://test/api/router?${params}`, {
    method, headers: { authorization: 'Bearer unchanged', cookie: 'session=unchanged', 'content-type': 'application/octet-stream' }, body,
  }))
  expect(response.status).toBe(202)
  expect(response.headers.get('x-handler')).toBe(route)
  expect(response.headers.get('cache-control')).toBe('no-store')
  const result = await response.json()
  expect(result).toMatchObject({ route, method, authorization: 'Bearer unchanged', cookie: 'session=unchanged', contentType: 'application/octet-stream', body: body ?? '' })
  const forwarded = new URL(result.url)
  params.delete('__afterlist_route')
  expect(forwarded.pathname).toBe(`/api/${route}`)
  expect([...forwarded.searchParams]).toEqual([...params])
})

it.each(['missing', '_lib/afterlistApi', 'public/_lib', 'search.test', '__proto__', 'constructor', 'toString', 'router', '../account/delete'])('does not expose %s', async (route) => {
  const response = await router.fetch(new Request(`https://test/api/router?__afterlist_route=${encodeURIComponent(route)}`))
  expect(response.status).toBe(404)
  expect(response.headers.get('cache-control')).toBe('no-store')
})

it('rejects absent or ambiguous dispatch fields', async () => {
  for (const query of ['', '__afterlist_route=search&__afterlist_route=v1/tokens']) {
    expect((await router.fetch(new Request(`https://test/api/router?${query}`))).status).toBe(404)
  }
})

it.each(['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'])('returns 405 for unsupported search %s', async (method) => {
  const response = await router.fetch(new Request('https://test/api/router?__afterlist_route=search', { method }))
  expect(response.status).toBe(405)
  expect(response.headers.get('allow')).toBe('GET')
})

it('does not expose extra module exports as methods', async () => {
  expect((await router.fetch(new Request('https://test/api/router?__afterlist_route=v1/tokens', { method: 'PATCH' }))).status).toBe(405)
})
