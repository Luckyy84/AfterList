import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { searchCatalog } from '../data/searchCatalog'
import type { SearchCatalogItem } from '../data/searchCatalog'
import type { MediaItem, MediaStatus } from '../types/media'

const statusOptions: MediaStatus[] = ['Planned', 'Watching', 'Watched', 'Dropped']
const modalEase = [0.22, 1, 0.36, 1] as const

type SearchAddModalProps = {
  onCreate: (item: MediaItem) => void
}

function createId(result: SearchCatalogItem) {
  return `${result.source}-${result.externalId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createMediaItem(result: SearchCatalogItem, status: MediaStatus): MediaItem {
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

function SearchAddModal({ onCreate }: SearchAddModalProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedResult, setSelectedResult] = useState<SearchCatalogItem | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<MediaStatus>('Planned')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const normalizedQuery = query.trim().toLowerCase()

  const results = useMemo(() => {
    if (!normalizedQuery) return []

    return searchCatalog
      .filter((item) => {
        const searchableText = `${item.title} ${item.type} ${item.year}`.toLowerCase()
        return searchableText.includes(normalizedQuery)
      })
      .slice(0, 8)
  }, [normalizedQuery])

  useEffect(() => {
    if (!isExpanded) return

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(focusTimer)
  }, [isExpanded])

  useEffect(() => {
    if (!isExpanded) return

    setHighlightedIndex(results.length > 0 ? 0 : -1)
  }, [isExpanded, results])

  useEffect(() => {
    if (!isExpanded) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selectedResult) {
          setSelectedResult(null)
          return
        }

        closeSearch()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded, selectedResult])

  const closeSearch = () => {
    setIsExpanded(false)
    setQuery('')
    setSelectedResult(null)
    setSelectedStatus('Planned')
    setHighlightedIndex(-1)
  }

  const openSearch = () => {
    setIsExpanded(true)
    setHighlightedIndex(results.length > 0 ? 0 : -1)
  }

  const handleSelectResult = (result: SearchCatalogItem) => {
    setSelectedResult(result)
    setSelectedStatus('Planned')
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

    onCreate(createMediaItem(selectedResult, selectedStatus))
    closeSearch()
  }

  return (
    <div className={`nav-search-shell${isExpanded ? ' expanded' : ''}`}>
      <AnimatePresence mode="wait" initial={false}>
        {!isExpanded ? (
          <motion.button
            key="search-button"
            className="nav-search-button"
            type="button"
            layoutId="nav-search-control"
            onClick={openSearch}
            initial={{ opacity: 0.72, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            Search
          </motion.button>
        ) : (
          <motion.div
            key="search-bar"
            className="nav-search-bar"
            layoutId="nav-search-control"
            initial={{ opacity: 0.7, width: 112 }}
            animate={{ opacity: 1, width: 'min(430px, 44vw)' }}
            exit={{ opacity: 0, width: 112 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <span className="nav-search-icon" aria-hidden="true">⌕</span>
            <input
              ref={inputRef}
              value={query}
              aria-label="Search movies, TV series, and anime"
              placeholder="Search to add..."
              onFocus={() => setHighlightedIndex(results.length > 0 ? 0 : -1)}
              onKeyDown={handleInputKeyDown}
              onChange={(event) => {
                setQuery(event.target.value)
                setSelectedResult(null)
              }}
            />
            <button className="nav-search-clear" type="button" aria-label="Close search" onClick={closeSearch}>
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="nav-search-results-popover"
            initial={{ opacity: 0, y: -10, scale: 0.965, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, scale: 0.965, filter: 'blur(8px)' }}
            transition={{ duration: 0.22, ease: modalEase }}
          >
            {!normalizedQuery && (
              <div className="nav-search-empty">
                <strong>Search to add</strong>
                <span>Try “Dune” to open results below.</span>
              </div>
            )}

            {normalizedQuery && results.length === 0 && (
              <div className="nav-search-empty">
                <strong>No results found</strong>
                <span>This still uses the mock catalog until the API is connected.</span>
              </div>
            )}

            {results.map((result, index) => (
              <motion.button
                key={`${result.source}-${result.externalId}`}
                className={`nav-search-result${index === 0 ? ' is-top-result' : ''}${index === highlightedIndex ? ' is-selected' : ''}`}
                type="button"
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => handleSelectResult(result)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.025, duration: 0.2, ease: modalEase }}
              >
                <img src={result.poster} alt="" loading="lazy" />
                <span>
                  <strong>{result.title}</strong>
                  <small>{result.type} • {result.year} • ★ {result.rating}</small>
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedResult && (
          <div className="modal-backdrop search-result-backdrop" onClick={() => setSelectedResult(null)}>
            <motion.section
              className="search-result-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Add ${selectedResult.title}`}
              initial={{ opacity: 0, y: 22, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ duration: 0.28, ease: modalEase }}
              onClick={(event) => event.stopPropagation()}
            >
              <button className="modal-close" type="button" aria-label="Close preview" onClick={() => setSelectedResult(null)}>
                ✕
              </button>

              <img className="search-detail-backdrop" src={selectedResult.backdrop} alt="" />
              <div className="search-detail-body">
                <img className="search-detail-poster" src={selectedResult.poster} alt={selectedResult.title} />
                <div>
                  <p className="eyebrow">Preview result</p>
                  <h3>{selectedResult.title}</h3>
                  <div className="hero-meta search-detail-meta">
                    <span>{selectedResult.type}</span>
                    <span>{selectedResult.year}</span>
                    <span>★ {selectedResult.rating}</span>
                  </div>
                  <p>{selectedResult.description}</p>

                  <label className="status-editor create-status-editor">
                    <span>Status</span>
                    <select
                      value={selectedStatus}
                      aria-label={`Choose status for ${selectedResult.title}`}
                      onChange={(event) => setSelectedStatus(event.target.value as MediaStatus)}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button className="create-item-btn" type="button" onClick={handleCreate}>
                    Create
                  </button>
                </div>
              </div>
            </motion.section>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default SearchAddModal
