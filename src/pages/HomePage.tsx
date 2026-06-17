import type { CSSProperties } from 'react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import MediaCard from '../components/MediaCard'
import MediaDetailsModal from '../components/MediaDetailsModal'
import type { MediaItem, MediaStatus } from '../types/media'

type StatusFilter = 'All' | MediaStatus

const statusFilters: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'All' },
  { label: 'Watched', value: 'Completed' },
  { label: 'Planned', value: 'Planned' },
  { label: 'Watching', value: 'Watching' },
  { label: 'Dropped', value: 'Dropped' },
]

type HomePageProps = {
  items: MediaItem[]
  onRemove: (id: string) => void
}

function HomePage({ items, onRemove }: HomePageProps) {
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('All')
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)

  const hero = items[0]
  const visibleItems =
    selectedStatus === 'All'
      ? items
      : items.filter((item) => item.status === selectedStatus)

  const handleRemove = (id: string) => {
    onRemove(id)
    setSelectedItem((current) => (current && current.id === id ? null : current))
  }

  return (
    <>
      {hero && (
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
      )}

      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">Library</p>
            <h2>Your watchlist</h2>
          </div>

          <div className="section-controls">
            <div className="chips" aria-label="Watch status filters">
              {statusFilters.map((filter) => {
                const isActive = selectedStatus === filter.value
                return (
                  <button
                    className={isActive ? 'chip active' : 'chip'}
                    key={filter.value}
                    type="button"
                    onClick={() => setSelectedStatus(filter.value)}
                    style={{ position: 'relative' }}
                  >
                    <span style={{ position: 'relative', zIndex: 2 }}>
                      {filter.label}
                    </span>
                    {isActive && (
                      <motion.span
                        layoutId="activeChipBg"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: 'var(--chip-active-bg, #333)',
                          borderRadius: 'inherit',
                          zIndex: 1,
                        }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <motion.div layout className="media-grid">
          <AnimatePresence mode="popLayout">
            {visibleItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <MediaCard item={item} onSelect={setSelectedItem} onRemove={handleRemove} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </section>

      {selectedItem && (
        <MediaDetailsModal item={selectedItem} onClose={() => setSelectedItem(null)} onRemove={handleRemove} />
      )}
    </>
  )
}

export default HomePage