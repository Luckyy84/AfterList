import { beforeEach, expect, it, vi } from 'vitest'
import { GET } from './catalog'
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), tmdb: vi.fn(), anilist: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks }))
vi.mock('./details.js', () => ({ GET: mocks.tmdb }))
vi.mock('./anilist.js', () => ({ GET: mocks.anilist }))
beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-only')
  vi.clearAllMocks()
})
it('supports the existing Supabase secret-key configuration for catalog search', async () => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
  vi.stubEnv('SUPABASE_SECRET_KEY', 'server-secret')
  mocks.rpc.mockResolvedValue({ data: [], error: null })
  try {
    const response = await GET(new Request('http://localhost/api/catalog?q=show'))
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('search_media_catalog', { p_query: 'show', p_limit: 30 })
  } finally {
    vi.stubEnv('SUPABASE_SECRET_KEY', '')
  }
})

it('serves fresh shared metadata without fetching the provider again', async () => {
  const record = { payload: { item: { source: 'tmdb', externalId: 'tv:1', title: 'Show' }, details: {} }, refreshed_at: new Date().toISOString() }
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: record, error: null })) }
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); mocks.from.mockReturnValue(query)
  const response = await GET(new Request('http://localhost/api/catalog?source=tmdb&externalId=tv:1'))
  expect(response.status).toBe(200)
  expect((await response.json()).catalog.refreshedAt).toBe(record.refreshed_at)
  expect(mocks.tmdb).not.toHaveBeenCalled()
})

it('returns stale shared metadata when provider refresh is unavailable', async () => {
  const record = { payload: { item: { source: 'tmdb', externalId: 'tv:1', title: 'Show' }, details: {} }, refreshed_at: '2020-01-01T00:00:00Z' }
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: record, error: null })) }
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); mocks.from.mockReturnValue(query)
  mocks.tmdb.mockResolvedValue(new Response('{}', { status: 502 }))
  const response = await GET(new Request('http://localhost/api/catalog?source=tmdb&externalId=tv:1'))
  expect(response.status).toBe(200)
  expect((await response.json()).catalog).toEqual({ status: 'stale', refreshedAt: record.refreshed_at })
})

it('stores only matching provider snapshots and reports refresh provenance', async () => {
  const payload = { item: { source: 'anilist', externalId: '10', title: 'Anime' }, details: {} }
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: null, error: null })), upsert: vi.fn(async () => ({ error: null })) }
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); mocks.from.mockReturnValue(query)
  mocks.anilist.mockResolvedValue(new Response(JSON.stringify(payload)))
  const response = await GET(new Request('http://localhost/api/catalog?source=anilist&externalId=10'))
  expect(response.status).toBe(200)
  expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ provider: 'anilist', external_id: '10', payload }), { onConflict: 'provider,external_id' })
  expect((await response.json()).catalog.status).toBe('fresh')
  mocks.anilist.mockResolvedValue(new Response(JSON.stringify({ ...payload, item: { ...payload.item, externalId: '11' } })))
  query.upsert.mockClear()
  expect((await GET(new Request('http://localhost/api/catalog?source=anilist&externalId=10'))).status).toBe(502)
  expect(query.upsert).not.toHaveBeenCalled()
})
