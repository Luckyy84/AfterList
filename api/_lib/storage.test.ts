import { expect, it, vi, beforeEach } from 'vitest'
const s = vi.hoisted(() => ({ rpc: vi.fn(), remove: vi.fn() }))
vi.mock('./afterlistApi.js', () => ({ adminClient: () => ({ rpc: s.rpc, storage: { from: () => ({ remove: s.remove }) } }) }))
import { removeOwnedStorage } from './storage'
beforeEach(() => { s.rpc.mockReset(); s.remove.mockReset().mockResolvedValue({ error: null }) })
it('rechecks inventory after deletion and stops on empty', async () => {
  s.rpc.mockResolvedValueOnce({ data: [{ bucket_id: 'other', name: 'a' }], error: null }).mockResolvedValue({ data: [], error: null })
  await removeOwnedStorage('owner')
  expect(s.remove).toHaveBeenCalledWith(['a'])
  expect(s.rpc).toHaveBeenCalledTimes(2)
})
it('fails closed on remove failure', async () => {
  s.rpc.mockResolvedValue({ data: [{ bucket_id: 'avatars', name: 'owner/a.webp' }], error: null }); s.remove.mockResolvedValue({ error: new Error('denied') })
  await expect(removeOwnedStorage('owner')).rejects.toThrow('Account remains active')
})
it('fails closed rather than looping forever on an unchanged inventory', async () => {
  s.rpc.mockResolvedValueOnce({ data: [{ bucket_id: 'avatars', name: 'owner/a.webp' }], error: null }).mockResolvedValueOnce({ data: [{ bucket_id: 'avatars', name: 'owner/a.webp' }], error: null }).mockRejectedValue(new Error('test guard: unbounded loop'))
  await expect(removeOwnedStorage('owner')).rejects.toThrow('did not converge')
})
