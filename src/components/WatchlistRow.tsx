import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import MediaCard from './MediaCard'
import type { MediaItem } from '../types/media'

type WatchlistRowProps = {
  title: string
  items: MediaItem[]
  onSelect: (item: MediaItem) => void
}

const SLIDE_EASE = [0.22, 1, 0.36, 1] as const

export default function WatchlistRow({ title, items, onSelect }: WatchlistRowProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [offset, setOffset] = useState(0)
  const [maxOffset, setMaxOffset] = useState(0)
  const isInfiniteRow = title.toLowerCase() === 'watched' && items.length > 4
  const showScrollControls = !isInfiniteRow && items.length > 4 && maxOffset > 8

  const updateMetrics = useCallback(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track || isInfiniteRow) return

    const nextMaxOffset = Math.max(0, track.scrollWidth - viewport.clientWidth)
    setMaxOffset(nextMaxOffset)
    setOffset((currentOffset) => Math.min(currentOffset, nextMaxOffset))
  }, [isInfiniteRow])

  useLayoutEffect(() => {
    if (isInfiniteRow) {
      setOffset(0)
      setMaxOffset(0)
      return
    }

    updateMetrics()

    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    const resizeObserver = new ResizeObserver(updateMetrics)
    resizeObserver.observe(viewport)
    resizeObserver.observe(track)

    return () => resizeObserver.disconnect()
  }, [items.length, isInfiniteRow, updateMetrics])

  if (items.length === 0) return null

  const slideRow = (direction: 'left' | 'right') => {
    const track = trackRef.current
    const card = track?.querySelector<HTMLElement>('.media-card-wrapper')
    const cardWidth = card?.offsetWidth ?? 180
    const gap = 22
    const slideAmount = (cardWidth + gap) * 3

    setOffset((currentOffset) => {
      const nextOffset = direction === 'left' ? currentOffset - slideAmount : currentOffset + slideAmount
      return Math.min(Math.max(nextOffset, 0), maxOffset)
    })
  }

  const renderCards = (setName = 'base') =>
    items.map((item, index) => (
      <MediaCard key={`${setName}-${item.id}-${index}`} item={item} onSelect={onSelect} />
    ))

  return (
    <motion.section
      className={`watchlist-row${isInfiniteRow ? ' watchlist-row-infinite' : ''}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease: SLIDE_EASE }}
    >
      <div className="row-head">
        <h2>{title}</h2>
        <span>{items.length} items</span>
      </div>

      <div className={`row-scroll-shell${showScrollControls ? ' has-scroll-controls' : ''}${isInfiniteRow ? ' is-infinite' : ''}`}>
        {showScrollControls && (
          <button
            className="row-scroll-button row-scroll-button-left"
            type="button"
            aria-label={`Slide ${title} left`}
            disabled={offset <= 0}
            onClick={() => slideRow('left')}
          >
            ‹
          </button>
        )}

        <div className="row-scroll" ref={viewportRef}>
          {isInfiniteRow ? (
            <div className="row-scroll-track row-scroll-track-infinite" ref={trackRef} aria-label={`${title} auto-scrolling list`}>
              <div className="row-scroll-set">{renderCards('loop-a')}</div>
              <div className="row-scroll-set" aria-hidden="true">
                {renderCards('loop-b')}
              </div>
            </div>
          ) : (
            <motion.div
              className="row-scroll-track"
              ref={trackRef}
              animate={{ x: -offset }}
              transition={{ type: 'spring', stiffness: 260, damping: 34, mass: 0.9 }}
            >
              {renderCards()}
            </motion.div>
          )}
        </div>

        {showScrollControls && (
          <>
            <button
              className="row-scroll-button row-scroll-button-right"
              type="button"
              aria-label={`Slide ${title} right`}
              disabled={offset >= maxOffset - 1}
              onClick={() => slideRow('right')}
            >
              ›
            </button>

            <div className="row-fade row-fade-left" aria-hidden="true" />
            <div className="row-fade row-fade-right" aria-hidden="true" />
          </>
        )}
      </div>
    </motion.section>
  )
}
