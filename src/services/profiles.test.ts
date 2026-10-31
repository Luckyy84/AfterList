import { expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ missing: true }))
vi.mock('./supabase', () => ({ supabase: { from: () => ({
  select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: 'PGRST205', message: 'not found' } }) }) }),
  update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: state.missing ? { code: 'PGRST116', message: 'No matching list' } : null }) }) }) }) }),
}) } }))
import { fetchOwnProfile, setCustomListPublic, fetchPublicLibrary, fetchPublicList } from './profiles'
it('explains missing profile schema without pretending the account has no profile', async () => {
  await expect(fetchOwnProfile('owner')).rejects.toThrow(/migration.*environment/i)
})
it('does not report privacy saved when no owned list was updated', async () => {
  await expect(setCustomListPublic('missing', 'owner', false)).rejects.toThrow(/No matching list/)
})
it('requests the selected bounded public page rather than truncating every library at 100', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ items: [] })))
  try {
    await fetchPublicLibrary('reader', undefined, 50)
    expect(fetcher.mock.calls[0][0]).toContain('limit=50&offset=50')
    await fetchPublicList('reader', 'favorites', undefined, 100)
    expect(fetcher.mock.calls[1][0]).toContain('limit=50&offset=100')
  } finally {
    fetcher.mockRestore()
  }
})
