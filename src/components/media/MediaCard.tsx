import type { CSSProperties } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import type { MediaItem } from '../../types/media'
import { snappySpring } from '../../motion'

type MediaCardProps = {
  item: MediaItem
  isSaved?: boolean
  onAdd?: (item: MediaItem) => void
  animateLayout?: boolean
  variant?: 'poster' | 'landscape'
}

function MediaCard({ item, isSaved = true, onAdd, animateLayout = true, variant = 'poster' }: MediaCardProps) {
  const navigate = useNavigate()
  const progress = item.type !== 'Movie' && item.totalEpisodes
    ? `${item.currentEpisode ?? 0}/${item.totalEpisodes} episodes`
    : null
  const primaryMeta = isSaved ? progress || item.type : [item.type, item.year].filter(Boolean).join(' · ')
  const rating = isSaved && item.personalRating != null
    ? `My rating ${item.personalRating}/10`
    : item.rating !== 'N/A' ? `TMDB ${item.rating}` : null
  const progressPercent = item.totalEpisodes
    ? Math.min(100, Math.round(((item.currentEpisode ?? 0) / item.totalEpisodes) * 100))
    : 0

  return (
    <motion.article
      layout={animateLayout ? 'position' : false}
      className={`media-card-wrapper is-${variant} ${isSaved ? 'is-saved' : 'is-discovery'}`}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      whileHover={{ y: -7, scale: 1.025 }}
      whileTap={{ scale: 0.975 }}
      transition={snappySpring}
    >
      <button
        className="media-card"
        type="button"
        aria-label={`Open details for ${item.title}`}
        onClick={() => navigate(`/details/${item.source}/${encodeURIComponent(item.externalId ?? item.id)}`, { state: { item } })}
      >
        <span className="media-poster-shell" data-title={item.title}>
          <img
            className="media-poster"
            src={variant === 'landscape' ? item.backdrop || item.poster : item.poster}
            alt={`${item.title} ${variant === 'landscape' ? 'backdrop' : 'poster'}`}
            loading="lazy"
            decoding="async"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
          {isSaved && <span className={`card-status ${item.status}`}>{item.status}</span>}
          {isSaved && progressPercent > 0 && <span className="media-progress" style={{ '--media-progress': `${progressPercent}%` } as CSSProperties} aria-hidden="true" />}
          {isSaved && item.isFavorite && <span className="card-favorite" aria-label="Favorite">♥</span>}
        </span>

        <span className="media-info">
          <strong>{item.title}</strong>
          <span className="card-meta">
            <span>{primaryMeta}</span>
            {rating && <span>{rating}</span>}
          </span>
        </span>
      </button>

      {!isSaved && onAdd && (
        <button className="media-card-add" type="button" onClick={() => onAdd(item)}>
          Add to watchlist
        </button>
      )}
    </motion.article>
  )
}

export default MediaCard
