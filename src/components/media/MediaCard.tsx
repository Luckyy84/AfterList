import { motion, useReducedMotion } from 'motion/react'
import type { MediaItem } from '../../types/media'
import { useMediaQuery } from '../../hooks/useMediaQuery'

type MediaCardProps = {
  item: MediaItem
  onSelect: (item: MediaItem) => void
  onRemove?: (id: string) => void
}

function MediaCard({ item, onSelect }: MediaCardProps) {
  const shouldReduceMotion = useReducedMotion()
  const supportsFinePointerHover = useMediaQuery('(hover: hover) and (pointer: fine)')
  const shouldAnimateHover = !shouldReduceMotion && supportsFinePointerHover

  return (
    <motion.article
      className="media-card-wrapper"
      whileHover={shouldAnimateHover ? { y: -6, scale: 1.045 } : undefined}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
    >
      <button
        className="media-card"
        type="button"
        aria-label={`Open details for ${item.title}`}
        onClick={() => onSelect(item)}
      >
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
      </button>
    </motion.article>
  )
}

export default MediaCard
