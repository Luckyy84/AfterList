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
  isLoading?: boolean
  isSignedIn?: boolean
}

const watchStatuses: MediaStatus[] = ['Watching', 'Watched', 'Planned', 'Dropped']
const HERO_PREVIEW_LIMIT = 5
const heroEase = [0.22, 1, 0.36, 1] as const

function toMediaItem(result: SearchResultItem): MediaItem {
  return { id: `${result.source}-${result.externalId}`, externalId: result.externalId, source: result.source, title: result.title, type: result.type, status: 'Planned', poster: result.poster, backdrop: result.backdrop, progress: result.year, rating: result.rating, description: result.description, year: result.year }
}

function getHeroPreviewItems(items: MediaItem[], currentIndex: number) {
  if (!items.length) return []
  return Array.from({ length: Math.min(items.length, HERO_PREVIEW_LIMIT) }, (_, step) => {
    const index = (currentIndex + step) % items.length
    return { item: items[index], index, isActive: step === 0 }
  })
}

function getInitials(title: string) {
  return title.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
}

function HomeSkeleton() {
  return (
    <section className="hero-card hero-skeleton" aria-label="Loading your watchlist" aria-busy="true">
      <div className="hero-skeleton-copy"><span /><span /><span /><span /></div>
      <div className="hero-skeleton-thumbs">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div>
    </section>
  )
}

