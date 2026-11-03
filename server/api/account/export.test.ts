import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ calls: [] as Array<{ table: string; columns: string; owner: string; start: number }>, fail: '', authenticated: true, paged: false }))
vi.mock('../_lib/afterlistApi.js', () => ({
 authenticateUser: async () => state.authenticated ? { id: 'a', email: 'a@test.invalid', created_at: 'today', access_token: 'secret' } : null,
 json: (body: unknown, status = 200) => Response.json(body, { status }),
 adminClient: () => ({ from: (table: string) => ({ select: (columns: string) => ({ eq: (_: string, owner: string) => { const query = { order: () => query, range: async (start: number) => {
 state.calls.push({ table, columns, owner, start })
 return { data: state.paged && table === 'watchlist_items' && start < 1000 ? Array.from({ length: 500 }, (_, i) => ({ user_id: owner, id: start + i })) : start === 0 ? [{ user_id: owner, id: table }] : [], error: state.fail === table ? new Error('unavailable') : null }
 } }; return query } }) }) }),
}))
import { GET } from './export'
const request = () => new Request('https://app.test/api/account/export?user_id=b')
beforeEach(() => { state.calls = []; state.fail = ''; state.authenticated = true; state.paged = false })
it('paginates beyond server row caps without truncating a full final page', async () => {
 state.paged = true
 const result = await (await GET(request())).json()
 expect(result.records.watchlist_items).toHaveLength(1000)
 expect(state.calls.filter(call => call.table === 'watchlist_items').map(call => call.start)).toEqual([0, 500, 1000])
})
it('exports every owner table, never caller-supplied ownership or credentials', async () => {
 const response = await GET(request()); const result = await response.json()
 expect(response.status).toBe(200)
 expect(Object.keys(result.records)).toEqual(['watchlist_items','profiles','custom_lists','custom_list_items','watchlist_events','season_progress','user_media_alias_links','user_media_match_decisions','media_match_audit','anime_season_matches','username_history','watchlist_tombstones','api_tokens'])
 expect(state.calls.every(call => call.owner === 'a')).toBe(true)
 expect(state.calls.find(call => call.table === 'api_tokens')?.columns).toBe('id,name,scopes,created_at,last_used_at,expires_at,revoked_at')
 expect(JSON.stringify(result)).not.toContain('secret')
 expect(result.account).toEqual({ id: 'a', email: 'a@test.invalid', created_at: 'today' })
 expect(response.headers.get('cache-control')).toContain('no-store')
})
it('fails rather than returning an incomplete export', async () => {
 state.fail = 'watchlist_events'; expect((await GET(request())).status).toBe(503)
})
it('requires authentication before reading owner records', async () => {
 state.authenticated = false; expect((await GET(request())).status).toBe(401); expect(state.calls).toEqual([])
})
