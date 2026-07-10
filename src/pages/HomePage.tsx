import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router-dom'
import MediaDetailsModal from '../components/media/MediaDetailsModal'
import WatchlistRow from '../components/media/MediaRow'
import type { MediaItem, MediaStatus, MediaUpdate } from '../types/media'
import type { SearchResultItem } from '../types/search'
import { useIsMobile } from '../hooks/useMediaQuery'
import { discoverTmdb } from '../services/tmdb'
import { findMatchingMediaItem, getMediaKey } from '../utils/media'

type HomePageProps = {
  items: MediaItem[]
  onRemove: (id: string) => void
  onUpdate: (id: string, updates: MediaUpdate) => void
  onCreate: (item: MediaItem) => void
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

function toMediaItem(result: SearchResultItem): MediaItem {
  return { id: `${result.source}-${result.externalId}`, externalId: result.externalId, source: result.source, title: result.title, type: result.type, status: 'Planned', poster: result.poster, backdrop: result.backdrop, progress: result.year, rating: result.rating, description: result.description, year: result.year }
}

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

function HomePage({ items, onRemove, onUpdate, onCreate }: HomePageProps) {
  const shouldReduceMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const shouldSimplifyMotion = shouldReduceMotion
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [heroIndex, setHeroIndex] = useState(0)
  const [discoveryItems, setDiscoveryItems] = useState<MediaItem[]>([])
  const recommendationSeed = items.find((item) => item.externalId)
  const recommendationExternalId = recommendationSeed?.externalId
  const recommendationMediaType = recommendationSeed?.type === 'Movie' ? 'movie' : 'tv'
  const savedMediaKeys = items.map(getMediaKey).filter(Boolean).sort().join('|')
  const safeHeroIndex = items.length ? heroIndex % items.length : 0
  const hero = items[safeHeroIndex]
  const heroPreviewItems = getHeroPreviewItems(items, safeHeroIndex)
  const isDetailsModalOpen = Boolean(selectedItem)
  const continueWatching = items.filter((item) => item.status === 'Watching')
  const selectedDisplayItem = selectedItem ? findMatchingMediaItem(items, selectedItem) ?? selectedItem : null

  useEffect(() => {
    if (items.length <= 1) return undefined

    const intervalId = window.setInterval(() => {
      setHeroIndex((currentIndex) => getNextHeroIndex(currentIndex, items.length))
    }, HERO_ROTATION_MS)

    return () => window.clearInterval(intervalId)
  }, [items.length])

  useEffect(() => {
    const controller = new AbortController()
    const savedKeys = new Set(savedMediaKeys.split('|').filter(Boolean))

    const loadDiscovery = async () => {
      let results: SearchResultItem[] = []
      if (recommendationExternalId) {
        try {
          results = await discoverTmdb({ feed: 'recommendations', externalId: recommendationExternalId, mediaType: recommendationMediaType, signal: controller.signal })
        } catch { /* Fall through to public trending titles. */ }
      }
      if (!results.length) {
        try {
          results = await discoverTmdb({ feed: 'trending', mediaType: 'all', signal: controller.signal })
        } catch { /* The watchlist remains usable when discovery is offline. */ }
      }
      if (!controller.signal.aborted) setDiscoveryItems(results.map(toMediaItem).filter((result) => !savedKeys.has(getMediaKey(result))).slice(0, 12))
    }

    void loadDiscovery()
    return () => controller.abort()
  }, [recommendationExternalId, recommendationMediaType, savedMediaKeys])

  const handleRemove = (id: string) => {
    onRemove(id)
    setSelectedItem((current) => (current && current.id === id ? null : current))
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {hero ? (
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
              <p className="eyebrow">Your next story, remembered</p>
              <h1>Pick up where you left off.</h1>
              <p className="hero-title">{hero.title}</p>
              <p className="hero-description">
                {hero.description || 'A premium watchlist for anime, movies, and TV series - clean, personal, and not bloated.'}
              </p>

              <div className="hero-meta">
                <span className={`pill ${hero.status}`}>{hero.status}</span>
                <span>{hero.type}</span>
                <span>{hero.year || hero.progress}</span>
                <span>Rating {hero.rating}</span>
              </div>
              <div className="hero-actions"><button className="primary-action" type="button" onClick={() => setSelectedItem(hero)}>View {hero.title}</button><Link className="secondary-action" to="/discover">Discover something new</Link></div>
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
        ) : (
          <motion.section
            key="empty-homepage"
            className="hero-card empty-home-hero glass-panel"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 1.01 }}
            transition={shouldReduceMotion ? { duration: 0.01 } : { duration: isMobile ? 0.42 : 0.75, ease: heroEase }}
          >
            <div className="hero-content empty-home-content">
              <p className="eyebrow">Free to explore · no account required</p>
              <h1>Find it. Save it. Watch it.</h1>
              <p className="hero-description">
                Browse what is trending, then build a personal watchlist that stays in this browser. Sign in only when you want cloud sync.
              </p>

              <div className="hero-actions"><Link className="primary-action" to="/discover">Explore trending titles</Link><span className="hero-reassurance">Guest watchlists are first-class.</span></div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {continueWatching.length > 0 && <section className="library-section"><WatchlistRow title="Continue watching" items={continueWatching} onSelect={setSelectedItem} hideControls={isDetailsModalOpen} /></section>}

      {discoveryItems.length > 0 && <section className="library-section"><WatchlistRow title={items.length ? 'Because it matches your list' : 'Trending now'} items={discoveryItems} onSelect={setSelectedItem} hideControls={isDetailsModalOpen} /></section>}

      {items.length > 0 && (
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
      )}

      {selectedDisplayItem && (
        <MediaDetailsModal
          item={selectedDisplayItem}
          isSaved={Boolean(findMatchingMediaItem(items, selectedDisplayItem))}
          onAdd={onCreate}
          onClose={() => setSelectedItem(null)}
          onRemove={handleRemove}
          onUpdate={onUpdate}
        />
      )}
    </>
  )
}

export default HomePage
