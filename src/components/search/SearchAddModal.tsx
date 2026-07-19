import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { Link, useNavigate } from 'react-router-dom'
import type { SearchResultItem } from '../../types/search'
import type { MediaItem, MediaStatus } from '../../types/media'
import { findMatchingMediaItem } from '../../utils/media'
import { searchTmdb } from '../../services/tmdb'
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

function createId(result: SearchResultItem) {
  return `${result.source}-${result.externalId}`
}

function createMediaItem(result: SearchResultItem, status: MediaStatus): MediaItem {
  return {
    id: createId(result),
    externalId: result.externalId,
    source: result.source,
    title: result.title,
    type: result.type,
    status,
    poster: result.poster,
    backdrop: result.backdrop,
    progress: status === 'Watched' ? 'Watched' : result.year,
    rating: result.rating,
    description: result.description,
    year: result.year,
  }
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
  const shouldReduceMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const shouldSimplifyMotion = shouldReduceMotion
  const [isExpanded, setIsExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [apiResults, setApiResults] = useState<SearchResultItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const normalizedQuery = query.trim().toLowerCase()
  const sharedTransition = shouldReduceMotion ? reducedTransition : isMobile ? mobileSpringTransition : springTransition
  const itemTransition = shouldReduceMotion ? reducedTransition : isMobile ? mobileItemTransition : fastSpringTransition
  const panelTransition = shouldReduceMotion ? reducedTransition : isMobile ? mobilePanelTransition : { duration: 0.2, ease: modalEase }
  const results = useMemo(() => {
    if (!normalizedQuery || searchError) return []
    return mergeUniqueResults(apiResults).slice(0, 8)
  }, [apiResults, normalizedQuery, searchError])

  useEffect(() => {
    if (!isExpanded || !normalizedQuery) return

    const controller = new AbortController()
    const searchTimer = window.setTimeout(async () => {
      setApiResults([])
      setIsSearching(true)
      setSearchError(null)
      try {
        const tmdbResults = await searchTmdb(query, { signal: controller.signal })
        setApiResults(tmdbResults)
      } catch (error) {
        if (controller.signal.aborted) return

        console.error(error)
        setApiResults([])
        setSearchError(error instanceof Error ? error.message : 'TMDB search failed. Try again in a moment.')
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
  }, [isExpanded, normalizedQuery, query])

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

  const openSearch = () => {
    setIsExpanded(true)
    setHighlightedIndex(results.length > 0 ? 0 : -1)
  }

  const openResult = (result: SearchResultItem) => {
    closeSearch()
    navigate(`/details/${result.source}/${encodeURIComponent(result.externalId)}`, {
      state: { item: createMediaItem(result, 'Planned') },
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
      <div className={`nav-search-shell${isExpanded ? ' expanded' : ''}`}>
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
                placeholder="Search titles..."
                onFocus={() => setHighlightedIndex(results.length > 0 ? 0 : -1)}
                onKeyDown={handleInputKeyDown}
                onChange={(event) => {
                  setQuery(event.target.value)
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
              {!normalizedQuery && (
                <motion.div
                  className="nav-search-empty"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={panelTransition}
                >
                  <strong>Search to add</strong>
                  <span>Movies, TV series, and anime results come from TMDB through AfterList's API proxy.</span>
                </motion.div>
              )}

              {normalizedQuery && isSearching && (
                <motion.div
                  className="nav-search-empty"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={panelTransition}
                >
                  <strong>Searching TMDB</strong>
                  <span>Finding movies, TV series, and anime results...</span>
                </motion.div>
              )}

              {normalizedQuery && searchError && (
                <motion.div
                  className="nav-search-empty"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={panelTransition}
                >
                  <strong>TMDB unavailable</strong>
                  <span>{searchError}</span>
                </motion.div>
              )}

              {normalizedQuery && !isSearching && !searchError && results.length === 0 && (
                <motion.div
                  className="nav-search-empty"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={panelTransition}
                >
                  <strong>No results found</strong>
                  <span>Try a different TMDB title.</span>
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
                      to={`/details/${result.source}/${encodeURIComponent(result.externalId)}`}
                      state={{ item: createMediaItem(result, 'Planned') }}
                      onFocus={() => setHighlightedIndex(index)}
                      onClick={closeSearch}
                    >
                      <img src={result.poster} alt="" loading="lazy" />
                      <span>
                        <strong>{result.title}</strong>
                        <small>
                          {result.type} / {result.year} / Rating {result.rating} / TMDB
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
                      onClick={() => onCreate(createMediaItem(result, 'Planned'))}
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
