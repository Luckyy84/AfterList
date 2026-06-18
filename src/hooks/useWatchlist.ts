import { useState, useEffect } from 'react'
import type { MediaItem, MediaSource, MediaStatus } from '../types/media'
import { areSameMediaEntry, dedupeMediaItems } from '../utils/media'

type LegacyMediaSource = MediaSource | 'demo' | 'mock-api'

type LegacyMediaItem = Omit<MediaItem, 'status' | 'source'> & {
  status: MediaStatus | 'Completed'
  source?: LegacyMediaSource
}

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
  const savedItems = localStorage.getItem('afterlist_items')

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
  const [items, setItems] = useState<MediaItem[]>(loadSavedItems)

  useEffect(() => {
    localStorage.setItem('afterlist_items', JSON.stringify(items))
  }, [items])

  const handleAddItem = (item: MediaItem) => {
    setItems((prevItems) => {
      const alreadyExists = prevItems.some((existingItem) => areSameMediaEntry(existingItem, item))
      return alreadyExists ? prevItems : [item, ...prevItems]
    })
  }

  const handleRemoveItem = (id: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id))
  }

  const handleUpdateStatus = (id: string, status: MediaStatus) => {
    setItems((prevItems) =>
      prevItems.map((item) => (item.id === id ? { ...item, status } : item)),
    )
  }

  return {
    items,
    handleAddItem,
    handleRemoveItem,
    handleUpdateStatus,
  }
}
