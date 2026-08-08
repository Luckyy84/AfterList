import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MediaCard from '../components/media/MediaCard'
import { fetchPublicLibrary, fetchPublicList, fetchPublicProfile } from '../services/profiles'
import type { PublicMediaPage, PublicProfileResponse } from '../types/profile'

export default function PublicProfilePage({ mode }: { mode: 'overview' | 'library' | 'list' }) {
  const { username = '', listSlug = '' } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<PublicProfileResponse | PublicMediaPage | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    const controller = new AbortController()
    const previousTitle = document.title
    const request = mode === 'overview' ? fetchPublicProfile(username, controller.signal) : mode === 'library' ? fetchPublicLibrary(username, controller.signal) : fetchPublicList(username, listSlug, controller.signal)
    request.then((next) => {
      if (next.redirectUsername) {
        navigate(`/user/${next.redirectUsername}${mode === 'library' ? '/library' : mode === 'list' ? `/lists/${listSlug}` : ''}`, { replace: true })
        return
      }
      setData(next); setError(''); document.title = `${next.displayName || next.username} | AfterList`
    }).catch((cause) => { if (!controller.signal.aborted) setError((cause as { status?: number }).status === 429 ? 'Too many requests. Please try again shortly.' : cause instanceof Error ? cause.message : 'Profile unavailable.') })
    return () => { controller.abort(); document.title = previousTitle }
  }, [attempt, listSlug, mode, navigate, username])
  if (!data && !error) return <section className="public-profile-state" aria-busy="true" role="status"><h1>Loading profile…</h1></section>
  if (error) return <section className="empty-state public-profile-state" role="alert"><h1>Profile unavailable</h1><p>{error}</p><button className="primary-action" onClick={() => setAttempt((value) => value + 1)}>Try again</button></section>
  const resolved = data!
  const overview = mode === 'overview' ? resolved as PublicProfileResponse : null
  const page = mode !== 'overview' ? resolved as PublicMediaPage : null
  const items = overview?.favorites ?? page?.items ?? []
  return <article className="public-profile-page">
    <header className="public-profile-header">{overview?.avatarUrl && <img src={overview.avatarUrl} alt="" />}<div><p className="eyebrow">@{resolved.username}</p><h1>{page?.name ?? resolved.displayName ?? resolved.username}</h1>{overview?.bio && <p>{overview.bio}</p>}</div><button className="secondary-action" onClick={() => void navigator.clipboard?.writeText(window.location.href).then(() => setCopyState('copied')).catch(() => setCopyState('failed'))}>Share</button><span className="sr-only" aria-live="polite">{copyState === 'copied' ? 'Profile link copied.' : copyState === 'failed' ? 'Copy failed. Select the link shown.' : ''}</span>{copyState === 'failed' && <input aria-label="Profile share link" readOnly value={window.location.href} onFocus={(event) => event.currentTarget.select()} />}</header>
    <nav className="public-profile-tabs" aria-label="Profile sections"><Link to={`/user/${resolved.username}`}>Overview</Link><Link to={`/user/${resolved.username}/library`}>Library</Link></nav>
    {overview?.stats && <dl className="public-profile-stats">{Object.entries(overview.stats).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {overview?.externalLinks?.length ? <ul className="public-profile-links">{overview.externalLinks.map((link) => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer">{link.label}</a></li>)}</ul> : null}
    {overview?.lists?.length ? <nav className="public-list-links" aria-label="Public lists">{overview.lists.map((list) => <Link key={list.slug} to={`/user/${resolved.username}/lists/${list.slug}`}>{list.name}</Link>)}</nav> : null}
    <section><h2>{mode === 'overview' ? 'Favorites' : page?.name ?? 'Public library'}</h2>{items.length ? <div className="media-grid">{items.map((item) => <MediaCard key={item.id || `${item.source}:${item.externalId}`} item={item} />)}</div> : <div className="empty-state"><p>Nothing public here yet.</p></div>}</section>
  </article>
}
