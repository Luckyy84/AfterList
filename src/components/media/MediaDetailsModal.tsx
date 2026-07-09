import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { MediaDetails, MediaItem, MediaStatus } from '../../types/media'
import { canFetchTmdbDetails, fetchTmdbDetails } from '../../services/tmdb'
import { useIsMobile } from '../../hooks/useMediaQuery'

const statusOptions: MediaStatus[] = ['Planned', 'Watching', 'Watched', 'Dropped']
const modalEase = [0.22, 1, 0.36, 1] as const
const reducedTransition = { duration: 0.01 } as const
const mobileModalTransition = { type: 'spring', stiffness: 430, damping: 34, mass: 0.72 } as const
const desktopModalTransition = { type: 'spring', stiffness: 360, damping: 32, mass: 0.8 } as const

type MediaDetailsModalProps = {
  item: MediaItem
  onClose: () => void
  onRemove: (id: string) => void
  onStatusChange: (id: string, status: MediaStatus) => void
}

function MediaDetailsModal({ item, onClose, onRemove, onStatusChange }: MediaDetailsModalProps) {
  const shouldReduceMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const shouldSimplifyMotion = shouldReduceMotion
  const yearLabel = item.year ?? item.progress
  const [tmdbDetails, setTmdbDetails] = useState<MediaDetails | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  const modalTransition = shouldReduceMotion ? reducedTransition : isMobile ? mobileModalTransition : desktopModalTransition
  const canLoadDetails = canFetchTmdbDetails(item)

  useEffect(() => {
    setTmdbDetails(null)
    setDetailsError(null)

    if (!canLoadDetails) {
      setIsLoadingDetails(false)
      return undefined
    }

    const controller = new AbortController()
    setIsLoadingDetails(true)

    fetchTmdbDetails(item, { signal: controller.signal })
      .then((details) => {
        if (!controller.signal.aborted) {
          setTmdbDetails(details)
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error(error)
        setDetailsError(error instanceof Error ? error.message : 'Could not load TMDB details.')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingDetails(false)
        }
      })

    return () => controller.abort()
  }, [canLoadDetails, item])

  const extraMeta = useMemo(() => {
    if (!tmdbDetails) return []

    const seasonEpisodeLabel = [tmdbDetails.seasonsLabel, tmdbDetails.episodesLabel].filter(Boolean).join(' / ')

    return [tmdbDetails.runtimeLabel, seasonEpisodeLabel].filter((value): value is string => Boolean(value))
  }, [tmdbDetails])

  return (
    <motion.div
      className="modal-backdrop details-result-backdrop"
      onClick={onClose}
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={shouldReduceMotion ? reducedTransition : { duration: 0.18, ease: modalEase }}
    >
      <motion.section
        className="details-modal details-result-modal"
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={modalTransition}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.img
          className="details-modal-backdrop-art"
          src={item.backdrop || item.poster}
          alt=""
          aria-hidden="true"
          initial={shouldSimplifyMotion ? false : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={shouldSimplifyMotion ? { duration: 0 } : { duration: isMobile ? 0.28 : 0.34, ease: modalEase }}
        />

        <button className="modal-close" type="button" aria-label="Close details" onClick={onClose}>
          x
        </button>

        <div className="details-result-body">
          <motion.img
            className="modal-poster details-result-poster"
            src={item.poster}
            alt={item.title}
            initial={shouldSimplifyMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={shouldSimplifyMotion ? { duration: 0 } : { duration: isMobile ? 0.22 : 0.26, ease: modalEase }}
          />

          <motion.div
            className="modal-content details-result-content"
            initial={shouldSimplifyMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldSimplifyMotion ? { duration: 0 } : { duration: isMobile ? 0.2 : 0.24, ease: modalEase, delay: 0.04 }}
          >
            <p className="eyebrow details-preview-label">Saved item</p>
            <h2>{item.title}</h2>

            <div className="hero-meta details-result-meta">
              <span>{item.type}</span>
              {yearLabel && <span>{yearLabel}</span>}
              <span>Rating {item.rating}</span>
              <span className={`pill ${item.status}`}>{item.status}</span>
              {extraMeta.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            {tmdbDetails?.tagline && <p className="details-tagline">"{tmdbDetails.tagline}"</p>}

            <p className="details-result-description">{item.description}</p>

            {isLoadingDetails && <p className="details-api-note">Loading TMDB details...</p>}
            {detailsError && <p className="details-api-note details-api-error">{detailsError}</p>}

            {tmdbDetails && (
              <div className="details-api-panel" aria-label="TMDB details">
                {tmdbDetails.genres.length > 0 && (
                  <div>
                    <span className="details-api-label">Genres</span>
                    <div className="details-api-chips">
                      {tmdbDetails.genres.map((genre) => (
                        <span key={genre}>{genre}</span>
                      ))}
                    </div>
                  </div>
                )}

                {tmdbDetails.countries.length > 0 && (
                  <div>
                    <span className="details-api-label">Countries</span>
                    <p>{tmdbDetails.countries.join(', ')}</p>
                  </div>
                )}
              </div>
            )}

            <div className="details-action-panel">
              <label className="status-editor details-status-editor">
                <span>Edit status</span>
                <select
                  value={item.status}
                  aria-label={`Edit status for ${item.title}`}
                  onChange={(event) => onStatusChange(item.id, event.target.value as MediaStatus)}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="delete-btn details-delete-btn"
                type="button"
                aria-label={`Remove ${item.title}`}
                title="Remove"
                onClick={() => onRemove(item.id)}
              >
                Remove from AfterList
              </button>
            </div>
          </motion.div>
        </div>
      </motion.section>
    </motion.div>
  )
}

export default MediaDetailsModal
