import type { MediaItem } from '../types/media'
import { getMediaKey } from '../utils/media'
export type QueuedEdit = { item: MediaItem; removed: boolean; token: string; attempts: number }
const key = (owner: string) => `afterlist_queue:${owner}`
export function clearOwnerQueue(owner: string) {
 localStorage.removeItem(key(owner))
}
export function readQueue(owner: string): QueuedEdit[] {
 let value: unknown
 try { value = JSON.parse(localStorage.getItem(key(owner)) ?? '[]') } catch { throw new Error('Offline edit storage is corrupt. Keep a backup before clearing it.') }
 if (!Array.isArray(value) || value.some((edit) => !edit?.item?.externalId || !['tmdb','anilist'].includes(edit?.item?.source) || typeof edit.token !== 'string' || typeof edit.removed !== 'boolean' || !Number.isInteger(edit.attempts) || edit.attempts < 0)) throw new Error('Offline edit storage is corrupt. Keep a backup before clearing it.')
 return value
}
export function resetQueueRetries(owner: string) {
 localStorage.setItem(key(owner), JSON.stringify(readQueue(owner).map((edit) => ({...edit,attempts:0}))))
}
const active = new Map<string, Promise<void>>()
export function replayQueue(owner: string, send: (edit: QueuedEdit) => Promise<unknown>): Promise<void> {
 const running = active.get(owner)
 if (running) return running
 const task = (async () => {
  for (const edit of readQueue(owner)) {
   if (edit.attempts >= 3) throw new Error('Offline edits need attention. Edit the item to retry.')
   const current = readQueue(owner)
   localStorage.setItem(key(owner), JSON.stringify(current.map((e) => e.token === edit.token ? {...e, attempts:e.attempts+1} : e)))
   await send(edit)
   if (localStorage.getItem(key(owner)) === null) return
   localStorage.setItem(key(owner), JSON.stringify(readQueue(owner).filter((e) => e.token !== edit.token)))
  }
 })()
 active.set(owner, task)
 void task.then(() => active.delete(owner), () => active.delete(owner))
 return task
}
export function stageEdit(owner: string, item: MediaItem, removed: boolean) {
 const edits = readQueue(owner).filter((e) => getMediaKey(e.item) !== getMediaKey(item))
 edits.push({item, removed, token:crypto.randomUUID(), attempts:0})
 localStorage.setItem(key(owner), JSON.stringify(edits))
}
