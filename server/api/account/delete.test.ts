import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ cleanup: vi.fn(async () => {}), password: 'correct', deletes: vi.fn(), rpc: vi.fn(async () => ({ data: true, error: null })) }))
vi.mock('../_lib/storage.js', () => ({ removeOwnedStorage: state.cleanup }))
vi.mock('../_lib/afterlistApi.js', () => ({ authenticateUser: async () => ({ id: 'owner', email: 'owner@test.invalid' }), adminClient: () => { let signedIn = false; return { rpc: state.rpc, auth: { signInWithPassword: async ({ password }: { password: string }) => { signedIn = true; return { data: { user: password === state.password ? { id: 'owner' } : null }, error: password === state.password ? null : new Error('wrong') } }, admin: { deleteUser: async (id: string) => { if (signedIn) throw new Error('Reauth session leaked into admin client'); return state.deletes(id) } } } } }, json: (body: unknown, status = 200) => Response.json(body, { status }) }))
import { DELETE } from './delete'
const request = (body: unknown) => new Request('https://app.test/api/account/delete', { method: 'DELETE', body: JSON.stringify(body) })
beforeEach(() => { state.deletes.mockReset().mockResolvedValue({ error: null }); state.rpc.mockReset().mockResolvedValue({ data: true, error: null }) })
it('requires deliberate confirmation before attempting deletion', async () => { expect((await DELETE(request({ confirmation: 'yes', password: 'correct' }))).status).toBe(400); expect(state.deletes).not.toHaveBeenCalled() })
it('rejects wrong current password even with a valid session', async () => { expect((await DELETE(request({ confirmation: 'DELETE', password: 'wrong' }))).status).toBe(403); expect(state.deletes).not.toHaveBeenCalled() })
it('blocks deletion while reauthentication is throttled', async () => {
  state.rpc.mockResolvedValue({ data: false, error: null })
  expect((await DELETE(request({ confirmation: 'DELETE', password: 'correct' }))).status).toBe(429)
  expect(state.deletes).not.toHaveBeenCalled()
})
it('deletes only the authenticated account after fresh server password validation', async () => { expect((await DELETE(request({ confirmation: 'DELETE', password: 'correct' }))).status).toBe(204); expect(state.deletes).toHaveBeenCalledWith('owner'); expect(state.rpc).toHaveBeenCalled() })

it('fails closed before auth deletion if owned storage cleanup fails', async () => {
  state.cleanup.mockRejectedValueOnce(new Error('Apply safe_avatars migration'))
  expect((await DELETE(request({ confirmation: 'DELETE', password: 'correct' }))).status).toBe(503)
  expect(state.deletes).not.toHaveBeenCalled()
})
it('cleans owned storage before auth deletion', async () => {
  await DELETE(request({ confirmation: 'DELETE', password: 'correct' }))
  expect(state.cleanup).toHaveBeenCalledWith('owner')
  expect(state.cleanup.mock.invocationCallOrder.at(-1)!).toBeLessThan(state.deletes.mock.invocationCallOrder.at(-1)!)
})
