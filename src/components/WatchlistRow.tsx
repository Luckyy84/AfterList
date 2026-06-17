import { useMemo, useRef } from 'react'
import { motion } from 'motion/react'
import MediaCard from './MediaCard'
import type { MediaItem } from '../types/media'

type WatchlistRowProps = {
  title: string
  items: MediaItem[]
  onSelect: (item: MediaItem) => void
}

const getUniqueItems = (items: MediaItem[]) => {
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

export default function WatchlistRow({ title, items, onSelect }: WatchlistRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null)
  const uniqueItems = useMemo(() => getUniqueItems(items), [items])

  if (uniqueItems.length === 0) return null

  const scrollRow = (direction: 'left' | 'right') => {
    const row = rowRef.current
    if (!row) return

    const card = row.querySelector<HTMLElement>('.media-card-wrapper')
    const cardWidth = card?.offsetWidth ?? 180
    const gap = 22
    const scrollAmount = (cardWidth + gap) * 3

    row.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  return (
    <motion.section
      className="watchlist-row"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="row-head">
        <h2>{title}</h2>
        <span>{uniqueItems.length} items</span>
      </div>

      <div className="row-scroll-shell">
        <button
          className="row-scroll-button row-scroll-button-left"
          type="button"
          aria-label={`Scroll ${title} left`}
          onClick={() => scrollRow('left')}
        >
          ‹
        </button>

        <div className="row-scroll" ref={rowRef}>
          {uniqueItems.map((item) => (
            <MediaCard key={item.id} item={item} onSelect={onSelect} />
          ))}
        </div>

        <button
          className="row-scroll-button row-scroll-button-right"
          type="button"
          aria-label={`Scroll ${title} right`}
          onClick={() => scrollRow('right')}
        >
          ›
        </button>

        <div className="row-fade row-fade-left" aria-hidden="true" />
        <div className="row-fade row-fade-right" aria-hidden="true" />
      </div>
    </motion.section>
  )
}
