import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { FocusEvent, PointerEvent } from 'react'
import type { MediaItem } from '../../types/media'
import { useMediaQuery } from '../../hooks/useMediaQuery'

type MediaCardProps = {
  item: MediaItem
  onSelect: (item: MediaItem) => void
  onRemove?: (id: string) => void
}

type PreviewRect = {
  top: number
  left: number
  width: number
  height: number
}

function MediaCardContents({ item }: { item: MediaItem }) {
  return (
    <span className="media-poster-shell">
      <span className="media-poster-frame">
        <img
          className="media-poster"
          src={item.poster}
          alt={item.title}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
        <span className="poster-shine" aria-hidden="true" />
      </span>

      <span className="media-info media-info-inside">
        <strong>{item.title}</strong>
        <span className="card-meta">
          <span className="type-label">{item.type}</span>
          <span className={`pill ${item.status}`}>{item.status}</span>
        </span>
      </span>
    </span>
  )
}

function getPreviewRect(element: HTMLElement): PreviewRect {
  const rect = element.getBoundingClientRect()

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }
}

function MediaCard({ item, onSelect }: MediaCardProps) {
  const supportsFinePointerHover = useMediaQuery('(hover: hover) and (pointer: fine)')
  const [previewRect, setPreviewRect] = useState<PreviewRect | null>(null)

  const showPreview = useCallback(
    (element: HTMLElement) => {
      if (!supportsFinePointerHover) return
      setPreviewRect(getPreviewRect(element))
    },
    [supportsFinePointerHover],
  )

  const hidePreview = useCallback(() => {
    setPreviewRect(null)
  }, [])

  const handlePointerEnter = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      showPreview(event.currentTarget)
    },
    [showPreview],
  )

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLButtonElement>) => {
      showPreview(event.currentTarget)
    },
    [showPreview],
  )

  return (
    <>
      <article className="media-card-wrapper">
        <button
          className="media-card"
          type="button"
          aria-label={`Open details for ${item.title}`}
          onClick={() => {
            hidePreview()
            onSelect(item)
          }}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={hidePreview}
          onFocus={handleFocus}
          onBlur={hidePreview}
        >
          <MediaCardContents item={item} />
        </button>
      </article>

      {createPortal(
        <AnimatePresence>
          {previewRect ? (
            <motion.div
              key={item.id}
              className="media-card-hover-layer"
              aria-hidden="true"
              initial={{ opacity: 0, y: 0, scale: 1, rotate: 0 }}
              animate={{ opacity: 1, y: -18, scale: 1.125, rotate: -1.2 }}
              exit={{ opacity: 0, y: 0, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 850, damping: 8, mass: 0.55 }}
              style={{
                position: 'fixed',
                top: previewRect.top,
                left: previewRect.left,
                width: previewRect.width,
                height: previewRect.height,
                zIndex: 9999,
                pointerEvents: 'none',
                transformOrigin: 'center center',
              }}
            >
              <div className="media-card media-card-hover-preview">
                <MediaCardContents item={item} />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

export default MediaCard
