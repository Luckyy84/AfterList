import { expect, it, vi } from 'vitest'
import { saveCustomListItems, reorderCustomLists } from './mediaLibrary'
const db = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: db }))
it('saves an ordered bulk selection atomically and rejects duplicates', async () => {
  db.rpc.mockResolvedValue({ data: ['a', 'b'], error: null })
  await saveCustomListItems('list', ['b', 'a'])
  expect(db.rpc).toHaveBeenCalledWith('save_custom_list_items', { p_list_id: 'list', p_item_ids: ['b', 'a'] })
  await expect(saveCustomListItems('list', ['a', 'a'])).rejects.toThrow('Duplicate')
  await reorderCustomLists(['second', 'first'])
  expect(db.rpc).toHaveBeenCalledWith('reorder_custom_lists', { p_list_ids: ['second', 'first'] })
})
