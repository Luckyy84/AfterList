import { useState, useEffect } from 'react'
import { demoItems as initialItems } from '../data/demoItems'
import type { MediaItem } from '../types/media'

export function useWatchlist() {
  const [items, setItems] = useState<MediaItem[]>(() => {
    const savedItems = localStorage.getItem('afterlist_items')
    return savedItems ? JSON.parse(savedItems) : initialItems
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