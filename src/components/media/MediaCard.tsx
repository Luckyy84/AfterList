import { motion } from 'motion/react'
import type { MediaItem } from '../../types/media'
import { cardSpring } from '../../utils/motion'

type MediaCardProps = {
  item: MediaItem
  onSelect: (item: MediaItem) => void
  onRemove?: (id: string) => void
}

function MediaCard({ item, onSelect }: MediaCardProps) {
  return (
    <motion.article
      className="media-card-wrapper"
      whileHover={{ y: -8, scale: 1.025, rotateX: 1.5 }}
      whileTap={{ scale: 0.975 }}
      transition={cardSpring}
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
            <span className={`poster-status status-${item.status.toLowerCase()}`}>{item.status}</span>
          </span>

          <span className="media-info media-info-inside">
            <strong>{item.title}</strong>
            <span className="card-meta">
              <span className="type-label">{item.type}</span>
              <span>{item.year || item.progress}</span>
            </span>
          </span>
        </span>
      </button>
    </motion.article>
  )
}

export default MediaCard
