import { beforeEach, describe, expect, it, vi } from 'vitest'
import { confirmMediaMatch, rejectMediaMatch } from './mediaLibrary'
import type { MediaItem } from '../types/media'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: mocks }))

const existing: MediaItem = { id: '1', source: 'tmdb', externalId: 'tv:1', title: 'Show', type: 'Anime', status: 'Paused', poster: '', backdrop: '', progress: '2026', year: '2026', rating: '', description: '' }
const candidate: MediaItem = { ...existing, id: '2', source: 'anilist', externalId: '2' }

describe('media match decisions', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { decision: 'ok' }, error: null }) })
  it('confirms through the owner RPC without direct table writes', async () => {
    await confirmMediaMatch(existing, candidate)
    expect(mocks.rpc).toHaveBeenCalledWith('confirm_media_match', expect.objectContaining({ p_left_provider: 'tmdb', p_right_provider: 'anilist' }))
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('records keep-separate through the rejection RPC', async () => {
    await rejectMediaMatch(existing, candidate)
    expect(mocks.rpc).toHaveBeenCalledWith('reject_media_match', expect.objectContaining({ p_left_external_id: 'tv:1', p_right_external_id: '2' }))
  })
})
