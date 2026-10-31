import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), enabled: vi.fn(() => true), retry: vi.fn(() => null as number | null) }))

vi.mock('./_lib.js', () => ({
  boundedInteger: (value: string | null, fallback: number, min: number, max: number) => {
    if (value === null) return fallback
    const parsed = Number(value)
    return /^\d+$/.test(value) && parsed >= min && parsed <= max ? parsed : null
  },
  publicJson: (body: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } }),
  publicNotFound: () => new Response(JSON.stringify({ error: 'Public profile not found.' }), { status: 404, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }),
  publicProfilesEnabled: mocks.enabled,
  publicRpc: mocks.rpc,
  rateLimit: mocks.retry,
  validUsername: (value: string) => /^[a-z0-9_]{3,30}$/.test(value),
  validListSlug: (value: string) => value.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
}))

import { GET as getProfile } from './profile'
import { GET as getLibrary } from './library'
import { GET as getList } from './list'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.enabled.mockReturnValue(true)
  mocks.retry.mockReturnValue(null)
})

describe('public profile wrappers', () => {
  it('returns an uncached curated profile', async () => {
    mocks.rpc.mockResolvedValue({ data: { username: 'lucky', displayName: 'Lucky', stats: null, favorites: null, lists: [{ name: 'Public', slug: 'public' }] }, error: null })
    const response = await getProfile(new Request('http://localhost/api/public/profile?username=LUCKY'))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.rpc).toHaveBeenCalledWith('get_public_profile', { p_username: 'lucky' })
  })

  it('uses the same no-store 404 for disabled, missing, and private profiles', async () => {
    mocks.enabled.mockReturnValue(false)
    const disabled = await getProfile(new Request('http://localhost/api/public/profile?username=lucky'))
    mocks.enabled.mockReturnValue(true)
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    const missing = await getProfile(new Request('http://localhost/api/public/profile?username=lucky'))
    expect(disabled.status).toBe(404)
    expect(await disabled.json()).toEqual(await missing.json())
    expect(missing.headers.get('cache-control')).toBe('no-store')
  })

  it('redirects an old public username to the current profile', async () => {
    mocks.rpc.mockResolvedValue({ data: { redirectUsername: 'current_name', username: 'current_name' }, error: null })
    const response = await getProfile(new Request('http://localhost/api/public/profile?username=old_name'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ redirectUsername: 'current_name', username: 'current_name' })
  })

  it('validates library bounds and passes a bounded request to the RPC', async () => {
    const invalid = await getLibrary(new Request('http://localhost/api/public/library?username=lucky&limit=101'))
    expect(invalid.status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
    mocks.rpc.mockResolvedValue({ data: { username: 'lucky', displayName: 'Lucky', items: [{ id: 'tmdb:movie:11', externalId: 'movie:11', source: 'tmdb', title: 'Star Wars', description: 'Public metadata', runtimeMinutes: 121 }] }, error: null })
    const valid = await getLibrary(new Request('http://localhost/api/public/library?username=lucky&limit=25&offset=5'))
    expect(valid.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('get_public_library', { p_username: 'lucky', p_limit: 25, p_offset: 5 })
    const payload = await valid.json()
    expect(payload.items[0]).toMatchObject({ id: 'tmdb:movie:11', description: 'Public metadata', runtimeMinutes: 121 })
    expect(payload.items[0]).not.toHaveProperty('privateNotes')
    expect(payload.items[0]).not.toHaveProperty('mediaId')
  })

  it('validates list slugs and preserves them in public redirects', async () => {
    expect((await getList(new Request('http://localhost/api/public/list?username=lucky&slug=../private'))).status).toBe(400)
    mocks.rpc.mockResolvedValue({ data: { redirectUsername: 'current_name', username: 'current_name', slug: 'my-list' }, error: null })
    const response = await getList(new Request('http://localhost/api/public/list?username=old_name&slug=my-list'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ redirectUsername: 'current_name', slug: 'my-list' })
  })

  it('returns no-store 429 and 503 failures', async () => {
    mocks.retry.mockReturnValue(12)
    const limited = await getProfile(new Request('http://localhost/api/public/profile?username=lucky'))
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('12')
    mocks.retry.mockReturnValue(null)
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'database detail' } })
    const unavailable = await getProfile(new Request('http://localhost/api/public/profile?username=lucky'))
    expect(unavailable.status).toBe(503)
    expect(await unavailable.text()).not.toContain('database detail')
  })
})
