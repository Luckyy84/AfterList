import { useState, useEffect } from 'react'
import { demoItems as initialItems } from '../data/demoItems'
import type { MediaItem, MediaStatus } from '../types/media'
import { areSameMediaEntry, dedupeMediaItems } from '../utils/media'

type LegacyMediaItem = Omit<MediaItem, 'status'> & {
  status: MediaStatus | 'Completed'
}

function migrateStatus(item: LegacyMediaItem): MediaItem {
  return {
    ...item,
    status: item.status === 'Completed' ? 'Watched' : item.status,
  }
}

function loadSavedItems(): MediaItem[] {
  const savedItems = localStorage.getItem('afterlist_items')

  if (!savedItems) return dedupeMediaItems(initialItems)

  try {
    return dedupeMediaItems((JSON.parse(savedItems) as LegacyMediaItem[]).map(migrateStatus))
  } catch {
    return dedupeMediaItems(initialItems)
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
