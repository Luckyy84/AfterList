import { useEffect, useMemo, useState } from 'react'
import MediaCard from '../components/media/MediaCard'
import type { MediaItem, MediaStatus, MediaUpdate } from '../types/media'
import type { SearchResultItem } from '../types/search'
import { discoverTmdb } from '../services/tmdb'
import { findMatchingMediaItem } from '../utils/media'

type DiscoverPageProps = {
  items: MediaItem[]
  onCreate: (item: MediaItem) => void
  onUpdate: (id: string, updates: MediaUpdate) => void
}

function toMediaItem(result: SearchResultItem): MediaItem {
  return { id: `${result.source}-${result.externalId}`, externalId: result.externalId, source: result.source, title: result.title, type: result.type, status: 'Planned', poster: result.poster, backdrop: result.backdrop, progress: result.year, rating: result.rating, description: result.description, year: result.year }
}

const genreIds: Record<string, number[]> = {
  action: [28, 10759], animation: [16], comedy: [35], drama: [18],
  fantasy: [14, 10765], horror: [27], documentary: [99],
}

export default function DiscoverPage({ items, onCreate, onUpdate }: DiscoverPageProps) {
  const [feed, setFeed] = useState<'trending' | 'popular'>('trending')
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>('all')
  const [genre, setGenre] = useState('all')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    discoverTmdb({ feed, mediaType, page: 1, signal: controller.signal })
      .then(setResults)
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Discovery is unavailable.') })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false) })
    return () => controller.abort()
  }, [feed, mediaType, requestVersion])

  const cards = useMemo(() => results
    .filter((result) => genre === 'all' || result.genreIds?.some((id) => genreIds[genre].includes(id)))
    .map((result) => ({ result, item: findMatchingMediaItem(items, result) ?? toMediaItem(result) })), [genre, items, results])

  const add = (item: MediaItem, status: MediaStatus = 'Planned') => {
    onCreate({ ...item, status, progress: status === 'Watched' ? 'Watched' : item.progress })
  }

  return (
    <>
      <header className="page-intro discover-intro">
        <p className="eyebrow">Discover without signing in</p>
        <h1>Find your next story.</h1>
        <p>Browse real TMDB titles before signing in. Save anything to your guest library with one clear action.</p>
      </header>
      <div className="choice-row" aria-label="Choose discovery feed">
        {(['trending', 'popular'] as const).map((value) => <button key={value} className={feed === value ? 'is-active' : ''} aria-pressed={feed === value} onClick={() => { if (value === feed) return; setIsLoading(true); setError(''); setFeed(value) }}>{value === 'trending' ? 'Trending' : 'Popular'}</button>)}
      </div>
      <div className="choice-row" aria-label="Filter discovery by media type">
        {(['all', 'movie', 'tv'] as const).map((value) => <button key={value} className={mediaType === value ? 'is-active' : ''} aria-pressed={mediaType === value} onClick={() => { if (value === mediaType) return; setIsLoading(true); setError(''); setMediaType(value) }}>{value === 'all' ? 'All media' : value === 'movie' ? 'Movies' : 'TV & anime'}</button>)}
      </div>
      <label className="genre-filter">Genre
        <select value={genre} onChange={(event) => setGenre(event.target.value)}>
          <option value="all">All genres</option><option value="action">Action</option><option value="animation">Animation</option><option value="comedy">Comedy</option><option value="drama">Drama</option><option value="fantasy">Fantasy</option><option value="horror">Horror</option><option value="documentary">Documentary</option>
        </select>
      </label>
      {isLoading && <div className="empty-state" aria-live="polite"><h3>Finding what’s trending…</h3><p>Loading public TMDB discovery results.</p></div>}
      {error && <div className="empty-state error-state"><h3>Discovery is unavailable</h3><p>{error}</p><button className="secondary-action" type="button" onClick={() => { setIsLoading(true); setError(''); setRequestVersion((version) => version + 1) }}>Try again</button></div>}
      {!isLoading && !error && !cards.length && <div className="empty-state"><h3>No titles found</h3><p>Try another media filter or use Search.</p></div>}
      <div className="media-grid discover-grid">
        {cards.map(({ result, item }) => {
          const isSaved = Boolean(findMatchingMediaItem(items, result))
          return <MediaCard key={`${result.source}-${result.externalId}`} item={item} isSaved={isSaved} onAdd={isSaved ? undefined : add} onUpdate={isSaved ? onUpdate : undefined} animateLayout={false} />
        })}
      </div>
    </>
  )
}
