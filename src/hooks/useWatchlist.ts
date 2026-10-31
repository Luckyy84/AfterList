import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MediaItem, MediaSource, MediaStatus, MediaUpdate } from '../types/media'
import { useAuth } from '../context/AuthContext'
import { fetchCloudWatchlist } from '../services/watchlistItems'
import { readQueue, stageEdit, replayQueue, resetQueueRetries } from '../services/watchlistQueue'
import { supabase } from '../services/supabase'
import { canFetchTmdbDetails, fetchTmdbDetails } from '../services/tmdb'
import { applyMediaUpdate, areSameMediaEntry, dedupeMediaItems, getMediaKey, mergeWatchlists } from '../utils/media'

type LegacyMediaSource = MediaSource | 'demo' | 'mock-api'

type LegacyMediaItem = Omit<MediaItem, 'status' | 'source'> & {
  status: MediaStatus | 'Completed'
  source?: LegacyMediaSource
}

const LOCAL_STORAGE_KEY = 'afterlist_items'
const UNKNOWN_RECENCY_KEY = 'afterlist_items_unknown_recency'
const EMPTY_ITEMS: MediaItem[] = []
const apiSources = new Set<MediaSource>(['tmdb', 'anilist'])

export function enqueueByKey<T>(queues: Map<string, Promise<unknown>>, key: string, task: () => Promise<T>) {
  const pending = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(task)
  queues.set(key, pending)
  void pending.then(() => { if (queues.get(key) === pending) queues.delete(key) }, () => { if (queues.get(key) === pending) queues.delete(key) })
  return pending
}

function isApiMediaItem(item: unknown): item is LegacyMediaItem & { source: MediaSource; externalId: string } {
  if (!item || typeof item !== 'object') return false

  const candidate = item as LegacyMediaItem
  return Boolean(candidate.externalId && candidate.source && apiSources.has(candidate.source as MediaSource))
}

function migrateItem(item: LegacyMediaItem & { source: MediaSource; externalId: string }, now: string): MediaItem {
  return {
    ...item,
    status: item.status === 'Completed' ? 'Watched' : item.status,
    currentEpisode: item.currentEpisode ?? 0,
    personalRating: item.personalRating ?? null,
    isRewatching: item.isRewatching ?? false,
    rewatchCount: item.rewatchCount ?? 0,
    startedAt: item.startedAt ?? null,
    completedAt: item.completedAt ?? null,
    privateNotes: item.privateNotes ?? '',
    isFavorite: item.isFavorite ?? false,
    updatedAt: item.updatedAt ?? now,
  }
}

export function parseSavedItems(savedItems: string | null, now = new Date().toISOString()) {
  const empty = { items: [] as MediaItem[], unknownRecencyKeys: new Set<string>() }
  if (!savedItems) return empty

  try {
    const parsedItems: unknown = JSON.parse(savedItems)
    if (!Array.isArray(parsedItems)) return empty
    const validItems = parsedItems.filter(isApiMediaItem)
    return {
      items: dedupeMediaItems(validItems.map((item) => migrateItem(item, now))),
      unknownRecencyKeys: new Set(validItems.filter((item) => !item.updatedAt).map(getMediaKey)),
    }
  } catch {
    return empty
  }
}

function loadSavedItems() {
  const savedItems = localStorage.getItem(LOCAL_STORAGE_KEY)
  const parsed = parseSavedItems(savedItems)
  try {
    const storedUnknown: unknown = JSON.parse(localStorage.getItem(UNKNOWN_RECENCY_KEY) ?? '[]')
    if (Array.isArray(storedUnknown)) storedUnknown.forEach((key) => parsed.unknownRecencyKeys.add(String(key)))
  } catch {
    localStorage.removeItem(UNKNOWN_RECENCY_KEY)
  }
  return parsed
}

export function applyLocalEdit(item:MediaItem, updates:MediaUpdate, now=Date.now()) {
  return applyMediaUpdate(item,updates,new Date(Math.max(now,(Date.parse(item.updatedAt ?? '') || 0)+1)).toISOString())
}

