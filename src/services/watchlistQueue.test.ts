import { beforeEach, expect, it } from 'vitest'
import { readQueue, stageEdit, replayQueue, resetQueueRetries } from './watchlistQueue'
import type { MediaItem } from '../types/media'
const item = {id:'1',source:'tmdb',externalId:'movie:1',updatedAt:'2026-01-01T00:00:00Z'} as MediaItem
beforeEach(() => localStorage.clear())
it('reports corrupt storage rather than silently discarding unsynced edits', () => {
 localStorage.setItem('afterlist_queue:a','broken')
 expect(() => readQueue('a')).toThrow(/corrupt/i)
 expect(localStorage.getItem('afterlist_queue:a')).toBe('broken')
})
it('persists edits across readers without exposing another owner', () => {
 stageEdit('a', item, false)
 expect(readQueue('a')).toHaveLength(1)
 expect(readQueue('b')).toEqual([])
})
it('retains failed removals and bounds replay attempts', async () => {
 stageEdit('a', item, true)
 let calls = 0
 const send = async () => { calls++; throw new Error('offline') }
 for (let i=0;i<8;i++) await replayQueue('a', send).catch(() => {})
 expect(calls).toBe(3)
 expect(readQueue('a')[0].removed).toBe(true)
})
it('lets an explicit user retry unblock an exhausted removal without changing its timestamp', async () => {
 stageEdit('a',item,true)
 for(let i=0;i<3;i++) await replayQueue('a',async () => {throw new Error('offline')}).catch(() => {})
 resetQueueRetries('a')
 expect(readQueue('a')[0].item.updatedAt).toBe(item.updatedAt)
 await replayQueue('a',async () => {})
 expect(readQueue('a')).toEqual([])
})
it('does not acknowledge an edit replaced while a request is running', async () => {
 stageEdit('a', item, false)
 await replayQueue('a', async () => { stageEdit('a', {...item, updatedAt:'2026-02-01T00:00:00Z'}, true) })
 expect(readQueue('a')).toHaveLength(1)
 expect(readQueue('a')[0].removed).toBe(true)
})
