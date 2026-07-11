import type { MediaItem } from '../types/media'

export default function StatisticsPage({ items }: { items: MediaItem[] }) {
  const watched = items.filter((item) => item.status === 'Watched').length
  const ratings = items.flatMap((item) => item.personalRating == null ? [] : [item.personalRating])
  const metrics = [
    ['Total titles', items.length],
    ['Completed', watched],
    ['Completion rate', items.length ? `${Math.round(watched / items.length * 100)}%` : '0%'],
    ['Favorites', items.filter((item) => item.isFavorite).length],
    ['Average rating', ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : '—'],
    ['Episodes watched', items.reduce((sum, item) => sum + (item.currentEpisode ?? 0), 0)],
    ...(['Planned', 'Watching', 'Watched', 'Dropped'] as const).map((status) => [`${status} titles`, items.filter((item) => item.status === status).length]),
    ...(['Anime', 'Movie', 'TV Series'] as const).map((type) => [`${type} titles`, items.filter((item) => item.type === type).length]),
  ]

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Your viewing</p>
        <h1>Statistics</h1>
        <p>A truthful snapshot calculated from your current library.</p>
      </header>
      <section className="stat-grid" aria-label="Watchlist statistics">
        {metrics.map(([label, value]) => <article className="stat-card" key={label}><strong>{value}</strong><span>{label}</span></article>)}
      </section>
      {!items.length && <div className="empty-state stats-empty"><h3>Your story starts with one title</h3><p>Use Search to add something; statistics will appear automatically.</p></div>}
    </>
  )
}
