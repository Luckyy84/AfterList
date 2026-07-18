import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router-dom'
import WatchlistRow from '../components/media/MediaRow'
import type { MediaItem, MediaStatus } from '../types/media'
import type { SearchResultItem } from '../types/search'
import { useIsMobile } from '../hooks/useMediaQuery'
import { discoverTmdb } from '../services/tmdb'
import { findMatchingMediaItem, getMediaKey } from '../utils/media'

type HomePageProps = {
  items: MediaItem[]
  onCreate: (item: MediaItem) => void
}

const watchStatuses: MediaStatus[] = ['Watching', 'Watched', 'Planned', 'Dropped']

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

function HomePage({ items, onCreate }: HomePageProps) {
  const shouldReduceMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const shouldSimplifyMotion = shouldReduceMotion
  const [heroIndex, setHeroIndex] = useState(0)
  const [discoveryItems, setDiscoveryItems] = useState<MediaItem[]>([])
  const [selectedWatchStatus, setSelectedWatchStatus] = useState<MediaStatus>('Watching')
  const recommendationSeed = items.find((item) => item.externalId)
  const recommendationExternalId = recommendationSeed?.externalId
  const recommendationMediaType = recommendationSeed?.type === 'Movie' ? 'movie' : 'tv'
  const savedMediaKeys = items.map(getMediaKey).filter(Boolean).sort().join('|')
  const safeHeroIndex = items.length ? heroIndex % items.length : 0
  const hero = items[safeHeroIndex]
  const heroPreviewItems = getHeroPreviewItems(items, safeHeroIndex)
  const continueWatching = items.filter((item) => item.status === 'Watching')
  const selectedWatchItems = items.filter((item) => item.status === selectedWatchStatus)

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
              <div className="hero-actions"><Link className="primary-action" to={`/details/${hero.source}/${encodeURIComponent(hero.externalId ?? hero.id)}`} state={{ item: hero }}>View {hero.title}</Link><Link className="secondary-action" to="/discover">Discover something new</Link></div>
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
              <h1>Find it.<br />Save it.<br />Watch it.</h1>
              <p className="hero-description">
                Browse what is trending, then build a personal watchlist that stays in this browser. Sign in only when you want cloud sync.
              </p>

              <div className="hero-actions"><Link className="primary-action" to="/discover">Explore trending titles</Link><span className="hero-reassurance">Guest watchlists are first-class.</span></div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {continueWatching.length > 0 && <section className="library-section"><WatchlistRow title="Continue watching" items={continueWatching} /></section>}

      {items.length > 0 && (
        <section className="library-section home-watchlist-section">
          <div className="section-head library-head compact-section-head">
            <h2>Your watchlist</h2>
            <Link className="watchlist-library-link" to="/library">View full library <span aria-hidden="true">→</span></Link>
          </div>

          <div className="watchlist-status-tabs" role="tablist" aria-label="Choose watchlist status">
            {watchStatuses.map((status) => {
              const count = items.filter((item) => item.status === status).length
              return (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  aria-label={`${status} ${count}`}
                  aria-selected={selectedWatchStatus === status}
                  className={selectedWatchStatus === status ? 'is-active' : ''}
                  onClick={() => setSelectedWatchStatus(status)}
                >
                  <span>{status}</span><strong>{count}</strong>
                </button>
              )
            })}
          </div>

          {selectedWatchItems.length > 0
            ? <WatchlistRow title={selectedWatchStatus} items={selectedWatchItems} hideHeading />
            : <div className="watchlist-tab-empty" role="tabpanel">No {selectedWatchStatus.toLowerCase()} titles yet.</div>}
        </section>
      )}

      {discoveryItems.length > 0 && <section className="library-section"><WatchlistRow title={items.length ? 'Because it matches your list' : 'Trending now'} items={discoveryItems} onAdd={onCreate} isItemSaved={(item) => Boolean(findMatchingMediaItem(items, item))} /></section>}

    </>
  )
}

export default HomePage
