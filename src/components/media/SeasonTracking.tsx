import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { fetchSeasonProgress, saveSeasonProgress, libraryError, type SeasonProgress } from '../../services/mediaLibrary'
import type { MediaSource } from '../../types/media'

export default function SeasonTracking({ itemId, source }: { itemId: string; source?: MediaSource }) {
  const { user } = useAuth()
  const userId = user?.id
  const [rows, setRows] = useState<SeasonProgress[]>([])
  const [season, setSeason] = useState(1)
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!userId) return
    let active = true
    fetchSeasonProgress(itemId).then((next) => { if (active) { setRows(next); setReady(true); setBusy(false) } }).catch((cause) => { if (active) { setError(libraryError(cause)); setBusy(false) } })
    return () => { active = false }
  }, [itemId, userId])
  if (!userId) return <p>Sign in to track seasons.</p>
  return <section className="season-tracking" aria-label="Season tracking">
    <h3>Season progress</h3>
    <p>Season counters are separate from your existing title progress. No individual episode history is recorded.</p>
    {source === 'anilist' && <p>AniList has a separate title for each season or cour. Use this title's season 1; sequels stay separate.</p>}
    <form onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError('')
      try { const row = await saveSeasonProgress(itemId, source === 'anilist' ? 1 : season, current, total === '' ? null : Number(total)); setRows((previous) => [...previous.filter((r) => r.season !== row.season), row].sort((a, b) => a.season - b.season)) }
      catch (cause) { setError(libraryError(cause)) } finally { setBusy(false) }
    }}>
      {source !== 'anilist' && <label>Season <input aria-label="Season number" type="number" min="0" max="999" required value={season} onChange={(event) => setSeason(event.currentTarget.valueAsNumber)} /></label>}
      <label>Progress <input aria-label="Season progress" type="number" min="0" max={total || 10000} required value={current} onChange={(event) => setCurrent(event.currentTarget.valueAsNumber)} /></label>
      <label>Total (optional) <input aria-label="Season total" type="number" min="1" max="10000" value={total} onChange={(event) => setTotal(event.currentTarget.value)} /></label>
      <button disabled={busy || !ready} type="submit">Save season</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {ready && (!rows.length ? <p>No season progress yet.</p> : <ul>{rows.map((row) => <li key={row.season}><span>Season {row.season}: {row.current_episode} / {row.total_episodes ?? '?'}</span> <button type="button" disabled={busy} onClick={() => { setSeason(row.season); setCurrent(row.current_episode); setTotal(row.total_episodes?.toString() ?? '') }}>Edit season {row.season}</button></li>)}</ul>)}
  </section>
}
