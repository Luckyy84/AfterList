import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { fetchWatchlistEvents, type WatchlistEvent } from '../../services/mediaLibrary'

function summary(event: WatchlistEvent) {
  if (event.event_type === 'created') return 'Added to library'
  if (event.event_type === 'merged') return 'Matched duplicate entries'
  const next = event.new_value ?? {}
  const previous = event.old_value ?? {}
  if (next.status !== previous.status) return `Status changed to ${String(next.status)}`
  if (next.currentEpisode !== previous.currentEpisode) return `Progress updated to episode ${String(next.currentEpisode)}`
  if (next.personalRating !== previous.personalRating) return 'Rating updated'
  return 'Tracking updated'
}

export default function WatchlistHistory({ itemId }: { itemId: string }) {
  const { user } = useAuth(); const [events, setEvents] = useState<WatchlistEvent[]>([])
  useEffect(() => { if (user) void fetchWatchlistEvents(user.id, itemId, 3).then((recentEvents) => setEvents(recentEvents.slice(0, 3))).catch(() => setEvents([])) }, [itemId, user])
  if (!user || !events.length) return null
  return <section className="watchlist-history" aria-label="Activity history"><p className="details-section-label">Recent activity</p><ol>{events.map((event) => <li key={event.id}><span>{summary(event)}</span><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleDateString()}</time></li>)}</ol></section>
}
