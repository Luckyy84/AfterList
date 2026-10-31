import { expect, it, vi } from 'vitest'
import { saveSeasonProgress } from './mediaLibrary'
const db = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: db }))
it('saves bounded season progress through the atomic owner RPC', async () => {
  db.rpc.mockResolvedValue({ data: { season: 2, current_episode: 5 }, error: null })
  await saveSeasonProgress('title', 2, 5, 12)
  expect(db.rpc).toHaveBeenCalledWith('save_season_progress', { p_item_id: 'title', p_season: 2, p_current: 5, p_total: 12 })
  await expect(saveSeasonProgress('title', 2, 13, 12)).rejects.toThrow('Invalid season progress')
})
