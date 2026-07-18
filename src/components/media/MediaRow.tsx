import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import MediaCard from './MediaCard'
import type { MediaItem } from '../../types/media'
import { useIsMobile } from '../../hooks/useMediaQuery'

type WatchlistRowProps = {
  title: string
  items: MediaItem[]
  onAdd?: (item: MediaItem) => void
  isItemSaved?: (item: MediaItem) => boolean
  hideControls?: boolean
  hideHeading?: boolean
}

const SLIDE_EASE = [0.22, 1, 0.36, 1] as const
const ROW_GAP = 16

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export default function WatchlistRow({ title, items, onAdd, isItemSaved, hideControls = false, hideHeading = false }: WatchlistRowProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const shouldSimplifyMotion = prefersReducedMotion
  const shouldUseNativeScroll = isMobile
  const [maxScrollLeft, setMaxScrollLeft] = useState(0)

  const measureScrollRange = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return 0

    return Math.max(0, viewport.scrollWidth - viewport.clientWidth)
  }, [])

  const updateMetrics = useCallback(() => {
    setMaxScrollLeft(measureScrollRange())
  }, [measureScrollRange])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    const resizeObserver = new ResizeObserver(updateMetrics)
    resizeObserver.observe(viewport)
    resizeObserver.observe(track)

    return () => resizeObserver.disconnect()
  }, [items.length, updateMetrics])

  if (items.length === 0) return null

  const showScrollControls = !shouldUseNativeScroll && !hideControls && maxScrollLeft > 8

  const getPageAmount = () => {
    const viewport = viewportRef.current
    const card = viewport?.querySelector<HTMLElement>('.media-card-wrapper')
    const cardStep = (card?.offsetWidth ?? 170) + ROW_GAP
    const viewportStep = viewport?.clientWidth ?? cardStep * 4

    return clamp(viewportStep - cardStep * 0.55, cardStep, viewportStep)
  }

  const slideRow = (direction: 'left' | 'right') => {
    const viewport = viewportRef.current
    if (!viewport) return

    const maxOffset = measureScrollRange()
    if (maxOffset <= 0) return

    const pageAmount = getPageAmount()
    const currentOffset = viewport.scrollLeft
    const nextOffset = direction === 'right' ? (() => {
      const isAlreadyAtEnd = currentOffset >= maxOffset - 1
      const candidateOffset = currentOffset + pageAmount
      return isAlreadyAtEnd ? 0 : clamp(candidateOffset, 0, maxOffset)
    })() : (() => {
      const isAlreadyAtStart = currentOffset <= 1
      const candidateOffset = currentOffset - pageAmount
      return isAlreadyAtStart ? maxOffset : clamp(candidateOffset, 0, maxOffset)
    })()

    viewport.scrollTo({ left: nextOffset, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
    setMaxScrollLeft(maxOffset)
  }

  const handleArrowClick = (event: MouseEvent<HTMLButtonElement>, direction: 'left' | 'right') => {
    event.preventDefault()
    event.stopPropagation()
    slideRow(direction)
  }

  return (
    <motion.section
      className="watchlist-row"
      initial={shouldSimplifyMotion ? false : { opacity: 0, y: 24 }}
      whileInView={shouldSimplifyMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={shouldSimplifyMotion ? undefined : { once: true, margin: '-80px' }}
      transition={shouldSimplifyMotion ? { duration: 0 } : { duration: isMobile ? 0.36 : 0.5, ease: SLIDE_EASE }}
    >
      {!hideHeading && <div className="row-head"><h2>{title}</h2><span>{items.length} items</span></div>}

      <div className={`row-scroll-shell${showScrollControls ? ' has-scroll-controls' : ''}`}>
        {showScrollControls && (
          <button
            className="row-scroll-button row-scroll-button-left"
            type="button"
            aria-label={`Slide ${title} left`}
            onClick={(event) => handleArrowClick(event, 'left')}
          >
            ‹
          </button>
        )}

        <div className={`row-scroll${shouldUseNativeScroll ? ' row-scroll-native' : ''}`} ref={viewportRef}>
          <motion.div className="row-scroll-track" ref={trackRef}>
            {items.map((item, index) => {
              const isSaved = isItemSaved?.(item) ?? !onAdd
              return <MediaCard key={`${item.id}-${index}`} item={item} isSaved={isSaved} onAdd={isSaved ? undefined : onAdd} />
            })}
          </motion.div>
        </div>

        {showScrollControls && (
          <button
            className="row-scroll-button row-scroll-button-right"
            type="button"
            aria-label={`Slide ${title} right`}
            onClick={(event) => handleArrowClick(event, 'right')}
          >
            ›
          </button>
        )}
      </div>
    </motion.section>
  )
}
