import type { MediaItem } from '../types/media'

type MediaDetailsModalProps = {
  item: MediaItem
  onClose: () => void
}

function MediaDetailsModal({ item, onClose }: MediaDetailsModalProps) {
  return (
    <div className="modal-backdrop">
      <section className="details-modal" role="dialog" aria-modal="true" aria-label={item.title}>
        <button className="modal-close" type="button" aria-label="Close details" onClick={onClose}>
          ✕
        </button>

        <img className="modal-poster" src={item.poster} alt={item.title} />

        <div className="modal-content">
          <p className="eyebrow">{item.type}</p>
          <h2>{item.title}</h2>
          <p>{item.description}</p>

          <div className="hero-meta">
            <span className={`pill ${item.status}`}>{item.status}</span>
            <span>{item.progress}</span>
            <span>★ {item.rating}</span>
          </div>
        </div>
      </section>
    </div>
  )
}

export default MediaDetailsModal
