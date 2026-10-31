import { expect, it, vi } from 'vitest'
import { fetchWatchActivity } from './mediaLibrary'
const db = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: db }))
it('counts the complete activity window in the database instead of a 50-event sample', async () => {
  db.rpc.mockResolvedValue({ data: { totalEvents: 150, updates: 120, activeDays: 10 }, error: null })
  expect((await fetchWatchActivity(30)).totalEvents).toBe(150)
  expect(db.rpc).toHaveBeenCalledWith('get_watch_activity', { p_days: 30 })
})
