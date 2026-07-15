import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import type { SearchResultItem } from '../../types/search'
import type { MediaItem, MediaStatus } from '../../types/media'
import CustomSelect from '../ui/CustomSelect'
import { findMatchingMediaItem } from '../../utils/media'
import { searchTmdb } from '../../services/tmdb'
import { loadDefaultStatus } from '../../services/preferences'
import { useIsMobile } from '../../hooks/useMediaQuery'

const statusOptions: MediaStatus[] = ['Planned', 'Watching', 'Watched', 'Dropped']
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

function SearchAddModal({ items, onCreate, onOpenExisting }: SearchAddModalProps) {
  const shouldReduceMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const shouldSimplifyMotion = shouldReduceMotion
  const [isExpanded, setIsExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [apiResults, setApiResults] = useState<SearchResultItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedResult, setSelectedResult] = useState<SearchResultItem | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<MediaStatus>(loadDefaultStatus)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const detailModalRef = useRef<HTMLElement | null>(null)

  const normalizedQuery = query.trim().toLowerCase()
  const compactTransition = shouldReduceMotion ? reducedTransition : { duration: 0.14, ease: modalEase }
  const sharedTransition = shouldReduceMotion ? reducedTransition : isMobile ? mobileSpringTransition : springTransition
  const itemTransition = shouldReduceMotion ? reducedTransition : isMobile ? mobileItemTransition : fastSpringTransition
  const panelTransition = shouldReduceMotion ? reducedTransition : isMobile ? mobilePanelTransition : { duration: 0.2, ease: modalEase }
  const detailModalRoot = typeof document === 'undefined' ? null : document.body

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

  useEffect(() => {
    if (!selectedResult) return
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    queueMicrotask(() => detailModalRef.current?.querySelector<HTMLElement>('.modal-close')?.focus())

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !detailModalRef.current) return
      const controls = [...detailModalRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', trapFocus)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', trapFocus)
      previousFocus?.focus()
    }
  }, [selectedResult])

  const closeSearch = () => {
    setIsExpanded(false)
    setQuery('')
    setApiResults([])
    setIsSearching(false)
    setSearchError(null)
    setSelectedResult(null)
    setSelectedStatus(loadDefaultStatus())
    setHighlightedIndex(-1)
  }

  useEffect(() => {
    if (!isExpanded) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (selectedResult) setSelectedResult(null)
      else closeSearch()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded, selectedResult])

  const openSearch = () => {
    setIsExpanded(true)
    setHighlightedIndex(results.length > 0 ? 0 : -1)
  }

  const openExistingItem = (item: MediaItem) => {
    closeSearch()
    onOpenExisting(item.id)
  }

  const handleSelectResult = (result: SearchResultItem) => {
    const existingItem = findMatchingMediaItem(items, result)

    if (existingItem) {
      openExistingItem(existingItem)
      return
    }

    setSelectedResult(result)
    setSelectedStatus(loadDefaultStatus())
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
      handleSelectResult(results[Math.max(highlightedIndex, 0)])
    }
  }

  const handleCreate = () => {
    if (!selectedResult) return

    const existingItem = findMatchingMediaItem(items, selectedResult)

    if (existingItem) {
      openExistingItem(existingItem)
      return
    }

    onCreate(createMediaItem(selectedResult, selectedStatus))
    closeSearch()
  }

  const detailPreview = (
    <AnimatePresence initial={false}>
      {selectedResult && (
        <motion.div
          className="modal-backdrop search-result-backdrop"
          onClick={() => setSelectedResult(null)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={shouldReduceMotion ? reducedTransition : { duration: 0.18, ease: modalEase }}
        >
          <motion.section
            ref={detailModalRef}
            className="search-result-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Add ${selectedResult.title}`}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={shouldReduceMotion ? compactTransition : { duration: isMobile ? 0.22 : 0.24, ease: modalEase }}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" aria-label="Close preview" onClick={() => setSelectedResult(null)}>
              x
            </button>

            <motion.img
              className="search-detail-backdrop"
              src={selectedResult.backdrop}
              alt=""
              initial={shouldReduceMotion ? false : { scale: 1.04, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={shouldReduceMotion ? compactTransition : { duration: isMobile ? 0.28 : 0.34, ease: modalEase }}
            />
            <div className="search-detail-body">
              <motion.img
                className="search-detail-poster"
                src={selectedResult.poster}
                alt={selectedResult.title}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={shouldReduceMotion ? compactTransition : { duration: isMobile ? 0.22 : 0.26, ease: modalEase }}
              />
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={shouldReduceMotion ? compactTransition : { duration: isMobile ? 0.2 : 0.24, ease: modalEase, delay: 0.04 }}
              >
                <p className="eyebrow">Preview result</p>
                <h3>{selectedResult.title}</h3>
                <div className="hero-meta search-detail-meta">
                  <span>{selectedResult.type}</span>
                  <span>{selectedResult.year}</span>
                  <span>Rating {selectedResult.rating}</span>
                </div>
                <p>{selectedResult.description}</p>

                <label className="status-editor create-status-editor">
                  <span>Status</span>
                  <CustomSelect ariaLabel={`Choose status for ${selectedResult.title}`} value={selectedStatus} options={statusOptions.map((status) => ({ value: status, label: status }))} onChange={(value) => setSelectedStatus(value as MediaStatus)} />
                </label>

                <button className="create-item-btn" type="button" onClick={handleCreate}>
                  Add to watchlist
                </button>
              </motion.div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )

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
                  setSelectedResult(null)
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
                  <motion.button
                    layout={!shouldSimplifyMotion}
                    key={`${result.source}-${result.externalId}`}
                    className={`nav-search-result${index === 0 ? ' is-top-result' : ''}${isSelected ? ' is-selected' : ''}${existingItem ? ' is-existing' : ''}`}
                    type="button"
                    onFocus={() => setHighlightedIndex(index)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelectResult(result)}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6, scale: 0.992 }}
                    animate={{ opacity: 1, y: 0, scale: isSelected ? 1.01 : 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.992 }}
                    whileHover={shouldReduceMotion ? undefined : { y: -1, scale: isSelected ? 1.012 : 1.006 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
                    transition={itemTransition}
                  >
                    <img src={result.poster} alt="" loading="lazy" />
                    <span>
                      <strong>{result.title}</strong>
                      <small>
                        {result.type} / {result.year} / Rating {result.rating} / TMDB
                        {existingItem ? ` / Saved as ${existingItem.status}` : ''}
                      </small>
                    </span>
                  </motion.button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {detailModalRoot ? createPortal(detailPreview, detailModalRoot) : detailPreview}
    </>
  )

  if (shouldSimplifyMotion) return searchContent

  return <LayoutGroup id="search-add-flow">{searchContent}</LayoutGroup>
}

export default SearchAddModal
