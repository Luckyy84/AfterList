import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { fetchMedia } from '../services/media'
import type { MediaDetails, MediaItem, MediaStatus, MediaUpdate } from '../types/media'
import { softSpring } from '../motion'
import { getMediaPath, mediaIdentityMatches, parsePositiveMediaId, type MediaRouteKind } from '../utils/mediaRoutes'
import CustomListMemberships from '../components/media/CustomListMemberships'
import WatchlistHistory from '../components/media/WatchlistHistory'
import DateField from '../components/ui/DateField'

const statuses: MediaStatus[] = ['Planned', 'Watching', 'Paused', 'Watched', 'Dropped']

type DetailsPageProps = {
  routeKind: MediaRouteKind
  items: MediaItem[]
  onCreate: (item: MediaItem) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, updates: MediaUpdate) => void
}

type DetailsLocationState = {
  from?: string
  item?: MediaItem
}

function safeBackTarget(state: DetailsLocationState | null) {
  const from = state?.from
  return from?.startsWith('/') && !from.startsWith('//') && !/^\/(?:movie|tv|anime)\//.test(from)
    ? from
    : '/discover'
}

function useMediaMetadata(item: MediaItem | null) {
  useEffect(() => {
    if (!item) return undefined
    const previousTitle = document.title
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const previousDescription = description?.content
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const createdCanonical = !canonical
    const previousCanonical = canonical?.href

    document.title = `${item.title} | AfterList`
    if (description) description.content = item.description
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.append(canonical)
    }
    canonical.href = new URL(getMediaPath(item), window.location.origin).href

    return () => {
      document.title = previousTitle
      if (description && previousDescription !== undefined) description.content = previousDescription
      if (createdCanonical) canonical?.remove()
      else if (canonical && previousCanonical) canonical.href = previousCanonical
    }
  }, [item])
}

