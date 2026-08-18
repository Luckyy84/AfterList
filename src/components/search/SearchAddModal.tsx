import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { SearchResultItem } from '../../types/search'
import type { MediaItem } from '../../types/media'
import { findMatchingMediaItem, searchResultToMediaItem } from '../../utils/media'
import { getMediaPath } from '../../utils/mediaRoutes'
import { discoverMedia, searchMedia } from '../../services/media'
import { useIsMobile } from '../../hooks/useMediaQuery'

const modalEase = [0.22, 1, 0.36, 1] as const

const springTransition = {
  type: 'spring',
  stiffness: 480,
  damping: 42,
  mass: 0.82,
} as const

const mobileSpringTransition = {
  type: 'spring',
  stiffness: 520,
  damping: 40,
  mass: 0.72,
} as const

const fastSpringTransition = {
  type: 'spring',
  stiffness: 620,
  damping: 44,
  mass: 0.72,
} as const

const mobileItemTransition = {
  type: 'spring',
  stiffness: 560,
  damping: 42,
  mass: 0.68,
} as const

const mobilePanelTransition = {
  type: 'spring',
  stiffness: 420,
  damping: 38,
  mass: 0.76,
} as const

const reducedTransition = { duration: 0.01 } as const

type SearchAddModalProps = {
  items: MediaItem[]
  onCreate: (item: MediaItem) => void
  onOpenExisting: (id: string) => void
}

