import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { fetchTmdbDetails } from '../services/tmdb'
import type { MediaDetails, MediaItem, MediaStatus, MediaUpdate } from '../types/media'
import { softSpring } from '../motion'

const statuses: MediaStatus[] = ['Planned', 'Watching', 'Watched', 'Dropped']

type DetailsPageProps = {
  items: MediaItem[]
  onCreate: (item: MediaItem) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, updates: MediaUpdate) => void
}

export default function MediaDetailsPage({ items, onCreate, onRemove, onUpdate }: DetailsPageProps) {
  const { externalId, source } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const passedItem = (location.state as { item?: MediaItem } | null)?.item
  const savedItem = items.find((item) => item.source === source && item.externalId === externalId)
  const item = savedItem ?? passedItem
  const itemExternalId = item?.externalId
  const isSaved = Boolean(savedItem)
  const [details, setDetails] = useState<MediaDetails | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!itemExternalId) return
    const controller = new AbortController()
    fetchTmdbDetails({ externalId: itemExternalId }, { signal: controller.signal })
      .then(setDetails)
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Details are unavailable.') })
    return () => controller.abort()
  }, [itemExternalId])

  const extraMeta = useMemo(() => details
    ? [details.runtimeLabel, [details.seasonsLabel, details.episodesLabel].filter(Boolean).join(' / ')].filter(Boolean)
    : [], [details])

  if (!item) return (
    <section className="empty-state details-not-found">
      <h1>Title not found</h1>
      <p>Return to Discover and open the title again.</p>
      <button className="primary-action" type="button" onClick={() => navigate('/discover')}>Browse titles</button>
    </section>
  )

  const update = (updates: MediaUpdate) => savedItem && onUpdate(savedItem.id, updates)
  const currentEpisode = savedItem?.currentEpisode ?? 0
  const totalEpisodes = savedItem?.totalEpisodes ?? details?.totalEpisodes
  const metadata = [
    item.type,
    item.year ?? item.progress,
    item.rating !== 'N/A' ? `TMDB ${item.rating}` : null,
    ...extraMeta,
  ].filter(Boolean)

  return (
    <motion.article className="details-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={softSpring}>
      <img className="details-page-backdrop" src={item.backdrop || item.poster} alt="" aria-hidden="true" />
      <button className="details-back" type="button" onClick={() => navigate(-1)}>← Back</button>

      <div className="details-page-layout">
        <motion.img className="details-page-poster" src={item.poster} alt={item.title} initial={{ opacity: 0, x: -18, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={softSpring} />

        <motion.div className="details-page-content" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
          <p className="details-kicker">{isSaved ? savedItem?.status : 'Discovery preview'}</p>
          <h1>{item.title}</h1>
          <p className="details-page-meta">{metadata.map((label, index) => <span key={label}>{index > 0 && <i aria-hidden="true">·</i>}{label}</span>)}</p>
          {details?.tagline && <p className="details-page-tagline">“{details.tagline}”</p>}
          <p className="details-page-description">{item.description}</p>
          {error && <p className="details-api-error">{error}</p>}

          {details && (details.genres.length > 0 || details.countries.length > 0) && (
            <section className="details-facts" aria-label="Title details">
              {details.genres.length > 0 && <div><h2>Genres</h2><p>{details.genres.join(' · ')}</p></div>}
              {details.countries.length > 0 && <div><h2>Countries</h2><p>{details.countries.join(' · ')}</p></div>}
            </section>
          )}

          {!isSaved ? (
            <button className="primary-action details-add" type="button" onClick={() => onCreate({ ...item, totalEpisodes: details?.totalEpisodes })}>Add to watchlist</button>
          ) : (
            <section className="details-tracking" aria-label="Watchlist tracking">
              <div className="tracking-heading">
                <div><p className="details-section-label">Your activity</p><h2>Track this title</h2></div>
                <button type="button" className={`details-favorite${savedItem?.isFavorite ? ' is-active' : ''}`} aria-label={savedItem?.isFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={Boolean(savedItem?.isFavorite)} onClick={() => update({ isFavorite: !savedItem?.isFavorite })}><span aria-hidden="true">{savedItem?.isFavorite ? '♥' : '♡'}</span></button>
              </div>
              <fieldset className="status-choice-group">
                <legend>Watch status</legend>
                {statuses.map((status) => <button type="button" key={status} className={savedItem?.status === status ? 'is-active' : ''} aria-pressed={savedItem?.status === status} onClick={() => update({ status })}>{status}</button>)}
              </fieldset>
              {item.type !== 'Movie' && <div className="tracking-row">
                <div><span className="details-section-label">Progress</span><strong>{totalEpisodes ? `Episode ${currentEpisode} of ${totalEpisodes}` : `Episode ${currentEpisode}`}</strong></div>
                <div className="episode-stepper" aria-label="Current episode controls">
                  <button type="button" aria-label="Decrease current episode" disabled={currentEpisode <= 0} onClick={() => update({ currentEpisode: currentEpisode - 1 })}>−</button>
                  <input type="number" min="0" max={totalEpisodes} value={currentEpisode} aria-label="Current episode" onFocus={(event) => event.currentTarget.select()} onChange={(event) => {
                    if (Number.isNaN(event.currentTarget.valueAsNumber)) return
                    update({ currentEpisode: Math.max(0, Math.min(event.currentTarget.valueAsNumber, totalEpisodes ?? Infinity)) })
                  }} />
                  {totalEpisodes && <small aria-hidden="true">/ {totalEpisodes}</small>}
                  <button type="button" aria-label="Increase current episode" disabled={Boolean(totalEpisodes && currentEpisode >= totalEpisodes)} onClick={() => update({ currentEpisode: currentEpisode + 1 })}>+</button>
                </div>
              </div>}
              <div className="rating-row">
                <div><span className="details-section-label">My rating</span><strong>{savedItem?.personalRating ? `${savedItem.personalRating} / 10` : 'Not rated'}</strong></div>
                <div className="rating-scale" aria-label="Choose your rating">{Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => <button type="button" key={rating} className={savedItem?.personalRating === rating ? 'is-active' : ''} aria-label={`Rate ${rating} out of 10`} aria-pressed={savedItem?.personalRating === rating} onClick={() => update({ personalRating: rating })}>{rating}</button>)}</div>
                {savedItem?.personalRating != null && <button type="button" className="clear-rating" onClick={() => update({ personalRating: null })}>Clear rating</button>}
              </div>
              <div className="details-danger-zone">
                <div><strong>Remove from AfterList</strong><span>Your tracking data for this title will be deleted.</span></div>
                <button className="delete-btn details-delete-btn" type="button" onClick={() => { onRemove(savedItem!.id); navigate(-1) }}>Remove title</button>
              </div>
            </section>
          )}
        </motion.div>
      </div>
    </motion.article>
  )
}
