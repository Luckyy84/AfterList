import { expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ error: null as { code: string } | null }))
const insert = vi.fn((row: unknown) => { void row; return { select: () => ({ single: async () => ({ data: {}, error: state.error }) }) } })
vi.mock('../_lib/afterlistApi.js', () => ({ authenticateUser: async () => ({ id: 'owner' }), adminClient: () => ({ from: () => ({ insert }) }), generateToken: () => 'secret', hashToken: () => 'hash', json: (body: unknown, status = 200) => Response.json(body, { status }) }))
import { POST } from './tokens'
it('issues explicitly selected read-only scopes', async () => {
  const response = await POST(new Request('https://app.test/api/v1/tokens', { method: 'POST', body: JSON.stringify({ name: 'Reader', scopes: ['watchlist:read'] }) }))
  expect(response.status).toBe(201)
  expect(insert.mock.calls[0]?.[0]).toMatchObject({ scopes: ['watchlist:read'] })
})
it('rejects empty, duplicate and unknown scopes', async () => {
  for (const scopes of [[], ['admin'], ['watchlist:read', 'watchlist:read']]) {
    expect((await POST(new Request('https://app.test/api/v1/tokens', { method: 'POST', body: JSON.stringify({ name: 'Reader', scopes }) }))).status).toBe(400)
  }
})
it('returns actionable migration-needed errors without exposing a generated token', async () => {
  state.error = { code: 'PGRST205' }
  const response = await POST(new Request('https://app.test/api/v1/tokens', { method: 'POST', body: JSON.stringify({ name: 'Reader' }) }))
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: expect.stringMatching(/migration/i) })
  state.error = null
})
