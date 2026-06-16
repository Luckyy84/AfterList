import type { MediaItem } from '../types/media'

type MediaCardProps = {
  item: MediaItem
  onSelect: (item: MediaItem) => void
}

function MediaCard({ item, onSelect }: MediaCardProps) {
  return (
    <button className="media-card" type="button" aria-label={`Open details for ${item.title}`} onClick={() => onSelect(item)}>
      <img className="media-poster" src={item.poster} alt={item.title} />

      <span className="media-info">
        <strong>{item.title}</strong>
        <span className="card-meta">
          <span className="type-label">{item.type}</span>
          <span className={`pill ${item.status}`}>{item.status}</span>
        </span>
      </span>
    </button>
  )
}

export default MediaCard
