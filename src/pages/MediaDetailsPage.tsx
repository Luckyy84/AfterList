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

  return (
    <motion.article className="details-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={softSpring}>
      <img className="details-page-backdrop" src={item.backdrop || item.poster} alt="" aria-hidden="true" />
      <button className="details-back" type="button" onClick={() => navigate(-1)}>← Back</button>

      <div className="details-page-layout">
        <motion.img className="details-page-poster" src={item.poster} alt={item.title} initial={{ opacity: 0, x: -18, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={softSpring} />

        <motion.div className="details-page-content" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
          <p className="eyebrow">{isSaved ? 'Saved item' : 'Discovery preview'}</p>
          <h1>{item.title}</h1>
          <div className="details-page-meta">
            <span>{item.type}</span>
            {(item.year ?? item.progress) && <span>{item.year ?? item.progress}</span>}
            {item.rating !== 'N/A' && <span>TMDB {item.rating}</span>}
            {isSaved && <span>{savedItem?.status}</span>}
            {extraMeta.map((label) => <span key={label}>{label}</span>)}
          </div>
          {details?.tagline && <p className="details-page-tagline">“{details.tagline}”</p>}
          <p className="details-page-description">{item.description}</p>
          {error && <p className="details-api-error">{error}</p>}

          {details && (details.genres.length > 0 || details.countries.length > 0) && (
            <section className="details-facts" aria-label="Title details">
              {details.genres.length > 0 && <div><h2>Genres</h2><div className="details-chip-row">{details.genres.map((genre) => <span key={genre}>{genre}</span>)}</div></div>}
              {details.countries.length > 0 && <div><h2>Countries</h2><p>{details.countries.join(', ')}</p></div>}
            </section>
          )}

          {!isSaved ? (
            <button className="primary-action details-add" type="button" onClick={() => onCreate(item)}>Add to watchlist</button>
          ) : (
            <section className="details-tracking" aria-label="Watchlist tracking">
              <fieldset className="status-choice-group">
                <legend>Watch status</legend>
                {statuses.map((status) => <button type="button" key={status} className={savedItem?.status === status ? 'is-active' : ''} aria-pressed={savedItem?.status === status} onClick={() => update({ status })}>{status}</button>)}
              </fieldset>
              {item.type !== 'Movie' && <div className="tracking-fields">
                <label>Current episode<input type="number" min="0" max={savedItem?.totalEpisodes || undefined} value={savedItem?.currentEpisode ?? 0} onChange={(event) => update({ currentEpisode: Number(event.target.value) })} /></label>
                <label>Total episodes<input type="number" min="1" value={savedItem?.totalEpisodes ?? ''} placeholder="Unknown" onChange={(event) => update({ totalEpisodes: event.target.value ? Number(event.target.value) : undefined })} /></label>
              </div>}
              <div className="tracking-fields">
                <label>My rating<input type="number" min="1" max="10" value={savedItem?.personalRating ?? ''} placeholder="1–10" onChange={(event) => update({ personalRating: event.target.value ? Number(event.target.value) : null })} /></label>
                <button type="button" className={`favorite-button${savedItem?.isFavorite ? ' is-active' : ''}`} aria-pressed={Boolean(savedItem?.isFavorite)} onClick={() => update({ isFavorite: !savedItem?.isFavorite })}>{savedItem?.isFavorite ? 'Remove favorite' : 'Add favorite'}</button>
              </div>
              <button className="delete-btn details-delete-btn" type="button" onClick={() => { onRemove(savedItem!.id); navigate(-1) }}>Remove from AfterList</button>
            </section>
          )}
        </motion.div>
      </div>
    </motion.article>
  )
}
