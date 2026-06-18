import type { CSSProperties } from 'react'
import { useState } from 'react'
import { motion } from 'motion/react'
import MediaDetailsModal from '../components/MediaDetailsModal'
import WatchlistRow from '../components/WatchlistRow'
import type { MediaItem, MediaStatus } from '../types/media'

type HomePageProps = {
  items: MediaItem[]
  onRemove: (id: string) => void
}

const watchRows: { title: string; status: MediaStatus }[] = [
  { title: 'Watching', status: 'Watching' },
  { title: 'Watched', status: 'Completed' },
  { title: 'Planned', status: 'Planned' },
  { title: 'Dropped', status: 'Dropped' },
]

function HomePage({ items, onRemove }: HomePageProps) {
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const hero = items[0]
  const isDetailsModalOpen = Boolean(selectedItem)

  const handleRemove = (id: string) => {
    onRemove(id)
    setSelectedItem((current) => (current && current.id === id ? null : current))
  }

  return (
    <>
      {hero && (
        <motion.section
          className="hero-card glass-panel"
          style={{ '--hero-image': `url(${hero.backdrop})` } as CSSProperties}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="hero-content">
            <p className="eyebrow">Apple TV calm · Netflix grid</p>
            <h1>AfterList</h1>
            <p className="hero-title">{hero.title}</p>
            <p className="hero-description">
              A premium watchlist for anime, movies, and TV series — clean, personal, and not bloated.
            </p>

            <div className="hero-meta">
              <span className={`pill ${hero.status}`}>{hero.status}</span>
              <span>{hero.type}</span>
              <span>{hero.progress}</span>
              <span>★ {hero.rating}</span>
            </div>
          </div>
        </motion.section>
      )}

      <section className="library-section">
        <div className="section-head library-head">
          <div>
            <p className="eyebrow">Library</p>
            <h2>Your watchlist</h2>
          </div>
          <p className="section-copy">Grouped like the Lovable concept, powered by your current AfterList data and delete flow.</p>
        </div>

        <div className="watchlist-stack">
          {watchRows.map((row) => (
            <WatchlistRow
              key={row.status}
              title={row.title}
              items={items.filter((item) => item.status === row.status)}
              onSelect={setSelectedItem}
              hideControls={isDetailsModalOpen}
            />
          ))}
        </div>
      </section>

      {selectedItem && (
        <MediaDetailsModal item={selectedItem} onClose={() => setSelectedItem(null)} onRemove={handleRemove} />
      )}
    </>
  )
}

export default HomePage
