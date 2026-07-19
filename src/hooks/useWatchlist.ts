import { useEffect, useRef, useState } from 'react'
import type { MediaItem, MediaSource, MediaStatus, MediaUpdate } from '../types/media'
import { useAuth } from '../context/AuthContext'
import {
  createCloudWatchlistItem,
  deleteCloudWatchlistItem,
  fetchCloudWatchlist,
  syncGuestWatchlist,
  updateCloudWatchlistItem,
} from '../services/watchlistItems'
import { supabase } from '../services/supabase'
import { canFetchTmdbDetails, fetchTmdbDetails } from '../services/tmdb'
import { applyMediaUpdate, areSameMediaEntry, dedupeMediaItems, getMediaKey } from '../utils/media'

type LegacyMediaSource = MediaSource | 'demo' | 'mock-api'

type LegacyMediaItem = Omit<MediaItem, 'status' | 'source'> & {
  status: MediaStatus | 'Completed'
  source?: LegacyMediaSource
}

const LOCAL_STORAGE_KEY = 'afterlist_items'
const UNKNOWN_RECENCY_KEY = 'afterlist_items_unknown_recency'
const apiSources = new Set<MediaSource>(['tmdb', 'anilist'])

export function enqueueByKey<T>(queues: Map<string, Promise<unknown>>, key: string, task: () => Promise<T>) {
  const pending = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(task)
  queues.set(key, pending)
  void pending.finally(() => { if (queues.get(key) === pending) queues.delete(key) })
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

export function useWatchlist() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [initialSavedItems] = useState(loadSavedItems)
  const [items, setItems] = useState<MediaItem[]>(initialSavedItems.items)
  const unknownRecencyRef = useRef(initialSavedItems.unknownRecencyKeys)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const loadRequestRef = useRef(0)
  const [syncAttempt, setSyncAttempt] = useState(0)
  const updateQueuesRef = useRef(new Map<string, Promise<unknown>>())
  const updateVersionsRef = useRef(new Map<string, number>())
  const isCloudMode = Boolean(user && supabase)

  useEffect(() => {
    if (isAuthLoading) return undefined

    if (!user || !supabase) {
      const savedItems = loadSavedItems().items
      let isCancelled = false
      queueMicrotask(() => {
        if (isCancelled) return
        setItems(savedItems)
        setIsSyncing(false)
        setSyncError(null)
      })
      return () => { isCancelled = true }
    }

    const requestId = loadRequestRef.current + 1
    loadRequestRef.current = requestId
    let isCancelled = false

    queueMicrotask(() => {
      if (isCancelled) return
      setIsSyncing(true)
      setSyncError(null)
    })

    const localSnapshot = loadSavedItems()
    localSnapshot.unknownRecencyKeys = new Set(unknownRecencyRef.current)
    fetchCloudWatchlist(user.id)
      .then((cloudItems) => syncGuestWatchlist(
        localSnapshot.items,
        cloudItems,
        user.id,
        localSnapshot.unknownRecencyKeys,
      ))
      .then((syncedItems) => {
        if (isCancelled || loadRequestRef.current !== requestId) return
        setItems(dedupeMediaItems(syncedItems))
        localStorage.removeItem(LOCAL_STORAGE_KEY)
        localStorage.removeItem(UNKNOWN_RECENCY_KEY)
      })
      .catch((error) => {
        if (isCancelled || loadRequestRef.current !== requestId) return
        console.error(error)
        setSyncError(error instanceof Error ? error.message : 'Could not load your cloud watchlist.')
        setItems(localSnapshot.items)
      })
      .finally(() => {
        if (isCancelled || loadRequestRef.current !== requestId) return
        setIsSyncing(false)
      })

    return () => {
      isCancelled = true
    }
  }, [isAuthLoading, syncAttempt, user])

  useEffect(() => {
    if (isAuthLoading || isCloudMode) return
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items))
    localStorage.setItem(UNKNOWN_RECENCY_KEY, JSON.stringify([...unknownRecencyRef.current]))
  }, [isAuthLoading, isCloudMode, items])

  const handleAddItem = async (item: MediaItem) => {
    const alreadyExists = items.some((existingItem) => areSameMediaEntry(existingItem, item))
    if (alreadyExists) return

    const optimisticItem = applyMediaUpdate(item, {})
    const detailsPromise = !optimisticItem.runtimeMinutes && canFetchTmdbDetails(optimisticItem)
      ? fetchTmdbDetails(optimisticItem).catch(() => null)
      : null

    if (!user || !supabase) {
      setItems((prevItems) => prevItems.some((existingItem) => areSameMediaEntry(existingItem, optimisticItem)) ? prevItems : [optimisticItem, ...prevItems])
      if (detailsPromise) {
        void detailsPromise.then((details) => {
          if (!details?.runtimeMinutes && !details?.totalEpisodes) return
          setItems((prevItems) => prevItems.map((existingItem) => areSameMediaEntry(existingItem, optimisticItem)
            ? applyMediaUpdate(existingItem, { runtimeMinutes: details.runtimeMinutes, totalEpisodes: details.totalEpisodes })
            : existingItem))
        })
      }
      return
    }

    const key = getMediaKey(optimisticItem) || optimisticItem.id
    const version = (updateVersionsRef.current.get(key) ?? 0) + 1
    updateVersionsRef.current.set(key, version)
    setItems((prevItems) => prevItems.some((existingItem) => areSameMediaEntry(existingItem, optimisticItem)) ? prevItems : [optimisticItem, ...prevItems])
    setIsSyncing(true)
    setSyncError(null)

    await enqueueByKey(updateQueuesRef.current, key, async () => {
      try {
        const details = await detailsPromise
        const itemToCreate = details?.runtimeMinutes || details?.totalEpisodes
          ? applyMediaUpdate(optimisticItem, { runtimeMinutes: details.runtimeMinutes, totalEpisodes: details.totalEpisodes })
          : optimisticItem
        const createdItem = await createCloudWatchlistItem(itemToCreate, user.id)
        setItems((prevItems) => prevItems.map((existingItem) => areSameMediaEntry(existingItem, createdItem) ? createdItem : existingItem))
      } catch (error) {
        const cloudItem = (await fetchCloudWatchlist(user.id).catch(() => []))
          .find((candidate) => areSameMediaEntry(candidate, optimisticItem))
        if (cloudItem) {
          setItems((prevItems) => [cloudItem, ...prevItems.filter((candidate) => !areSameMediaEntry(candidate, cloudItem))])
          return
        }
        console.error(error)
        setSyncError(error instanceof Error ? error.message : 'Could not save this item to your account.')
        if (updateVersionsRef.current.get(key) === version) {
          setItems((prevItems) => prevItems.filter((candidate) => !areSameMediaEntry(candidate, optimisticItem)))
        }
      }
    })

    if (!updateQueuesRef.current.size) setIsSyncing(false)
  }

  const handleRemoveItem = async (id: string) => {
    const removedItem = items.find((item) => item.id === id)
    const key = removedItem ? getMediaKey(removedItem) || id : id
    const version = (updateVersionsRef.current.get(key) ?? 0) + 1
    updateVersionsRef.current.set(key, version)
    setItems((prevItems) => prevItems.filter((item) => item.id !== id))

    if (!user || !supabase) return

    setIsSyncing(true)
    setSyncError(null)

    await enqueueByKey(updateQueuesRef.current, key, async () => {
      try {
        const cloudItem = removedItem
          ? (await fetchCloudWatchlist(user.id)).find((candidate) => areSameMediaEntry(candidate, removedItem))
          : undefined
        if (cloudItem) await deleteCloudWatchlistItem(cloudItem.id, user.id)
        else await deleteCloudWatchlistItem(id, user.id)
      } catch (error) {
        console.error(error)
        setSyncError(error instanceof Error ? error.message : 'Could not remove this item from your account.')
        if (updateVersionsRef.current.get(key) !== version || !removedItem) return
        const cloudItem = (await fetchCloudWatchlist(user.id).catch(() => []))
          .find((candidate) => areSameMediaEntry(candidate, removedItem))
        const restoredItem = cloudItem ?? removedItem
        setItems((prevItems) => prevItems.some((candidate) => areSameMediaEntry(candidate, restoredItem)) ? prevItems : [restoredItem, ...prevItems])
      }
    })

    if (!updateQueuesRef.current.size) setIsSyncing(false)
  }

  const handleUpdateItem = async (id: string, updates: MediaUpdate) => {
    const item = items.find((candidate) => candidate.id === id)
    const key = item ? getMediaKey(item) || id : id
    const version = (updateVersionsRef.current.get(key) ?? 0) + 1
    updateVersionsRef.current.set(key, version)
    if (item) {
      unknownRecencyRef.current.delete(getMediaKey(item))
      localStorage.setItem(UNKNOWN_RECENCY_KEY, JSON.stringify([...unknownRecencyRef.current]))
    }
    setItems((prevItems) => prevItems.map((item) => (item.id === id ? applyMediaUpdate(item, updates) : item)))

    if (!user || !supabase) return

    setIsSyncing(true)
    setSyncError(null)

    await enqueueByKey(updateQueuesRef.current, key, async () => {
      try {
        const cloudItem = item
          ? (await fetchCloudWatchlist(user.id)).find((candidate) => areSameMediaEntry(candidate, item))
          : undefined
        const updatedItem = await updateCloudWatchlistItem(cloudItem?.id ?? id, updates, user.id, cloudItem)
        if (updateVersionsRef.current.get(key) === version) {
          setItems((prevItems) => prevItems.map((candidate) => areSameMediaEntry(candidate, updatedItem) ? updatedItem : candidate))
        }
      } catch (error) {
        console.error(error)
        setSyncError(error instanceof Error ? error.message : 'Could not update this item.')
        if (updateVersionsRef.current.get(key) !== version || !item) return
        const cloudItem = (await fetchCloudWatchlist(user.id).catch(() => []))
          .find((candidate) => areSameMediaEntry(candidate, item))
        if (cloudItem) {
          setItems((prevItems) => prevItems.map((candidate) => areSameMediaEntry(candidate, cloudItem) ? cloudItem : candidate))
        }
      }
    })

    if (!updateQueuesRef.current.size) setIsSyncing(false)
  }

  const handleUpdateStatus = (id: string, status: MediaStatus) => handleUpdateItem(id, { status })

  return {
    items,
    isCloudMode,
    isSyncing,
    syncError,
    retrySync: () => setSyncAttempt((attempt) => attempt + 1),
    handleAddItem,
    handleRemoveItem,
    handleUpdateStatus,
    handleUpdateItem,
  }
}