function HomePage({ items, onCreate, isLoading = false, isSignedIn = false }: HomePageProps) {
  const shouldReduceMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const [heroIndex, setHeroIndex] = useState(0)
  const [discoveryItems, setDiscoveryItems] = useState<MediaItem[]>([])
  const [discoveryState, setDiscoveryState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [discoveryAttempt, setDiscoveryAttempt] = useState(0)
  const [failedHeroImages, setFailedHeroImages] = useState<Set<string>>(() => new Set())
  const [selectedWatchStatus, setSelectedWatchStatus] = useState<MediaStatus>('Watching')
  const recommendationSeed = items.find((item) => item.externalId)
  const recommendationExternalId = recommendationSeed?.externalId
  const recommendationMediaType = recommendationSeed?.type === 'Movie' ? 'movie' : 'tv'
  const savedMediaKeys = items.map(getMediaKey).filter(Boolean).sort().join('|')
  const continueWatching = items
    .filter((item) => item.status === 'Watching')
    .toSorted((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  const fallbackTitles = items.toSorted((a, b) => {
    if (a.status === 'Planned' && b.status !== 'Planned') return -1
    if (b.status === 'Planned' && a.status !== 'Planned') return 1
    return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
  })
  const featuredTitles = continueWatching.length ? continueWatching : fallbackTitles
  const safeHeroIndex = featuredTitles.length ? heroIndex % featuredTitles.length : 0
  const hero = featuredTitles[safeHeroIndex]
  const heroPreviewItems = getHeroPreviewItems(featuredTitles, safeHeroIndex)
  const isWatchingHero = continueWatching.length > 0
  const selectedWatchItems = items.filter((item) => item.status === selectedWatchStatus)

  useEffect(() => {
    const controller = new AbortController()
    const savedKeys = new Set(savedMediaKeys.split('|').filter(Boolean))

    const loadDiscovery = async () => {
      setDiscoveryState('loading')
      let results: SearchResultItem[] = []
      let didLoad = false
      if (recommendationExternalId) {
        try {
          results = await discoverTmdb({ feed: 'recommendations', externalId: recommendationExternalId, mediaType: recommendationMediaType, signal: controller.signal })
          didLoad = results.length > 0
        } catch { /* Fall through to public trending titles. */ }
      }
      if (!results.length) {
        try {
          results = await discoverTmdb({ feed: 'trending', mediaType: 'all', signal: controller.signal })
          didLoad = true
        } catch { /* The watchlist remains usable when discovery is offline. */ }
      }
      if (!controller.signal.aborted) {
        setDiscoveryItems(results.map(toMediaItem).filter((result) => !savedKeys.has(getMediaKey(result))).slice(0, 12))
        setDiscoveryState(didLoad ? 'ready' : 'error')
      }
    }

    void loadDiscovery()
    return () => controller.abort()
  }, [discoveryAttempt, recommendationExternalId, recommendationMediaType, savedMediaKeys])

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading ? <HomeSkeleton /> : hero ? (
          <motion.section
            key={`${hero.id}-${safeHeroIndex}`}
            className={`hero-card glass-panel${failedHeroImages.has(hero.id) || !hero.backdrop ? ' has-artwork-fallback' : ''}`}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 1.01 }}
            transition={shouldReduceMotion ? { duration: 0.01 } : { duration: isMobile ? 0.42 : 0.75, ease: heroEase }}
          >
            {hero.backdrop && !failedHeroImages.has(hero.id)
              ? <img className="hero-backdrop" src={hero.backdrop} alt="" fetchPriority="high" onError={() => setFailedHeroImages((failed) => new Set(failed).add(hero.id))} />
              : <span className="hero-artwork-fallback" aria-hidden="true">{getInitials(hero.title)}</span>}
            <div className="hero-content">
              <h1>{isWatchingHero ? 'Pick up where you left off.' : 'Choose your next story.'}</h1>
              <p className="hero-title">{hero.title}</p>
              <p className="hero-description">{hero.description || 'Keep this title close, update its status, and return whenever you are ready.'}</p>
              <div className="hero-meta">
                <span className={`pill ${hero.status}`}>{hero.status}</span>
                <span>{hero.type}</span>
                {(hero.year || hero.progress) && <span>{hero.year || hero.progress}</span>}
                {hero.rating && hero.rating !== 'N/A' && <span>Rating {hero.rating}</span>}
              </div>
              <div className="hero-actions">
                <Link className="primary-action" to={`/details/${hero.source}/${encodeURIComponent(hero.externalId ?? hero.id)}`} state={{ item: hero }}>View {hero.title}</Link>
                <Link className="secondary-action" to={isWatchingHero ? '/discover' : '/library'}>{isWatchingHero ? 'Discover something new' : 'Choose something from your list'}</Link>
              </div>
            </div>

            {heroPreviewItems.length > 1 && (
              <div className="hero-preview-rail" role="tablist" aria-label="Featured titles">
                {heroPreviewItems.map(({ item, index, isActive }, position) => (
                  <motion.button
                    key={`${item.id}-${index}-${position}`}
                    type="button"
                    role="tab"
                    className={`hero-preview-thumb${isActive ? ' is-active' : ''}`}
                    aria-label={`Show ${item.title} in hero`}
                    aria-selected={isActive}
                    onClick={() => setHeroIndex(index)}
                    whileHover={shouldReduceMotion ? undefined : { y: -3, scale: isActive ? 1.02 : 1.06 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                  >
                    {item.poster ? <img src={item.poster} alt="" loading="lazy" /> : <span aria-hidden="true">{getInitials(item.title)}</span>}
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
              <h1>{isSignedIn ? 'Build your watchlist.' : <>Find it.<br />Save it.<br />Watch it.</>}</h1>
              <p className="hero-description">{isSignedIn ? 'Explore what is trending and save the stories you want to watch. Your additions sync across your devices.' : 'Browse what is trending, then build a personal watchlist that stays in this browser. Sign in only when you want cloud sync.'}</p>
              <div className="hero-actions">
                <Link className="primary-action" to="/discover">Explore trending titles</Link>
                {!isSignedIn && <span className="hero-reassurance">Your list is saved in this browser.</span>}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {continueWatching.length > 0 && <section className="library-section home-continue-section"><WatchlistRow title="Continue watching" items={continueWatching} cardVariant="landscape" /></section>}

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
                <button key={status} type="button" role="tab" aria-label={`${status} ${count}`} aria-selected={selectedWatchStatus === status} className={selectedWatchStatus === status ? 'is-active' : ''} onClick={() => setSelectedWatchStatus(status)}>
                  <span>{status}</span><strong>{count}</strong>
                </button>
              )
            })}
          </div>
          {selectedWatchItems.length > 0
            ? <WatchlistRow title={selectedWatchStatus} items={selectedWatchItems} hideHeading cardVariant="landscape" />
            : <div className="watchlist-tab-empty" role="tabpanel"><p>No {selectedWatchStatus.toLowerCase()} titles yet.</p><Link to="/discover">Discover titles</Link></div>}
        </section>
      )}

      {discoveryState === 'loading' && !isLoading && (
        <section className="library-section discovery-state" aria-label="Loading recommendations" aria-busy="true">
          <div className="row-head"><h2>{items.length ? 'Because it matches your list' : 'Trending now'}</h2></div>
          <div className="rail-skeleton">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div>
        </section>
      )}
      {discoveryState === 'error' && !isLoading && (
        <section className="library-section discovery-state">
          <h2>{items.length ? 'Because it matches your list' : 'Trending now'}</h2>
          <div className="inline-state" role="status"><p>Recommendations aren’t available right now.</p><button type="button" onClick={() => setDiscoveryAttempt((attempt) => attempt + 1)}>Retry</button></div>
        </section>
      )}
      {discoveryState === 'ready' && discoveryItems.length > 0 && <section className="library-section"><WatchlistRow title={items.length ? 'Because it matches your list' : 'Trending now'} items={discoveryItems} onAdd={onCreate} isItemSaved={(item) => Boolean(findMatchingMediaItem(items, item))} /></section>}
    </>
  )
}

export default HomePage
