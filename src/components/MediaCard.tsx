import { motion } from 'motion/react'
import type { MediaItem } from '../types/media'

type MediaCardProps = {
  item: MediaItem
  onSelect: (item: MediaItem) => void
  onRemove?: (id: string) => void
}

const getBadge = (title: string) => {
  const words = title.split(/\s+/).filter(Boolean)

  if (words.length === 1) return words[0].slice(0, 8).toUpperCase()
  if (words.length <= 3) return words.map((word) => word[0]).join('').toUpperCase()

  return words[0].slice(0, 6).toUpperCase()
}

function MediaCard({ item, onSelect }: MediaCardProps) {
  return (
    <motion.article
      className="media-card-wrapper"
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
    >
      <button
        className="media-card"
        type="button"
        aria-label={`Open details for ${item.title}`}
        onClick={() => onSelect(item)}
      >
        <span className="media-poster-shell" data-title={getBadge(item.title)}>
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
          <span className="media-card-topline">
            <span>{item.type}</span>
            <span>★ {item.rating}</span>
          </span>
          <span className="poster-badge">{getBadge(item.title)}</span>
          <span className="poster-year">{item.progress}</span>
        </span>

        <span className="media-info">
          <strong>{item.title}</strong>
          <span className="card-meta">
            <span className="type-label">{item.type}</span>
            <span className={`pill ${item.status}`}>{item.status}</span>
          </span>
        </span>
      </button>
    </motion.article>
  )
}

export default MediaCard
