import type { CSSProperties, FocusEvent } from 'react'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import MediaDetailsModal from '../components/media/MediaDetailsModal'
import WatchlistRow from '../components/media/MediaRow'
import type { MediaItem, MediaStatus } from '../types/media'
import { controlSpring, panelSpring, reducedTransition } from '../utils/motion'

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

const HERO_ROTATION_MS = 12_000
const HERO_PREVIEW_LIMIT = 5

function getNextHeroIndex(currentIndex: number, itemCount: number) {
  return itemCount > 1 ? (currentIndex + 1) % itemCount : 0
}

function getHeroPreviewItems(items: MediaItem[], currentIndex: number) {
  const previewCount = Math.min(items.length, HERO_PREVIEW_LIMIT)

  return Array.from({ length: previewCount }, (_, step) => {
    const index = (currentIndex + step) % items.length
    return { item: items[index], index, isActive: step === 0 }
  })
}

function HomePage({ items, onRemove, onStatusChange }: HomePageProps) {
  const shouldReduceMotion = useReducedMotion()
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [heroIndex, setHeroIndex] = useState(0)
  const [isAutoplayPaused, setIsAutoplayPaused] = useState(false)
  const [isHeroActive, setIsHeroActive] = useState(false)
  const [isDocumentVisible, setIsDocumentVisible] = useState(!document.hidden)

  const safeHeroIndex = items.length ? heroIndex % items.length : 0
  const hero = items[safeHeroIndex]
  const heroPreviewItems = getHeroPreviewItems(items, safeHeroIndex)
  const isDetailsModalOpen = Boolean(selectedItem)
  const isRotationPaused = Boolean(
    shouldReduceMotion || isAutoplayPaused || isHeroActive || isDetailsModalOpen || !isDocumentVisible,
  )

  useEffect(() => {
    const handleVisibilityChange = () => setIsDocumentVisible(!document.hidden)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    if (items.length <= 1 || isRotationPaused) return undefined

    const timer = window.setTimeout(() => {
      setHeroIndex((currentIndex) => getNextHeroIndex(currentIndex, items.length))
    }, HERO_ROTATION_MS)

    return () => window.clearTimeout(timer)
  }, [heroIndex, isRotationPaused, items.length])

  const handleHeroBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsHeroActive(false)
  }

  const handleRemove = (id: string) => {
    onRemove(id)
    setSelectedItem((current) => (current?.id === id ? null : current))
  }

  const handleStatusChange = (id: string, status: MediaStatus) => {
    onStatusChange(id, status)
    setSelectedItem((current) => (current?.id === id ? { ...current, status } : current))
  }

  return (
    <>
      <section
        className="hero-shell"
        onMouseEnter={() => setIsHeroActive(true)}
        onMouseLeave={() => setIsHeroActive(false)}
        onFocusCapture={() => setIsHeroActive(true)}
        onBlurCapture={handleHeroBlur}
      >
        <AnimatePresence mode="wait">
          {hero ? (
            <motion.div
              key={hero.id}
              className="hero-card glass-panel"
              style={{ '--hero-image': `url(${hero.backdrop || hero.poster})` } as CSSProperties}
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.975, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.015, y: -14 }}
              transition={shouldReduceMotion ? reducedTransition : panelSpring}
            >
              <div className="hero-content">
                <p className="eyebrow">Now in your AfterList</p>
                <h1>{hero.title}</h1>
                <p className="hero-description">
                  {hero.description || 'A saved title from your personal watchlist.'}
                </p>

                <div className="hero-meta">
                  <span className={`pill ${hero.status}`}>{hero.status}</span>
                  <span>{hero.type}</span>
                  {(hero.year || hero.progress) && <span>{hero.year || hero.progress}</span>}
                  <span>Rating {hero.rating}</span>
                </div>

                <div className="hero-actions">
                  <motion.button
                    className="primary"
                    type="button"
                    onClick={() => setSelectedItem(hero)}
                    whileHover={shouldReduceMotion ? undefined : { y: -3, scale: 1.035 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                    transition={controlSpring}
                  >
                    View details
                  </motion.button>
                  {items.length > 1 && (
                    <button
                      className="secondary hero-pause"
                      type="button"
                      aria-pressed={isAutoplayPaused}
                      onClick={() => setIsAutoplayPaused((isPaused) => !isPaused)}
                    >
                      {isAutoplayPaused ? 'Resume showcase' : 'Pause showcase'}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty-homepage"
              className="hero-card empty-home-hero glass-panel"
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.975, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={shouldReduceMotion ? reducedTransition : panelSpring}
            >
              <div className="hero-content empty-home-content">
                <p className="eyebrow">Your personal media space</p>
                <h1>Build a list worth coming back to.</h1>
                <p className="hero-description">
                  Search for anime, movies, and TV series, then track what you plan to watch and what you finish.
                </p>
                <div className="empty-home-actions" aria-label="Getting started steps">
                  <span>01 Search</span>
                  <span>02 Save</span>
                  <span>03 Keep watching</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {heroPreviewItems.length > 1 && (
          <div className="hero-preview-rail" aria-label="Choose featured title">
            {heroPreviewItems.map(({ item, index, isActive }) => (
              <motion.button
                key={item.id}
                type="button"
                className={`hero-preview-thumb${isActive ? ' is-active' : ''}`}
                aria-label={`Feature ${item.title}`}
                aria-pressed={isActive}
                onClick={() => setHeroIndex(index)}
                whileHover={shouldReduceMotion ? undefined : { y: -6, scale: 1.07 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.93 }}
                transition={controlSpring}
              >
                <img src={item.poster} alt="" loading="lazy" />
                <span>{item.title}</span>
              </motion.button>
            ))}
          </div>
        )}
      </section>

      {items.length > 0 && (
        <section className="library-section">
          <div className="section-head library-head">
            <div>
              <p className="eyebrow">Your library</p>
              <h2>Everything you saved</h2>
            </div>
            <div className="library-summary" aria-label={`${items.length} saved titles`}>
              <strong>{items.length}</strong>
              <span>saved titles</span>
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
      )}

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
