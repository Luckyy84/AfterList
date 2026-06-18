import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { animate } from 'motion'
import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from 'motion/react'
import MediaCard from './MediaCard'
import type { MediaItem } from '../types/media'

type WatchlistRowProps = {
  title: string
  items: MediaItem[]
  onSelect: (item: MediaItem) => void
  hideControls?: boolean
}

const SLIDE_EASE = [0.22, 1, 0.36, 1] as const
const INFINITE_CARD_COPIES = 5
const INFINITE_CENTER_COPY = 2
const INFINITE_SPEED = 0.018
const ROW_GAP = 16

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export default function WatchlistRow({ title, items, onSelect, hideControls = false }: WatchlistRowProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const arrowAnimationRef = useRef<{ stop: () => void } | null>(null)
  const isManualSlidingRef = useRef(false)
  const prefersReducedMotion = useReducedMotion()
  const infiniteX = useMotionValue(0)
  const [offset, setOffset] = useState(0)
  const [maxOffset, setMaxOffset] = useState(0)
  const [singleSetWidth, setSingleSetWidth] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const isInfiniteRow = title.toLowerCase() === 'watched' && items.length > 4
  const showScrollControls = !hideControls && items.length > 4 && (isInfiniteRow || maxOffset > 8)

  const repeatedSets = useMemo(
    () => Array.from({ length: INFINITE_CARD_COPIES }, (_, copyIndex) => copyIndex),
    [],
  )

  const getCenterStart = useCallback(
    (setWidth = singleSetWidth) => -setWidth * INFINITE_CENTER_COPY,
    [singleSetWidth],
  )

  const wrapInfiniteX = useCallback(
    (value: number) => {
      if (!singleSetWidth) return value

      let nextX = value
      const minX = -singleSetWidth * (INFINITE_CENTER_COPY + 1)
      const maxX = -singleSetWidth * (INFINITE_CENTER_COPY - 1)

      while (nextX <= minX) nextX += singleSetWidth
      while (nextX >= maxX) nextX -= singleSetWidth

      return nextX
    },
    [singleSetWidth],
  )

  const normalizeInfiniteX = useCallback(() => {
    if (!singleSetWidth) return

    const currentX = infiniteX.get()
    const nextX = wrapInfiniteX(currentX)

    if (nextX !== currentX) {
      infiniteX.set(nextX)
    }
  }, [infiniteX, singleSetWidth, wrapInfiniteX])

  const updateMetrics = useCallback(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    if (isInfiniteRow) {
      const firstSet = track.querySelector<HTMLElement>('.row-scroll-set')
      const nextSetWidth = firstSet?.offsetWidth ?? 0

      setSingleSetWidth(nextSetWidth)

      if (nextSetWidth > 0) {
        const centerStart = getCenterStart(nextSetWidth)
        const currentX = infiniteX.get()

        if (!currentX || Math.abs(currentX) < 1) {
          infiniteX.set(centerStart)
        } else {
          infiniteX.set(wrapInfiniteX(currentX))
        }
      }

      setOffset(0)
      setMaxOffset(0)
      return
    }

    const nextMaxOffset = Math.max(0, track.scrollWidth - viewport.clientWidth)
    setMaxOffset(nextMaxOffset)
    setOffset((currentOffset) => Math.min(currentOffset, nextMaxOffset))
  }, [getCenterStart, infiniteX, isInfiniteRow, wrapInfiniteX])

  useLayoutEffect(() => {
    updateMetrics()

    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    const resizeObserver = new ResizeObserver(updateMetrics)
    resizeObserver.observe(viewport)
    resizeObserver.observe(track)

    return () => resizeObserver.disconnect()
  }, [items.length, isInfiniteRow, updateMetrics])

  useEffect(() => {
    return () => arrowAnimationRef.current?.stop()
  }, [])

  useAnimationFrame((_, delta) => {
    if (!isInfiniteRow || prefersReducedMotion || isPaused || isManualSlidingRef.current || !singleSetWidth) return

    infiniteX.set(wrapInfiniteX(infiniteX.get() - delta * INFINITE_SPEED))
  })

  if (items.length === 0) return null

  const getSlideAmount = () => {
    const viewport = viewportRef.current
    const card = trackRef.current?.querySelector<HTMLElement>('.media-card-wrapper')
    const cardStep = (card?.offsetWidth ?? 170) + ROW_GAP
    const viewportStep = (viewport?.clientWidth ?? cardStep * 3) * 0.72

    return clamp(viewportStep, cardStep * 2, cardStep * 5)
  }

  const slideRow = (direction: 'left' | 'right') => {
    if (isInfiniteRow) {
      if (!singleSetWidth) {
        updateMetrics()
      }

      const currentX = wrapInfiniteX(infiniteX.get() || getCenterStart())
      const slideAmount = getSlideAmount()
      const targetX = direction === 'left' ? currentX + slideAmount : currentX - slideAmount

      arrowAnimationRef.current?.stop()
      isManualSlidingRef.current = true
      infiniteX.set(currentX)

      arrowAnimationRef.current = animate(infiniteX, targetX, {
        type: 'spring',
        stiffness: 320,
        damping: 34,
        mass: 0.85,
        restDelta: 0.5,
        restSpeed: 2,
        onComplete: () => {
          normalizeInfiniteX()
          isManualSlidingRef.current = false
        },
      })

      return
    }

    const slideAmount = getSlideAmount()

    setOffset((currentOffset) => {
      const nextOffset = direction === 'left' ? currentOffset - slideAmount : currentOffset + slideAmount
      return Math.min(Math.max(nextOffset, 0), maxOffset)
    })
  }

  const handleArrowClick = (direction: 'left' | 'right') => (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    slideRow(direction)
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

      <div
        className={`row-scroll-shell${showScrollControls ? ' has-scroll-controls' : ''}${isInfiniteRow ? ' is-infinite' : ''}`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        {showScrollControls && (
          <button
            className="row-scroll-button row-scroll-button-left"
            type="button"
            aria-label={`Slide ${title} left`}
            disabled={!isInfiniteRow && offset <= 0}
            onClick={handleArrowClick('left')}
          >
            ‹
          </button>
        )}

        <div className="row-scroll" ref={viewportRef}>
          {isInfiniteRow ? (
            <motion.div
              className="row-scroll-track row-scroll-track-infinite"
              ref={trackRef}
              aria-label={`${title} circular list`}
              style={{ x: infiniteX }}
            >
              {repeatedSets.map((copyIndex) => (
                <div
                  className="row-scroll-set"
                  aria-hidden={copyIndex !== INFINITE_CENTER_COPY}
                  key={`loop-set-${copyIndex}`}
                >
                  {renderCards(`loop-${copyIndex}`)}
                </div>
              ))}
            </motion.div>
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
              disabled={!isInfiniteRow && offset >= maxOffset - 1}
              onClick={handleArrowClick('right')}
            >
              ›
            </button>

            {!isInfiniteRow && (
              <>
                <div className="row-fade row-fade-left" aria-hidden="true" />
                <div className="row-fade row-fade-right" aria-hidden="true" />
              </>
            )}
          </>
        )}
      </div>
    </motion.section>
  )
}
