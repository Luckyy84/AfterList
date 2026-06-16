import type { CSSProperties } from 'react'
import { useState } from 'react'
import MediaCard from '../components/MediaCard'
import MediaDetailsModal from '../components/MediaDetailsModal'
import { demoItems } from '../data/demoItems'
import type { MediaItem, MediaStatus } from '../types/media'

type StatusFilter = 'All' | MediaStatus

const statusFilters: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'All' },
  { label: 'Watched', value: 'Completed' },
  { label: 'Planned', value: 'Planned' },
  { label: 'Watching', value: 'Watching' },
  { label: 'Dropped', value: 'Dropped' },
]

function HomePage() {
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('All')
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const hero = demoItems[0]
  const visibleItems =
    selectedStatus === 'All'
      ? demoItems
      : demoItems.filter((item) => item.status === selectedStatus)

  return (
    <>
      <section className="hero-card" style={{ '--hero-image': `url(${hero.backdrop})` } as CSSProperties}>
        <div className="hero-content">
          <p className="eyebrow">Apple TV calm · Netflix grid</p>
          <h1>AfterList</h1>
          <p className="hero-title">{hero.title}</p>
          <p className="hero-description">A premium watchlist for anime, movies, and TV series — clean, personal, and not bloated.</p>

          <div className="hero-meta">
            <span className={`pill ${hero.status}`}>{hero.status}</span>
            <span>{hero.type}</span>
            <span>{hero.progress}</span>
            <span>★ {hero.rating}</span>
          </div>
        </div>
      </section>

      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">Library</p>
            <h2>Your watchlist</h2>
          </div>

          <div className="section-controls">
            <div className="chips" aria-label="Watch status filters">
              {statusFilters.map((filter) => (
                <button
                  className={selectedStatus === filter.value ? 'chip active' : 'chip'}
                  key={filter.value}
                  type="button"
                  onClick={() => setSelectedStatus(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="media-grid">
          {visibleItems.map((item) => (
            <MediaCard key={item.id} item={item} onSelect={setSelectedItem} />
          ))}
        </div>
      </section>

      {selectedItem && (
        <MediaDetailsModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </>
  )
}

export default HomePage
