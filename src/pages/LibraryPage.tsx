import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import MediaCard from '../components/media/MediaCard'
import type { MediaItem, MediaStatus, MediaType, MediaUpdate } from '../types/media'

type LibraryPageProps = {
  items: MediaItem[]
  initialType?: MediaType
  onUpdate: (id: string, updates: MediaUpdate) => void
}

type SortOption = 'recent' | 'title' | 'rating'

export default function LibraryPage({ items, initialType, onUpdate }: LibraryPageProps) {
  const [type, setType] = useState<MediaType | 'All'>(initialType ?? 'All')
  const [status, setStatus] = useState<MediaStatus | 'All'>('All')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sort, setSort] = useState<SortOption>('recent')

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) =>
      (type === 'All' || item.type === type) &&
      (status === 'All' || item.status === status) &&
      (!favoritesOnly || item.isFavorite),
    )

    return [...filtered].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'rating') return (b.personalRating ?? 0) - (a.personalRating ?? 0)
      return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    })
  }, [favoritesOnly, items, sort, status, type])

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Your collection</p>
        <h1>Library</h1>
        <p>Everything you saved, with its status and progress visible at a glance.</p>
      </header>

      <section className="library-toolbar" aria-label="Library filters">
        <label>Media type
          <select value={type} onChange={(event) => setType(event.target.value as MediaType | 'All')}>
            <option>All</option><option>Anime</option><option>Movie</option><option>TV Series</option>
          </select>
        </label>
        <label>Status
          <select value={status} onChange={(event) => setStatus(event.target.value as MediaStatus | 'All')}>
            <option>All</option><option>Planned</option><option>Watching</option><option>Watched</option><option>Dropped</option>
          </select>
        </label>
        <label>Sort by
          <select value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
            <option value="recent">Recently updated</option><option value="title">Title</option><option value="rating">My rating</option>
          </select>
        </label>
        <label className="toggle-filter">
          <input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} /> Favorites
        </label>
      </section>

      <div className="section-head compact-section-head">
        <h2>{visibleItems.length} {visibleItems.length === 1 ? 'title' : 'titles'}</h2>
        {(type !== 'All' || status !== 'All' || favoritesOnly) && <button className="text-button" onClick={() => { setType(initialType ?? 'All'); setStatus('All'); setFavoritesOnly(false) }}>Clear filters</button>}
      </div>

      {visibleItems.length ? (
        <motion.div layout className="media-grid"><AnimatePresence mode="popLayout">{visibleItems.map((item) => <MediaCard key={item.id} item={item} onUpdate={onUpdate} />)}</AnimatePresence></motion.div>
      ) : (
        <div className="empty-state"><h3>No titles match</h3><p>Adjust the filters or use Search to add something new.</p></div>
      )}

    </>
  )
}
