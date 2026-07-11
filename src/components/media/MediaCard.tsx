import { motion, useReducedMotion } from 'motion/react'
import type { MediaItem } from '../../types/media'
import { snappySpring } from '../../motion'

type MediaCardProps = {
  item: MediaItem
  onSelect: (item: MediaItem) => void
  isSaved?: boolean
  onAdd?: (item: MediaItem) => void
}

function MediaCard({ item, onSelect, isSaved = true, onAdd }: MediaCardProps) {
  const shouldReduceMotion = useReducedMotion()
  const progress = item.type !== 'Movie' && item.totalEpisodes
    ? `${item.currentEpisode ?? 0}/${item.totalEpisodes} episodes`
    : null
  const primaryMeta = isSaved ? progress || item.type : [item.type, item.year].filter(Boolean).join(' · ')
  const rating = isSaved && item.personalRating != null
    ? `My rating ${item.personalRating}/10`
    : item.rating !== 'N/A' ? `TMDB ${item.rating}` : null

  return (
    <motion.article
      layout="position"
      className={`media-card-wrapper ${isSaved ? 'is-saved' : 'is-discovery'}`}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.96 }}
      whileHover={shouldReduceMotion ? undefined : { y: -7, scale: 1.025 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.975 }}
      transition={snappySpring}
    >
      <button
        className="media-card"
        type="button"
        aria-label={`Open details for ${item.title}`}
        onClick={() => onSelect(item)}
      >
        <span className="media-poster-shell" data-title={item.title}>
          <img
            className="media-poster"
            src={item.poster}
            alt=""
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
          {isSaved && <span className={`card-status ${item.status}`}>{item.status}</span>}
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
