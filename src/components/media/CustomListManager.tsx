import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { createCustomList, fetchCustomLists, fetchCustomListItems, saveCustomListItems, reorderCustomLists, libraryError, type CustomList } from '../../services/mediaLibrary'
import { fetchOwnProfile, setCustomListPublic } from '../../services/profiles'
import type { MediaItem } from '../../types/media'

export default function CustomListManager({ items }: { items: MediaItem[] }) {
  const { user } = useAuth()
  return user ? <OwnerCustomListManager key={user.id} userId={user.id} items={items} /> : null
}

function OwnerCustomListManager({ items, userId }: { items: MediaItem[]; userId: string }) {
  const [lists, setLists] = useState<CustomList[]>([])
  const [active, setActive] = useState<CustomList | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [publicUsername, setPublicUsername] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    let alive = true
    fetchCustomLists(userId).then((rows) => { if (alive) setLists(rows) }).catch((cause) => { if (alive) setError(libraryError(cause)) })
    fetchOwnProfile(userId).then((profile) => { if (alive && profile?.is_public) setPublicUsername(profile.username ?? '') }).catch(() => {})
    return () => { alive = false }
  }, [userId])
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('')
    try { await action() } catch (cause) { setError(libraryError(cause)) } finally { setBusy(false) }
  }
  const visible = items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
  return <details className="custom-list-manager"><summary>Manage custom lists</summary>
    <form onSubmit={(event) => { event.preventDefault(); void run(async () => { const created = await createCustomList(userId, name); setLists((previous) => [...previous, created]); setName('') }) }}>
      <label>New list name <input required maxLength={80} value={name} onChange={(event) => setName(event.currentTarget.value)} /></label><button disabled={busy} type="submit">Create list</button>
    </form>
    <ol>{lists.map((list, index) => <li key={list.id}>{list.name} <button disabled={busy} type="button" aria-label={`Edit ${list.name}`} onClick={() => { setActive(list); setReady(false); void run(async () => { setSelected(await fetchCustomListItems(list.id, userId)); setReady(true) }) }}>Edit</button> <button disabled={busy || index === 0} type="button" aria-label={`Move ${list.name} earlier`} onClick={() => void run(async () => { const next = [...lists]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; await reorderCustomLists(next.map((row) => row.id)); setLists(next) })}>↑</button></li>)}</ol>
    {active && ready && <section aria-label={`Edit ${active.name}`}><h3>{active.name}</h3>
      <label><input type="checkbox" disabled={busy} checked={active.is_public} onChange={(event) => { const isPublic = event.currentTarget.checked; void run(async () => { await setCustomListPublic(active.id, userId, isPublic); const next = { ...active, is_public: isPublic }; setActive(next); setLists((previous) => previous.map((row) => row.id === next.id ? next : row)) }) }} />Public list</label>
      {active.is_public && (publicUsername ? <p>Share: <Link to={`/user/${publicUsername}/lists/${active.slug}`}>/user/{publicUsername}/lists/{active.slug}</Link></p> : <p>Publish your profile and claim a username in Settings before sharing this list.</p>)}
      <label>Find library titles <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></label>
      <button disabled={busy} type="button" onClick={() => setSelected((previous) => [...new Set([...previous, ...visible.map((item) => item.id)])])}>Select all matching</button> <button disabled={busy} type="button" onClick={() => setSelected([])}>Clear selection</button>
      <div>{visible.map((item) => <label key={item.id}><input aria-label={`Include ${item.title}`} type="checkbox" disabled={busy} checked={selected.includes(item.id)} onChange={(event) => { const included = event.currentTarget.checked; setSelected((previous) => included ? [...previous, item.id] : previous.filter((id) => id !== item.id)) }} />{item.title}</label>)}</div>
      <ol aria-label="Selected title order">{selected.map((id, index) => <li key={id}>{items.find((item) => item.id === id)?.title ?? 'Title not loaded (retained)'} <button disabled={busy || index === 0} type="button" aria-label={`Move selected title ${index + 1} earlier`} onClick={() => setSelected((previous) => { const next = [...previous]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next })}>↑</button></li>)}</ol>
      <button disabled={busy} type="button" onClick={() => void run(async () => { await saveCustomListItems(active.id, selected); setMessage('List saved.') })}>Save ordered selection</button>
    </section>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </details>
}
