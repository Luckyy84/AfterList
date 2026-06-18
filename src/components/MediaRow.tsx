import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import MediaCard from './MediaCard'
import type { MediaItem } from '../types/media'

type WatchlistRowProps = {
  title: string
  items: MediaItem[]
  onSelect: (item: MediaItem) => void
  hideControls?: boolean
}

const SLIDE_EASE = [0.22, 1, 0.36, 1] as const
const ROW_GAP = 16

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export default function WatchlistRow({ title, items, onSelect, hideControls = false }: WatchlistRowProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const [offset, setOffset] = useState(0)
  const [maxOffset, setMaxOffset] = useState(0)

  const updateMetrics = useCallback(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    const nextMaxOffset = Math.max(0, track.scrollWidth - viewport.clientWidth)

    setMaxOffset(nextMaxOffset)
    setOffset((currentOffset) => clamp(currentOffset, 0, nextMaxOffset))
  }, [])

  useLayoutEffect(() => {
    updateMetrics()

    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    const resizeObserver = new ResizeObserver(updateMetrics)
    resizeObserver.observe(viewport)
    resizeObserver.observe(track)

    return () => resizeObserver.disconnect()
  }, [items.length, updateMetrics])

  if (items.length === 0) return null

  const showScrollControls = !hideControls && maxOffset > 8

  const getPageAmount = () => {
    const viewport = viewportRef.current
    const card = trackRef.current?.querySelector<HTMLElement>('.media-card-wrapper')
    const cardStep = (card?.offsetWidth ?? 170) + ROW_GAP
    const viewportStep = viewport?.clientWidth ?? cardStep * 4

    // Move nearly a full visible page, while leaving a small visual overlap so the user
    // keeps context about where the row moved.
    return clamp(viewportStep - cardStep * 0.55, cardStep, viewportStep)
  }

  const slideRow = (direction: 'left' | 'right') => {
    if (maxOffset <= 0) return

    const pageAmount = getPageAmount()

    setOffset((currentOffset) => {
      if (direction === 'right') {
        const nextOffset = currentOffset + pageAmount
        return nextOffset >= maxOffset - 1 ? 0 : clamp(nextOffset, 0, maxOffset)
      }

      const nextOffset = currentOffset - pageAmount
      return nextOffset <= 1 ? maxOffset : clamp(nextOffset, 0, maxOffset)
    })
  }

  const handleArrowClick = (direction: 'left' | 'right') => (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    slideRow(direction)
  }

  return (
    <motion.section
      className="watchlist-row"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease: SLIDE_EASE }}
    >
      <div className="row-head">
        <h2>{title}</h2>
        <span>{items.length} items</span>
      </div>

      <div className={`row-scroll-shell${showScrollControls ? ' has-scroll-controls' : ''}`}>
        {showScrollControls && (
          <button
            className="row-scroll-button row-scroll-button-left"
            type="button"
            aria-label={`Slide ${title} left`}
            onClick={handleArrowClick('left')}
          >
            ‹
          </button>
        )}

        <div className="row-scroll" ref={viewportRef}>
          <motion.div
            className="row-scroll-track"
            ref={trackRef}
            animate={{ x: -offset }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 280, damping: 36, mass: 0.9 }
            }
          >
            {items.map((item, index) => (
              <MediaCard key={`${item.id}-${index}`} item={item} onSelect={onSelect} />
            ))}
          </motion.div>
        </div>

        {showScrollControls && (
          <button
            className="row-scroll-button row-scroll-button-right"
            type="button"
            aria-label={`Slide ${title} right`}
            onClick={handleArrowClick('right')}
          >
            ›
          </button>
        )}
      </div>
    </motion.section>
  )
}