function mergeUniqueResults(results: SearchResultItem[]) {
  const seen = new Set<string>()

  return results.filter((result) => {
    const key = `${result.source}-${result.externalId}`

    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function SearchAddModal({ items, onCreate }: SearchAddModalProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const shouldReduceMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const shouldSimplifyMotion = shouldReduceMotion
  const [isExpanded, setIsExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [apiResults, setApiResults] = useState<SearchResultItem[]>([])
  const [trendingResults, setTrendingResults] = useState<SearchResultItem[]>([])
  const [isLoadingTrending, setIsLoadingTrending] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchAttempt, setSearchAttempt] = useState(0)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const searchShellRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const normalizedQuery = query.trim().toLowerCase()
  const sharedTransition = shouldReduceMotion ? reducedTransition : isMobile ? mobileSpringTransition : springTransition
  const itemTransition = shouldReduceMotion ? reducedTransition : isMobile ? mobileItemTransition : fastSpringTransition
  const panelTransition = shouldReduceMotion ? reducedTransition : isMobile ? mobilePanelTransition : { duration: 0.2, ease: modalEase }
  const searchResults = useMemo(() => {
    if (!normalizedQuery || searchError) return []
    return mergeUniqueResults(apiResults).slice(0, 8)
  }, [apiResults, normalizedQuery, searchError])
  const results = normalizedQuery ? searchResults : trendingResults

  useEffect(() => {
    if (!isExpanded || normalizedQuery || trendingResults.length) return

    const controller = new AbortController()
    discoverMedia({ feed: 'trending', mediaType: 'all', signal: controller.signal })
      .then((items) => {
        const trending = mergeUniqueResults(items).slice(0, 6)
        setTrendingResults(trending)
        setHighlightedIndex(trending.length ? 0 : -1)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingTrending(false)
      })

    return () => controller.abort()
  }, [isExpanded, normalizedQuery, trendingResults.length])

  useEffect(() => {
    if (!isExpanded || !normalizedQuery) return

    const controller = new AbortController()
    const searchTimer = window.setTimeout(async () => {
      setApiResults([])
      setIsSearching(true)
      setSearchError(null)
      try {
        const mediaResults = await searchMedia(query, { signal: controller.signal })
        setApiResults(mediaResults)
        setHighlightedIndex(mediaResults.length ? 0 : -1)
      } catch (error) {
        if (controller.signal.aborted) return

        console.error(error)
        setApiResults([])
        setSearchError(error instanceof Error ? error.message : 'Media search failed. Try again in a moment.')
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false)
        }
      }
    }, 300)

    return () => {
      window.clearTimeout(searchTimer)
      controller.abort()
    }
  }, [isExpanded, normalizedQuery, query, searchAttempt])

  useEffect(() => {
    if (!isExpanded) return

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), shouldReduceMotion ? 0 : isMobile ? 40 : 80)
    return () => window.clearTimeout(focusTimer)
  }, [isExpanded, shouldReduceMotion, isMobile])

  const closeSearch = () => {
    setIsExpanded(false)
    setQuery('')
    setApiResults([])
    setIsSearching(false)
    setSearchError(null)
    setHighlightedIndex(-1)
  }

  useEffect(() => {
    if (!isExpanded) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      closeSearch()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded])

  useEffect(() => {
    if (!isExpanded) return

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !searchShellRef.current?.contains(event.target)) closeSearch()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isExpanded])

  const openSearch = () => {
    setIsExpanded(true)
    setIsLoadingTrending(trendingResults.length === 0)
    setHighlightedIndex(trendingResults.length > 0 ? 0 : -1)
  }

  const openResult = (result: SearchResultItem) => {
    closeSearch()
    const item = searchResultToMediaItem(result)
    navigate(getMediaPath(item), {
      state: { item, from: `${location.pathname}${location.search}` },
    })
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((currentIndex) => (currentIndex + 1) % results.length)
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((currentIndex) => (currentIndex <= 0 ? results.length - 1 : currentIndex - 1))
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      openResult(results[Math.max(highlightedIndex, 0)])
    }
  }

  const searchContent = (
    <>
      <div ref={searchShellRef} className={`nav-search-shell${isExpanded ? ' expanded' : ''}`}>
        <AnimatePresence mode="wait" initial={false}>
          {!isExpanded ? (
            <motion.button
              key="search-button"
              className="nav-search-button"
              type="button"
              layoutId={shouldSimplifyMotion ? undefined : 'nav-search-control'}
              onClick={openSearch}
              initial={shouldReduceMotion ? false : { opacity: 0.76, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={sharedTransition}
            >
              Search
            </motion.button>
          ) : (
            <motion.div
              key="search-bar"
              className="nav-search-bar"
              layoutId={shouldSimplifyMotion ? undefined : 'nav-search-control'}
              initial={shouldReduceMotion ? false : { opacity: 0.82, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.985 }}
              transition={sharedTransition}
            >
              <input
                ref={inputRef}
                value={query}
                aria-label="Search movies, TV series, and anime"
                aria-invalid={Boolean(searchError)}
                aria-describedby={searchError ? 'nav-search-error' : undefined}
                placeholder="Search titles..."
                onFocus={() => setHighlightedIndex(results.length > 0 ? 0 : -1)}
                onKeyDown={handleInputKeyDown}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setHighlightedIndex(-1)
                }}
              />
              <button className="nav-search-clear" type="button" aria-label="Close search" onClick={closeSearch}>
                x
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              className="nav-search-results-popover"
              initial={shouldReduceMotion ? false : { opacity: 0, y: -6, scale: 0.988 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.988 }}
              transition={panelTransition}
            >
              {!normalizedQuery && isLoadingTrending && (
                <motion.div
                  className="nav-search-empty"
                  role="status"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={panelTransition}
                >
                  <strong>Loading what&rsquo;s trending</strong>
                  <span>Finding popular movies, TV series, and anime...</span>
                </motion.div>
              )}

              {!normalizedQuery && !isLoadingTrending && results.length > 0 && (
                <div className="nav-search-section-head">
                  <strong>Trending now</strong>
                  <span>Popular this week</span>
                </div>
              )}

              {!normalizedQuery && !isLoadingTrending && results.length === 0 && (
                <motion.div
                  className="nav-search-empty"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={panelTransition}
                >
                  <strong>Search to add</strong>
                  <span>Search movies, TV series, and anime from TMDB and AniList.</span>
                </motion.div>
              )}

              {normalizedQuery && isSearching && (
                <motion.div
                  className="nav-search-empty"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={panelTransition}
                >
                  <strong>Searching media providers</strong>
                  <span>Finding movies, TV series, and anime results...</span>
                </motion.div>
              )}

              {normalizedQuery && searchError && (
                <motion.div
                  id="nav-search-error"
                  className="nav-search-empty"
                  role="alert"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={panelTransition}
                >
                  <strong>Search unavailable</strong>
                  <span>{searchError}</span>
                  <button type="button" onClick={() => setSearchAttempt((attempt) => attempt + 1)}>Try again</button>
                </motion.div>
              )}

              {normalizedQuery && !isSearching && !searchError && results.length === 0 && (
                <motion.div
                  className="nav-search-empty"
                  role="status"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={panelTransition}
                >
                  <strong>No results found</strong>
                  <span>Try a different title.</span>
                </motion.div>
              )}

              {results.map((result, index) => {
                const isSelected = index === highlightedIndex
                const existingItem = findMatchingMediaItem(items, result)

                return (
                  <motion.div
                    layout={!shouldSimplifyMotion}
                    key={`${result.source}-${result.externalId}`}
                    className={`nav-search-result${index === 0 ? ' is-top-result' : ''}${isSelected ? ' is-selected' : ''}${existingItem ? ' is-existing' : ''}`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6, scale: 0.992 }}
                    animate={{ opacity: 1, y: 0, scale: isSelected ? 1.01 : 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.992 }}
                    whileHover={shouldReduceMotion ? undefined : { y: -1, scale: isSelected ? 1.012 : 1.006 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
                    transition={itemTransition}
                  >
                    <Link
                      className="nav-search-result-link"
                      to={getMediaPath(searchResultToMediaItem(result))}
                      state={{ item: searchResultToMediaItem(result), from: `${location.pathname}${location.search}` }}
                      onFocus={() => setHighlightedIndex(index)}
                      onClick={closeSearch}
                    >
                      <img src={result.poster} alt="" loading="lazy" />
                      <span>
                        <strong>{result.title}</strong>
                        <small>
                          {result.type} / {result.year} / Rating {result.rating} / {result.source === 'anilist' ? 'AniList' : 'TMDB'}
                          {existingItem ? ` / Saved as ${existingItem.status}` : ''}
                        </small>
                      </span>
                    </Link>
                    <button
                      className="nav-search-add"
                      type="button"
                      aria-label={existingItem ? `${result.title} is already in your watchlist` : `Add ${result.title} to watchlist`}
                      disabled={Boolean(existingItem)}
                      onFocus={() => setHighlightedIndex(index)}
                      onClick={() => onCreate(searchResultToMediaItem(result))}
                    >
                      <span aria-hidden="true">{existingItem ? '✓' : '+'}</span>
                    </button>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )

  if (shouldSimplifyMotion) return searchContent

  return <LayoutGroup id="search-add-flow">{searchContent}</LayoutGroup>
}

export default SearchAddModal
