import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { animate, motion, useAnimationFrame, useMotionValue, useReducedMotion } from 'motion/react'
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

export default function WatchlistRow({ title, items, onSelect, hideControls = false }: WatchlistRowProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const arrowAnimationRef = useRef<{ stop: () => void } | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const infiniteX = useMotionValue(0)
  const [offset, setOffset] = useState(0)
  const [maxOffset, setMaxOffset] = useState(0)
  const [singleSetWidth, setSingleSetWidth] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isManualSliding, setIsManualSliding] = useState(false)
  const isInfiniteRow = title.toLowerCase() === 'watched' && items.length > 4
  const showScrollControls = !hideControls && items.length > 4 && (isInfiniteRow || maxOffset > 8)

  const repeatedSets = useMemo(
    () => Array.from({ length: INFINITE_CARD_COPIES }, (_, copyIndex) => copyIndex),
    [],
  )

  const normalizeInfiniteX = useCallback(() => {
    if (!singleSetWidth) return

    let nextX = infiniteX.get()
    const centerStart = -singleSetWidth * INFINITE_CENTER_COPY
    const minX = -singleSetWidth * (INFINITE_CENTER_COPY + 1)
    const maxX = -singleSetWidth * (INFINITE_CENTER_COPY - 1)

    while (nextX <= minX) nextX += singleSetWidth
    while (nextX >= maxX) nextX -= singleSetWidth

    if (nextX !== infiniteX.get()) {
      infiniteX.set(nextX || centerStart)
    }
  }, [infiniteX, singleSetWidth])

  const updateMetrics = useCallback(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    if (isInfiniteRow) {
      const firstSet = track.querySelector<HTMLElement>('.row-scroll-set')
      const nextSetWidth = firstSet?.offsetWidth ?? 0

      setSingleSetWidth(nextSetWidth)

      if (nextSetWidth > 0) {
        infiniteX.set(-nextSetWidth * INFINITE_CENTER_COPY)
      }

      setOffset(0)
      setMaxOffset(0)
      return
    }

    const nextMaxOffset = Math.max(0, track.scrollWidth - viewport.clientWidth)
    setMaxOffset(nextMaxOffset)
    setOffset((currentOffset) => Math.min(currentOffset, nextMaxOffset))
  }, [infiniteX, isInfiniteRow])

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
    if (!isInfiniteRow || prefersReducedMotion || isPaused || isManualSliding || !singleSetWidth) return

    infiniteX.set(infiniteX.get() - delta * INFINITE_SPEED)
    normalizeInfiniteX()
  })

  if (items.length === 0) return null

  const slideRow = (direction: 'left' | 'right') => {
    if (isInfiniteRow) {
      const track = trackRef.current
      const card = track?.querySelector<HTMLElement>('.media-card-wrapper')
      const cardWidth = card?.offsetWidth ?? 180
      const gap = 16
      const slideAmount = (cardWidth + gap) * 3
      const nextX = direction === 'left' ? infiniteX.get() + slideAmount : infiniteX.get() - slideAmount

      arrowAnimationRef.current?.stop()
      setIsManualSliding(true)

      arrowAnimationRef.current = animate(infiniteX, nextX, {
        type: 'spring',
        stiffness: 230,
        damping: 30,
        mass: 0.9,
        onComplete: () => {
          normalizeInfiniteX()
          setIsManualSliding(false)
        },
      })

      return
    }

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
            onClick={() => slideRow('left')}
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
              onClick={() => slideRow('right')}
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
