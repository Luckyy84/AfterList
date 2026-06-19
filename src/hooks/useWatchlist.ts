import { useEffect, useRef, useState } from 'react'
import type { MediaItem, MediaSource, MediaStatus } from '../types/media'
import { useAuth } from '../context/auth'
import {
  createCloudWatchlistItem,
  deleteCloudWatchlistItem,
  fetchCloudWatchlist,
  updateCloudWatchlistItemStatus,
} from '../services/watchlistItems'
import { supabase } from '../services/supabase'
import { areSameMediaEntry, dedupeMediaItems } from '../utils/media'

type LegacyMediaSource = MediaSource | 'demo' | 'mock-api'

type LegacyMediaItem = Omit<MediaItem, 'status' | 'source'> & {
  status: MediaStatus | 'Completed'
  source?: LegacyMediaSource
}

const LOCAL_STORAGE_KEY = 'afterlist_items'
const apiSources = new Set<MediaSource>(['tmdb', 'anilist'])

function isApiMediaItem(item: unknown): item is LegacyMediaItem & { source: MediaSource; externalId: string } {
  if (!item || typeof item !== 'object') return false

  const candidate = item as LegacyMediaItem
  return Boolean(candidate.externalId && candidate.source && apiSources.has(candidate.source as MediaSource))
}

function migrateStatus(item: LegacyMediaItem & { source: MediaSource; externalId: string }): MediaItem {
  return {
    ...item,
    status: item.status === 'Completed' ? 'Watched' : item.status,
  }
}

function loadSavedItems(): MediaItem[] {
  const savedItems = localStorage.getItem(LOCAL_STORAGE_KEY)

  if (!savedItems) return []

  try {
    const parsedItems = JSON.parse(savedItems)

    if (!Array.isArray(parsedItems)) return []

    return dedupeMediaItems(parsedItems.filter(isApiMediaItem).map(migrateStatus))
  } catch {
    return []
  }
}

export function useWatchlist() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [items, setItems] = useState<MediaItem[]>(loadSavedItems)
  const [pendingMutationCount, setPendingMutationCount] = useState(0)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [hydratedSource, setHydratedSource] = useState<string | null>(() => (!isAuthLoading && !user ? 'local' : null))
  const loadRequestRef = useRef(0)
  const isCloudMode = Boolean(user && supabase)
  const expectedSource = isCloudMode ? user?.id ?? null : 'local'
  const isHydrating = isAuthLoading || hydratedSource !== expectedSource
  const visibleItems = isHydrating ? [] : items
  const isSyncing = pendingMutationCount > 0

  useEffect(() => {
    if (isAuthLoading) return undefined

    if (!user || !supabase) {
      const requestId = loadRequestRef.current + 1
      loadRequestRef.current = requestId
      let isCancelled = false

      queueMicrotask(() => {
        if (isCancelled || loadRequestRef.current !== requestId) return
        setItems(loadSavedItems())
        setSyncError(null)
        setHydratedSource('local')
      })

      return () => {
        isCancelled = true
      }
    }

    const requestId = loadRequestRef.current + 1
    loadRequestRef.current = requestId
    let isCancelled = false

    queueMicrotask(() => {
      if (isCancelled || loadRequestRef.current !== requestId) return
      setSyncError(null)
    })

    fetchCloudWatchlist(user.id)
      .then((cloudItems) => {
        if (isCancelled || loadRequestRef.current !== requestId) return
        setItems(dedupeMediaItems(cloudItems))
      })
      .catch((error) => {
        if (isCancelled || loadRequestRef.current !== requestId) return
        console.error(error)
        setSyncError(error instanceof Error ? error.message : 'Could not load your cloud watchlist.')
        setItems([])
      })
      .finally(() => {
        if (isCancelled || loadRequestRef.current !== requestId) return
        setHydratedSource(user.id)
      })

    return () => {
      isCancelled = true
    }
  }, [isAuthLoading, user])

  useEffect(() => {
    if (isAuthLoading || isCloudMode || hydratedSource !== 'local') return
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items))
  }, [hydratedSource, isAuthLoading, isCloudMode, items])

  const handleAddItem = async (item: MediaItem) => {
    if (isHydrating) {
      setSyncError('Wait for your watchlist to finish loading before making changes.')
      return
    }

    const alreadyExists = visibleItems.some((existingItem) => areSameMediaEntry(existingItem, item))
    if (alreadyExists) return

    if (!user || !supabase) {
      setItems((prevItems) => [item, ...prevItems])
      return
    }

    setPendingMutationCount((count) => count + 1)
    setSyncError(null)

    try {
      const createdItem = await createCloudWatchlistItem(item, user.id)
      setItems((prevItems) => {
        const stillExists = prevItems.some((existingItem) => areSameMediaEntry(existingItem, createdItem))
        return stillExists ? prevItems : [createdItem, ...prevItems]
      })
    } catch (error) {
      console.error(error)
      setSyncError(error instanceof Error ? error.message : 'Could not save this item to your account.')
    } finally {
      setPendingMutationCount((count) => Math.max(0, count - 1))
    }
  }

  const handleRemoveItem = async (id: string) => {
    if (isHydrating) {
      setSyncError('Wait for your watchlist to finish loading before making changes.')
      return
    }

    const previousItems = items
    setItems((prevItems) => prevItems.filter((item) => item.id !== id))

    if (!user || !supabase) return

    setPendingMutationCount((count) => count + 1)
    setSyncError(null)

    try {
      await deleteCloudWatchlistItem(id, user.id)
    } catch (error) {
      console.error(error)
      setSyncError(error instanceof Error ? error.message : 'Could not remove this item from your account.')
      setItems(previousItems)
    } finally {
      setPendingMutationCount((count) => Math.max(0, count - 1))
    }
  }

  const handleUpdateStatus = async (id: string, status: MediaStatus) => {
    if (isHydrating) {
      setSyncError('Wait for your watchlist to finish loading before making changes.')
      return
    }

    const previousItems = items
    setItems((prevItems) => prevItems.map((item) => (item.id === id ? { ...item, status } : item)))

    if (!user || !supabase) return

    setPendingMutationCount((count) => count + 1)
    setSyncError(null)

    try {
      const updatedItem = await updateCloudWatchlistItemStatus(id, status, user.id)
      setItems((prevItems) => prevItems.map((item) => (item.id === id ? updatedItem : item)))
    } catch (error) {
      console.error(error)
      setSyncError(error instanceof Error ? error.message : 'Could not update this item.')
      setItems(previousItems)
    } finally {
      setPendingMutationCount((count) => Math.max(0, count - 1))
    }
  }

  return {
    items: visibleItems,
    isCloudMode,
    isHydrating,
    isSyncing,
    syncError,
    handleAddItem,
    handleRemoveItem,
    handleUpdateStatus,
  }
}
