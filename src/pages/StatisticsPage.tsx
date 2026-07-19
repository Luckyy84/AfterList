import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react'
import { canFetchTmdbDetails, fetchTmdbDetails } from '../services/tmdb'
import type { MediaItem, MediaStatus, MediaType, MediaUpdate } from '../types/media'
import { calculateStatistics, formatWatchTime, getWatchedEpisodeCount } from '../utils/statistics'

const statuses: MediaStatus[] = ['Planned', 'Watching', 'Watched', 'Dropped']
const mediaTypes: MediaType[] = ['Anime', 'Movie', 'TV Series']
const typeLabels: Record<MediaType, string> = { Anime: 'Anime', Movie: 'Movies', 'TV Series': 'TV Series' }
const BACKFILL_CONCURRENCY = 3

function MetricIcon({ name }: { name: 'heart' | 'star' | 'play' | 'anime' | 'movie' | 'series' }) {
  const paths = {
    heart: <path d="M12 20.5 4.6 13.4A4.8 4.8 0 0 1 11.4 6.6l.6.6.6-.6a4.8 4.8 0 0 1 6.8 6.8Z" />,
    star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />,
    play: <path d="m8 4 11 8-11 8Z" />,
    anime: <><rect x="3" y="4" width="18" height="13" rx="1.5" /><path d="M8 21h8M12 17v4" /></>,
    movie: <><path d="M4 9h16v11H4zM4 9l15-4 1 4M8 7l2 2M14 5.5 16 8" /></>,
    series: <><rect x="3" y="4" width="18" height="13" rx="1.5" /><path d="M7 21h10" /></>,
  }

  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

type StatisticsPageProps = {
  items: MediaItem[]
  onUpdate: (id: string, updates: MediaUpdate) => void | Promise<void>
}

export default function StatisticsPage({ items, onUpdate }: StatisticsPageProps) {
  const statistics = calculateStatistics(items)
  const attemptedIdsRef = useRef(new Set<string>())
  const itemIdentityKey = items.map((item) => item.id).join('|')
  const [runtimeState, setRuntimeState] = useState<'ready' | 'loading' | 'partial'>(() =>
    items.some((item) => !item.runtimeMinutes && canFetchTmdbDetails(item)) ? 'loading' : 'ready')

  const backfillRuntimes = useEffectEvent(async (signal: AbortSignal) => {
    const candidates = items.filter((item) =>
      !item.runtimeMinutes && canFetchTmdbDetails(item) && !attemptedIdsRef.current.has(item.id))
    const hasUnresolvableRuntime = items.some((item) => {
      const contributesWatchTime = item.type === 'Movie' ? item.status === 'Watched' : getWatchedEpisodeCount(item) > 0
      return contributesWatchTime && !item.runtimeMinutes && !canFetchTmdbDetails(item)
    })

    if (!candidates.length) {
      setRuntimeState(hasUnresolvableRuntime ? 'partial' : 'ready')
      return
    }

    let cursor = 0
    let failed = hasUnresolvableRuntime
    setRuntimeState('loading')

    const backfillNext = async () => {
      while (!signal.aborted) {
        const item = candidates[cursor]
        cursor += 1
        if (!item) return
        attemptedIdsRef.current.add(item.id)

        try {
          const details = await fetchTmdbDetails(item, { signal })
          if (!details?.runtimeMinutes) {
            failed = true
            continue
          }
          await onUpdate(item.id, {
            runtimeMinutes: details.runtimeMinutes,
            totalEpisodes: details.totalEpisodes ?? item.totalEpisodes,
          })
        } catch {
          if (signal.aborted) attemptedIdsRef.current.delete(item.id)
          else failed = true
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(BACKFILL_CONCURRENCY, candidates.length) }, backfillNext))
    if (!signal.aborted) setRuntimeState(failed ? 'partial' : 'ready')
  })

  useEffect(() => {
    const controller = new AbortController()
    void backfillRuntimes(controller.signal)

    return () => controller.abort()
  }, [itemIdentityKey])

  const watchTime = formatWatchTime(statistics.watchMinutes)
  const watchTimeParts = watchTime.split(' ')
  const completionStyle = { '--completion': statistics.completionRate } as CSSProperties

  return (
    <div className="stats-page">
      <header className="stats-intro">
        <h1>Statistics</h1>
        <p>A truthful snapshot calculated from your current library.</p>
      </header>

      {!items.length ? (
        <div className="empty-state stats-empty">
          <h3>Your story starts with one title</h3>
          <p>Use Search to add something; statistics will appear automatically.</p>
        </div>
      ) : (
        <section className="stats-dashboard" aria-label="Watchlist statistics">
          <div className="stats-primary">
            <div className="stats-total">
              <strong>{statistics.totalTitles}</strong>
              <span>Total titles</span>
            </div>

            <div className="stats-completion">
              <div className="completion-ring" style={completionStyle} role="img" aria-label={`${statistics.completionRate}% completion rate`}>
                <strong>{statistics.completionRate}%</strong>
              </div>
              <div><strong>Completion rate</strong><span>of titles completed</span></div>
            </div>

            <div className="stats-watch-time" aria-live="polite">
              <span>Estimated watch time</span>
              <strong data-testid="watch-time-value">
                {runtimeState === 'loading' ? '—' : watchTimeParts.map((part, index) => <b className={index === watchTimeParts.length - 1 ? 'is-accent' : ''} key={part}>{part}</b>)}
              </strong>
              <small>{runtimeState === 'loading' ? 'Calculating from TMDB runtimes…' : runtimeState === 'partial' ? 'Some runtimes unavailable' : 'across all titles'}</small>
            </div>
          </div>

          <div className="stats-secondary" aria-label="Activity summary">
            {([
              ['heart', 'Favorites', statistics.favorites],
              ['star', 'Average rating', statistics.averageRating],
              ['play', 'Episodes watched', statistics.episodesWatched],
            ] as const).map(([icon, label, value]) => (
              <div className="stats-secondary-item" key={label}>
                <MetricIcon name={icon} />
                <span><small>{label}</small><strong>{value}</strong></span>
              </div>
            ))}
          </div>

          <section className="stats-breakdown stats-statuses" aria-labelledby="statuses-heading">
            <h2 id="statuses-heading">All statuses</h2>
            <div className="status-distribution" aria-hidden="true">
              {statuses.map((status) => {
                const count = statistics.statusCounts[status]
                const percentage = count / statistics.totalTitles * 100
                return <span className={`status-segment is-${status.toLowerCase()}`} style={{ width: `${percentage}%` }} key={status}>{percentage >= 8 ? count : ''}</span>
              })}
            </div>
            <div className="status-legend">
              {statuses.map((status) => (
                <div key={status}><span className={`status-dot is-${status.toLowerCase()}`} /><span>{status}<strong>{statistics.statusCounts[status]}</strong></span></div>
              ))}
            </div>
          </section>

          <section className="stats-breakdown stats-types" aria-labelledby="types-heading">
            <h2 id="types-heading">All types</h2>
            <div className="type-breakdown-list">
              {mediaTypes.map((type) => {
                const count = statistics.typeCounts[type]
                const percentage = Math.round(count / statistics.totalTitles * 100)
                const icon = type === 'Anime' ? 'anime' : type === 'Movie' ? 'movie' : 'series'
                return (
                  <div className="type-breakdown" key={type}>
                    <MetricIcon name={icon} />
                    <div><span><strong>{typeLabels[type]}</strong><b>{count}</b></span><div className="type-track"><i style={{ width: `${percentage}%` }} /></div><small>{percentage}%</small></div>
                  </div>
                )
              })}
            </div>
          </section>
        </section>
      )}
    </div>
  )
}