export default function MediaDetailsPage({ routeKind, items, onCreate, onRemove, onUpdate }: DetailsPageProps) {
  const { id, slug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const state = (location.state as DetailsLocationState | null) ?? null
  const numericId = parsePositiveMediaId(id)
  const source = routeKind === 'anime' ? 'anilist' : 'tmdb'
  const externalId = numericId ? (source === 'anilist' ? numericId : `${routeKind}:${numericId}`) : ''
  const seed = state?.item && mediaIdentityMatches(state.item, source, externalId) ? state.item : null
  const savedItem = items.find((candidate) => mediaIdentityMatches(candidate, source, externalId))
  const [loaded, setLoaded] = useState<{ identity: string; item: MediaItem; details: MediaDetails } | null>(null)
  const [loadError, setLoadError] = useState<{ identity: string; message: string } | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [failedArtwork, setFailedArtwork] = useState<Set<string>>(() => new Set())
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const focusedIdentityRef = useRef('')
  const backTarget = safeBackTarget(state)

  useEffect(() => {
    if (!externalId) return undefined

    const controller = new AbortController()
    fetchMedia(source, externalId, { signal: controller.signal })
      .then((response) => {
        setLoaded({ identity: externalId, item: response.item, details: response.details })
        setLoadError(null)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setLoadError({ identity: externalId, message: cause instanceof Error ? cause.message : 'Details are unavailable.' })
        }
      })
    return () => controller.abort()
  }, [externalId, requestVersion, source])

  const currentLoad = loaded?.identity === externalId ? loaded : null
  const record = currentLoad?.item ?? savedItem ?? seed
  const details = currentLoad?.details ?? null
  const error = !externalId
    ? 'This title link is invalid.'
    : loadError?.identity === externalId ? loadError.message : ''

  useEffect(() => {
    if (!record || !numericId) return
    const canonicalPath = getMediaPath(record)
    if (canonicalPath !== location.pathname) navigate(canonicalPath, { replace: true, state })
  }, [location.pathname, navigate, numericId, record, slug, state])

  useEffect(() => {
    const focusIdentity = externalId || `${routeKind}:${id ?? 'invalid'}`
    if ((record || error) && focusedIdentityRef.current !== focusIdentity) {
      headingRef.current?.focus({ preventScroll: true })
      focusedIdentityRef.current = focusIdentity
    }
  }, [error, externalId, id, record, routeKind])

  useMediaMetadata(record)

  const extraMeta = useMemo(() => details
    ? [details.runtimeLabel, [details.seasonsLabel, details.episodesLabel].filter(Boolean).join(' / ')].filter(Boolean)
    : [], [details])

  if (!record) {
    if (!error) return (
      <section className="details-page details-page-loading" aria-busy="true" aria-label="Loading title details">
        <div className="details-page-layout">
          <span className="details-skeleton-poster" />
          <div className="details-skeleton-copy" role="status"><span>Loading title details…</span><i /><i /><i /><i /></div>
        </div>
      </section>
    )

    return (
      <section className="empty-state details-not-found" role="alert">
        <h1 tabIndex={-1} ref={headingRef}>Title unavailable</h1>
        <p>{error}</p>
        <div className="details-state-actions">
          {externalId && <button className="primary-action" type="button" onClick={() => { setLoadError(null); setRequestVersion((version) => version + 1) }}>Try again</button>}
          <Link className="secondary-action" to={backTarget}>Back to browsing</Link>
        </div>
      </section>
    )
  }

  const update = (updates: MediaUpdate) => savedItem && onUpdate(savedItem.id, updates)
  const currentEpisode = savedItem?.currentEpisode ?? 0
  const totalEpisodes = savedItem?.totalEpisodes ?? details?.totalEpisodes
  const metadata = [
    record.type,
    record.year ?? record.progress,
    record.rating !== 'N/A' ? `${record.source === 'anilist' ? 'AniList' : 'TMDB'} ${record.rating}` : null,
    ...extraMeta,
  ].filter(Boolean)
  const canonicalUrl = new URL(getMediaPath(record), window.location.origin).href
  const backdrop = details?.backdrop || record.backdrop || record.poster
  const poster = details?.poster || record.poster

  const copyLink = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(canonicalUrl)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <motion.article className="details-page" initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={shouldReduceMotion ? { duration: 0.01 } : softSpring}>
      {backdrop && !failedArtwork.has(backdrop) && <img className="details-page-backdrop" src={backdrop} alt="" aria-hidden="true" onError={() => setFailedArtwork((failed) => new Set(failed).add(backdrop))} />}
      <Link className="details-back" to={backTarget}>← Back</Link>

      <div className="details-page-layout">
        {poster && !failedArtwork.has(poster)
          ? <motion.img className="details-page-poster" src={poster} alt={`${record.title} poster`} onError={() => setFailedArtwork((failed) => new Set(failed).add(poster))} initial={shouldReduceMotion ? false : { opacity: 0, x: -18, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={shouldReduceMotion ? { duration: 0.01 } : softSpring} />
          : <span className="details-page-poster details-page-artwork-fallback" aria-hidden="true">{record.title.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}</span>}

        <motion.div className="details-page-content" initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={shouldReduceMotion ? { duration: 0.01 } : softSpring}>
          <p className="details-kicker">{savedItem ? savedItem.status : 'Discovery preview'}</p>
          <h1 tabIndex={-1} ref={headingRef}>{record.title}</h1>
          <p className="details-page-meta">{metadata.map((label, index) => <span key={label}>{index > 0 && <i aria-hidden="true">·</i>}{label}</span>)}</p>
          {details?.tagline && <p className="details-page-tagline">“{details.tagline}”</p>}
          <p className="details-page-description">{record.description}</p>
          {error && <div className="details-inline-error" role="alert"><span>{error}</span><button type="button" onClick={() => { setLoadError(null); setRequestVersion((version) => version + 1) }}>Retry details</button></div>}

          <div className="details-share">
            <button className="secondary-action" type="button" onClick={() => void copyLink()}>Copy link</button>
            <span className="sr-only" aria-live="polite">{copyState === 'copied' ? 'Link copied.' : copyState === 'failed' ? 'Copy failed. Select the link shown.' : ''}</span>
            {copyState === 'failed' && <input aria-label="Share link" readOnly value={canonicalUrl} onFocus={(event) => event.currentTarget.select()} />}
          </div>

          {details && (details.genres.length > 0 || details.countries.length > 0) && (
            <section className="details-facts" aria-label="Title details">
              {details.genres.length > 0 && <div><h2>Genres</h2><p>{details.genres.join(' · ')}</p></div>}
              {details.countries.length > 0 && <div><h2>Countries</h2><p>{details.countries.join(' · ')}</p></div>}
            </section>
          )}

          {(details?.format || details?.airingStatus || details?.studios?.length || details?.alternativeTitles?.length) && (
            <section className="details-anime-facts" aria-label="Anime information">
              {details.format && <div><h2>Format</h2><p>{details.format}</p></div>}
              {details.airingStatus && <div><h2>Airing status</h2><p>{details.airingStatus}</p></div>}
              {Boolean(details.studios?.length) && <div><h2>Studios</h2><p>{details.studios?.map((studio) => studio.name).filter(Boolean).join(' · ')}</p></div>}
              {Boolean(details.alternativeTitles?.length) && <div><h2>Also known as</h2><p>{details.alternativeTitles?.join(' · ')}</p></div>}
              {details.trailer && (details.trailer.url || details.trailer.site?.toLowerCase() === 'youtube') && <a className="secondary-action" href={details.trailer.url ?? `https://www.youtube.com/watch?v=${encodeURIComponent(details.trailer.id)}`} target="_blank" rel="noreferrer">Watch trailer</a>}
            </section>
          )}

          {!savedItem ? (
            <button className="primary-action details-add" type="button" onClick={() => onCreate({ ...record, totalEpisodes: details?.totalEpisodes, runtimeMinutes: details?.runtimeMinutes })}>Add to watchlist</button>
          ) : (
            <section className="details-tracking" aria-label="Watchlist tracking">
              <div className="tracking-heading">
                <div><p className="details-section-label">Your activity</p><h2>Track this title</h2></div>
                <button type="button" className={`details-favorite${savedItem.isFavorite ? ' is-active' : ''}`} aria-label={savedItem.isFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={Boolean(savedItem.isFavorite)} onClick={() => update({ isFavorite: !savedItem.isFavorite })}><span aria-hidden="true">{savedItem.isFavorite ? '♥' : '♡'}</span></button>
              </div>
              <fieldset className="status-choice-group">
                <legend>Watch status</legend>
                {statuses.map((status) => <button type="button" key={status} data-status={status} className={savedItem.status === status ? 'is-active' : ''} aria-pressed={savedItem.status === status} onClick={() => update({ status })}>{status}</button>)}
              </fieldset>
              <p className="tracking-date-hint">Started and completed dates are added automatically when you begin or finish a title. You can still edit them.</p>
              <div className="tracking-history-grid">
                <DateField label="Started" max={savedItem.completedAt ?? undefined} value={savedItem.startedAt} onChange={(startedAt) => update({ startedAt })} />
                <DateField label="Completed" min={savedItem.startedAt ?? undefined} value={savedItem.completedAt} onChange={(completedAt) => update({ completedAt })} />
                <label><span className="details-section-label">Rewatch count</span><input type="number" aria-label="Rewatch count" min="0" max="999" value={savedItem.rewatchCount ?? 0} onChange={(event) => { if (!Number.isNaN(event.currentTarget.valueAsNumber)) update({ rewatchCount: event.currentTarget.valueAsNumber }) }} /></label>
                <button type="button" className={`rewatch-toggle${savedItem.isRewatching ? ' is-active' : ''}`} aria-pressed={Boolean(savedItem.isRewatching)} onClick={() => update({ isRewatching: !savedItem.isRewatching })}><span aria-hidden="true">↻</span><strong>{savedItem.isRewatching ? 'Rewatching' : 'Start a rewatch'}</strong></button>
              </div>
              {record.type !== 'Movie' && <div className="tracking-row">
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
                <div><span className="details-section-label">My rating</span><strong>{savedItem.personalRating ? `${savedItem.personalRating} / 10` : 'Not rated'}</strong></div>
                <div className="rating-scale" aria-label="Choose your rating">{Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => <button type="button" key={rating} className={savedItem.personalRating === rating ? 'is-active' : ''} aria-label={`Rate ${rating} out of 10`} aria-pressed={savedItem.personalRating === rating} onClick={() => update({ personalRating: rating })}>{rating}</button>)}</div>
                {savedItem.personalRating != null && <button type="button" className="clear-rating" onClick={() => update({ personalRating: null })}>Clear rating</button>}
              </div>
              <label className="private-notes"><span className="details-section-label">Private notes</span><textarea key={`${savedItem.id}:${savedItem.privateNotes ?? ''}`} aria-label="Private notes" maxLength={5000} defaultValue={savedItem.privateNotes ?? ''} placeholder="Only you can see these notes." onBlur={(event) => update({ privateNotes: event.currentTarget.value })} /></label>
              <CustomListMemberships itemId={savedItem.id} />
              <WatchlistHistory itemId={savedItem.id} />
              <div className="details-danger-zone">
                <div><strong>Remove from AfterList</strong><span>Your tracking data for this title will be deleted.</span></div>
                <button className="delete-btn details-delete-btn" type="button" onClick={() => { onRemove(savedItem.id); navigate(backTarget, { replace: true }) }}>Remove title</button>
              </div>
            </section>
          )}
        </motion.div>
      </div>
    </motion.article>
  )
}
