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
  cardVariant?: 'poster' | 'landscape'
}

const SLIDE_EASE = [0.22, 1, 0.36, 1] as const
const ROW_GAP = 16
const INITIAL_SCROLL_STATE = { maxScrollLeft: 0, canScrollLeft: false, canScrollRight: false }

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 6 6 6-6 6'} /></svg>
}

export default function WatchlistRow({ title, items, onAdd, isItemSaved, hideControls = false, hideHeading = false, cardVariant = 'poster' }: WatchlistRowProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const scrollFrameRef = useRef<number | null>(null)
  const scrollStateRef = useRef(INITIAL_SCROLL_STATE)
  const prefersReducedMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const [scrollState, setScrollState] = useState(INITIAL_SCROLL_STATE)

  const updateMetrics = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    const nextState = {
      maxScrollLeft,
      canScrollLeft: viewport.scrollLeft > 1,
      canScrollRight: viewport.scrollLeft < maxScrollLeft - 1,
    }
    const currentState = scrollStateRef.current
    if (
      currentState.maxScrollLeft === nextState.maxScrollLeft
      && currentState.canScrollLeft === nextState.canScrollLeft
      && currentState.canScrollRight === nextState.canScrollRight
    ) return
    scrollStateRef.current = nextState
    setScrollState(nextState)
  }, [])

  const handleScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) return
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null
      updateMetrics()
    })
  }, [updateMetrics])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return
    const resizeObserver = new ResizeObserver(updateMetrics)
    resizeObserver.observe(viewport)
    resizeObserver.observe(track)
    updateMetrics()
    return () => {
      resizeObserver.disconnect()
      if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current)
    }
  }, [items.length, updateMetrics])

  if (items.length === 0) return null

  const showScrollControls = !isMobile && !hideControls && scrollState.maxScrollLeft > 8
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
    const maxOffset = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    const nextOffset = clamp(viewport.scrollLeft + (direction === 'right' ? getPageAmount() : -getPageAmount()), 0, maxOffset)
    viewport.scrollTo({ left: nextOffset, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
  }

  const handleArrowClick = (event: MouseEvent<HTMLButtonElement>, direction: 'left' | 'right') => {
    event.preventDefault()
    event.stopPropagation()
    slideRow(direction)
  }

  return (
    <motion.section
      className="watchlist-row"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={prefersReducedMotion ? undefined : { once: true, margin: '-80px' }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: isMobile ? 0.36 : 0.5, ease: SLIDE_EASE }}
    >
      {!hideHeading && <div className="row-head"><h2>{title}</h2><span>{items.length} items</span></div>}
      <div className={`row-scroll-shell${showScrollControls ? ' has-scroll-controls' : ''}`}>
        {showScrollControls && (
          <button className="row-scroll-button row-scroll-button-left" type="button" aria-label={`Slide ${title} left`} disabled={!scrollState.canScrollLeft} onClick={(event) => handleArrowClick(event, 'left')}>
            <ChevronIcon direction="left" />
          </button>
        )}
        <div className={`row-scroll${isMobile ? ' row-scroll-native' : ''}`} ref={viewportRef} onScroll={showScrollControls ? handleScroll : undefined}>
          <motion.div className="row-scroll-track" ref={trackRef}>
            {items.map((item, index) => {
              const isSaved = isItemSaved?.(item) ?? !onAdd
              return <MediaCard key={`${item.id}-${index}`} item={item} isSaved={isSaved} onAdd={isSaved ? undefined : onAdd} animateLayout={false} variant={cardVariant} />
            })}
          </motion.div>
        </div>
        {showScrollControls && (
          <button className="row-scroll-button row-scroll-button-right" type="button" aria-label={`Slide ${title} right`} disabled={!scrollState.canScrollRight} onClick={(event) => handleArrowClick(event, 'right')}>
            <ChevronIcon direction="right" />
          </button>
        )}
      </div>
    </motion.section>
  )
}
