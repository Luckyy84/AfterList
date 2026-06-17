import { motion } from 'motion/react'
import type { MediaItem } from '../types/media'

type MediaCardProps = {
  item: MediaItem
  onSelect: (item: MediaItem) => void
  onRemove?: (id: string) => void
}

function MediaCard({ item, onSelect }: MediaCardProps) {
  return (
    <motion.article
      className="media-card-wrapper"
      whileHover={{ y: -8, scale: 1.055 }}
      transition={{ type: 'spring', stiffness: 360, damping: 22 }}
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