export function useWatchlist() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const owner = user?.id ?? null
  const ownerRef = useRef(owner)
  useLayoutEffect(() => { ownerRef.current = owner }, [owner])
  const [state, setState] = useState<{owner:string|null; items:MediaItem[]}>({owner:null, items:loadSavedItems().items})
  const items = state.owner === owner ? state.items : EMPTY_ITEMS
  const itemsRef = useRef(items)
  useLayoutEffect(() => { itemsRef.current = items }, [items])
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string|null>(null)
  const [syncAttempt, setSyncAttempt] = useState(0)
  const isCloudMode = Boolean(owner && supabase)
  const overlay = (cloud:MediaItem[], id:string) => {
    let result = cloud
    for (const edit of readQueue(id)) {
      result = result.filter((item) => !areSameMediaEntry(item, edit.item))
      if (!edit.removed) result.push(edit.item)
    }
    return dedupeMediaItems(result)
  }
  const flush = async (id:string) => {
    const client = supabase
    if (!client) return
    for (let batch=0;batch<10;batch++) {
    await replayQueue(id, async (edit) => {
      if (ownerRef.current !== id) throw new Error('Account changed. Pending edits retained.')
      const {error} = await client.rpc('apply_browser_watchlist_edit', {p_item:edit.item, p_removed:edit.removed, p_owner:id})
      if (error) throw new Error(error.code === 'PGRST202' || error.code === '42883'
        ? 'Systems reliability migration needed. Your edits are saved on this browser.'
        : 'Could not sync. Your edits are saved on this browser; retry when online.')
    })
    if (!readQueue(id).length) return
    }
    throw new Error('More edits are pending. Retry sync to continue.')
  }
  useEffect(() => {
    if (isAuthLoading) return
    let cancelled = false
    const run = async () => {
      if (!owner || !supabase) {
        setState({owner:null,items:loadSavedItems().items})
        setIsSyncing(false)
        setSyncError(null)
        return
      }
      setIsSyncing(true)
      setSyncError(null)
      const guest = loadSavedItems()
      try {
        let cloud: MediaItem[] = await fetchCloudWatchlist(owner)
        if (cancelled) return
        if (guest.items.length) {
          const pendingKeys = new Set(readQueue(owner).map((edit) => getMediaKey(edit.item)))
          for (const item of mergeWatchlists(guest.items,cloud,guest.unknownRecencyKeys)) {
            const existing = cloud.find((candidate) => areSameMediaEntry(candidate,item))
            if ((!existing || existing.updatedAt !== item.updatedAt) && !pendingKeys.has(getMediaKey(item))) stageEdit(owner,item,false)
          }
          localStorage.removeItem(LOCAL_STORAGE_KEY)
          localStorage.removeItem(UNKNOWN_RECENCY_KEY)
        }
        setState({owner,items:overlay(cloud, owner)})
        await flush(owner)
        cloud = await fetchCloudWatchlist(owner)
        if (!cancelled) setState({owner,items:overlay(cloud, owner)})
      } catch (error) {
        if (!cancelled) {
          let recovered: MediaItem[] = []
          try { recovered = overlay(itemsRef.current,owner) } catch { /* Preserve corrupt storage for recovery; report original error below. */ }
          setState({owner,items:recovered})
          setSyncError(error instanceof Error ? error.message : 'Could not sync your watchlist.')
        }
      } finally { if (!cancelled) setIsSyncing(false) }
    }
    void run()
    const retry = () => setSyncAttempt((n) => n+1)
    window.addEventListener('online', retry)
    return () => { cancelled=true; window.removeEventListener('online', retry) }
    // Owner identity, not auth object identity, controls replay.
  }, [owner, isAuthLoading, syncAttempt])
  const save = async (item:MediaItem, removed=false) => {
    try {
      if (owner && supabase) stageEdit(owner,item,removed)
      const next = itemsRef.current.filter((candidate) => !areSameMediaEntry(candidate,item))
      if (!removed) next.unshift(item)
      if (!owner) {
        const unknown = loadSavedItems().unknownRecencyKeys
        unknown.delete(getMediaKey(item))
        localStorage.setItem(UNKNOWN_RECENCY_KEY,JSON.stringify([...unknown]))
        localStorage.setItem(LOCAL_STORAGE_KEY,JSON.stringify(next))
      }
      itemsRef.current=next
      setState({owner,items:next})
      if (!owner || !supabase) return
      setIsSyncing(true)
      setSyncError(null)
      await flush(owner)
      if (ownerRef.current !== owner) return
      const cloud = await fetchCloudWatchlist(owner)
      if (ownerRef.current === owner) setState({owner,items:overlay(cloud,owner)})
    } catch (error) {
      if (ownerRef.current === owner) setSyncError(error instanceof Error ? error.message : 'Could not save edits on this browser.')
    } finally { if (ownerRef.current === owner) setIsSyncing(false) }
  }
  const handleAddItem = async (item:MediaItem) => {
    if (itemsRef.current.some((candidate) => areSameMediaEntry(candidate,item))) return
    await save(applyLocalEdit(item,{}))
    if (!item.runtimeMinutes && canFetchTmdbDetails(item)) {
      const details = await fetchTmdbDetails(item).catch(() => null)
      if (ownerRef.current !== owner || !details) return
      const current = itemsRef.current.find((candidate) => areSameMediaEntry(candidate,item))
      if (current && (details.runtimeMinutes || details.totalEpisodes)) await save(applyLocalEdit(current, {runtimeMinutes:details.runtimeMinutes,totalEpisodes:details.totalEpisodes}))
    }
  }
  const handleUpdateItem = async (id:string, updates:MediaUpdate) => {
    const item=itemsRef.current.find((candidate) => candidate.id===id)
    if (item) await save(applyLocalEdit(item,updates))
  }
  const handleRemoveItem = async (id:string) => {
    const item=itemsRef.current.find((candidate) => candidate.id===id)
    if (item) await save(applyLocalEdit(item,{}),true)
  }
  return {items,isCloudMode,isSyncing,syncError,retrySync:() => { if(owner) resetQueueRetries(owner); setSyncAttempt((n) => n+1) },handleAddItem,handleRemoveItem,
    handleUpdateItem,handleUpdateStatus:(id:string,status:MediaStatus) => handleUpdateItem(id,{status})}
}
