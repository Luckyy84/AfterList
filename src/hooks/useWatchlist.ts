import { useState, useEffect } from 'react'
import { demoItems as initialItems } from '../data/demoItems'
import type { MediaItem } from '../types/media'

const dedupeItems = (items: MediaItem[]) => {
  const seen = new Set<string>()

  return items.filter((item) => {
    const key = item.id || `${item.title}-${item.type}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export function useWatchlist() {
  const [items, setItems] = useState<MediaItem[]>(() => {
    const savedItems = localStorage.getItem('afterlist_items')
    const parsedItems = savedItems ? (JSON.parse(savedItems) as MediaItem[]) : initialItems

    return dedupeItems(parsedItems)
  })

  useEffect(() => {
    localStorage.setItem('afterlist_items', JSON.stringify(items))
  }, [items])

  const handleRemoveItem = (id: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id))
  }

  return {
    items,
    handleRemoveItem,
  }
}
