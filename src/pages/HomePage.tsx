import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import MediaDetailsModal from '../components/media/MediaDetailsModal'
import WatchlistRow from '../components/media/MediaRow'
import type { MediaItem, MediaStatus } from '../types/media'
import { useIsMobile } from '../hooks/useMediaQuery'

type HomePageProps = {
  items: MediaItem[]
  onRemove: (id: string) => void
  onStatusChange: (id: string, status: MediaStatus) => void
}

const watchRows: { title: string; status: MediaStatus }[] = [
  { title: 'Watching', status: 'Watching' },
  { title: 'Watched', status: 'Watched' },
  { title: 'Planned', status: 'Planned' },
  { title: 'Dropped', status: 'Dropped' },
]

const HERO_ROTATION_MS = 30_000
const HERO_PREVIEW_LIMIT = 5
const heroEase = [0.22, 1, 0.36, 1] as const

function getNextHeroIndex(currentIndex: number, itemCount: number) {
  if (itemCount <= 1) return 0

  const offset = Math.floor(Math.random() * (itemCount - 1)) + 1
  return (currentIndex + offset) % itemCount
}

function getHeroPreviewItems(items: MediaItem[], currentIndex: number) {
  if (!items.length) return []

  const previewCount = Math.min(items.length, HERO_PREVIEW_LIMIT)

  return Array.from({ length: previewCount }, (_, step) => {
    const index = (currentIndex + step) % items.length

    return {
      item: items[index],
      index,
      isActive: step === 0,
    }
  })
}

function HomePage({ items, onRemove, onStatusChange }: HomePageProps) {
  const shouldReduceMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const shouldSimplifyMotion = shouldReduceMotion
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [heroIndex, setHeroIndex] = useState(0)
  const safeHeroIndex = items.length ? heroIndex % items.length : 0
  const hero = items[safeHeroIndex]
  const heroPreviewItems = getHeroPreviewItems(items, safeHeroIndex)
  const isDetailsModalOpen = Boolean(selectedItem)

  useEffect(() => {
    setHeroIndex((currentIndex) => (items.length ? currentIndex % items.length : 0))
  }, [items.length])

  useEffect(() => {
    if (items.length <= 1) return undefined

    const intervalId = window.setInterval(() => {
      setHeroIndex((currentIndex) => getNextHeroIndex(currentIndex, items.length))
    }, HERO_ROTATION_MS)

    return () => window.clearInterval(intervalId)
  }, [items.length])

  const handleRemove = (id: string) => {
    onRemove(id)
    setSelectedItem((current) => (current && current.id === id ? null : current))
  }

  const handleStatusChange = (id: string, status: MediaStatus) => {
    onStatusChange(id, status)
    setSelectedItem((current) => (current && current.id === id ? { ...current, status } : current))
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {hero && (
          <motion.section
            key={`${hero.id}-${safeHeroIndex}`}
            className="hero-card glass-panel"
            style={{ '--hero-image': `url(${hero.backdrop})` } as CSSProperties}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 1.01 }}
            transition={shouldReduceMotion ? { duration: 0.01 } : { duration: isMobile ? 0.42 : 0.75, ease: heroEase }}
          >
            <div className="hero-content">
              <p className="eyebrow">Apple TV calm · Netflix grid</p>
              <h1>AfterList</h1>
              <p className="hero-title">{hero.title}</p>
              <p className="hero-description">
                {hero.description || 'A premium watchlist for anime, movies, and TV series — clean, personal, and not bloated.'}
              </p>

              <div className="hero-meta">
                <span className={`pill ${hero.status}`}>{hero.status}</span>
                <span>{hero.type}</span>
                <span>{hero.year || hero.progress}</span>
                <span>★ {hero.rating}</span>
              </div>
            </div>

            {heroPreviewItems.length > 1 && (
              <div className="hero-preview-rail" aria-label="Upcoming hero previews">
                {heroPreviewItems.map(({ item, index, isActive }, position) => (
                  <motion.button
                    key={`${item.id}-${index}-${position}`}
                    type="button"
                    className={`hero-preview-thumb${isActive ? ' is-active' : ''}`}
                    aria-label={`Show ${item.title} in hero`}
                    onClick={() => setHeroIndex(index)}
                    whileHover={shouldSimplifyMotion ? undefined : { y: -3, scale: isActive ? 1.02 : 1.06 }}
                    whileTap={shouldSimplifyMotion ? undefined : { scale: 0.96 }}
                  >
                    <img src={item.poster} alt="" loading="lazy" />
                  </motion.button>
                ))}
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      <section className="library-section">
        <div className="section-head library-head">
          <div>
            <p className="eyebrow">Library</p>
            <h2>Your watchlist</h2>
          </div>
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
        <MediaDetailsModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onRemove={handleRemove}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  )
}

export default HomePage
