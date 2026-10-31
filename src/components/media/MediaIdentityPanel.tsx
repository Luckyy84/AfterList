import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { fetchMediaIdentityAudit, saveAnimeSeasonMatch, undoMediaMerge, libraryError, type MediaIdentityAudit } from '../../services/mediaLibrary'
import type { MediaSource } from '../../types/media'

export default function MediaIdentityPanel({ itemId, source, externalId }: { itemId: string; source?: MediaSource; externalId?: string }) {
  const { user } = useAuth()
  const userId = user?.id
  const [data, setData] = useState<MediaIdentityAudit | null>(null)
  const [season, setSeason] = useState(1)
  const [anilistId, setAnilistId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!userId) return
    let alive = true
    fetchMediaIdentityAudit(itemId, userId).then((next) => { if (alive) setData(next) }).catch((cause) => { if (alive) setError(libraryError(cause)) })
    return () => { alive = false }
  }, [itemId, userId])
  if (!userId) return null
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('')
    try { await action(); setData(await fetchMediaIdentityAudit(itemId, userId)) } catch (cause) { setError(libraryError(cause)) } finally { setBusy(false) }
  }
  return <details className="media-identity-panel"><summary>Provider identities and match audit</summary><p>Source: {source}:{externalId}</p>
    {source === 'tmdb' && externalId?.startsWith('tv:') && data && <section aria-label="Anime season matching"><h3>Match an AniList season</h3><p>Add the AniList title to your library first. Match it to one TMDB season without merging titles or progress. Split cours need separate titles; one match is supported per TMDB season.</p>
      <form onSubmit={(event) => { event.preventDefault(); void run(async () => { await saveAnimeSeasonMatch(itemId, season, anilistId); setMessage('Season match saved; title progress stays separate.') }) }}>
        <label>TMDB season <input aria-label="Match season" type="number" min="1" max="999" required value={season} onChange={(event) => setSeason(event.currentTarget.valueAsNumber)} /></label>
        <label>AniList ID <input aria-label="AniList season ID" inputMode="numeric" pattern="[1-9][0-9]{0,9}" required value={anilistId} onChange={(event) => setAnilistId(event.currentTarget.value)} /></label><button type="submit" disabled={busy}>Match season</button>
      </form><ul>{data.seasons.map((row) => <li key={row.season}>TMDB season {row.season} ↔ AniList {row.anilist_external_id} <button type="button" disabled={busy} onClick={() => void run(async () => { await saveAnimeSeasonMatch(itemId, row.season, null); setMessage('Season match removed.') })}>Remove season {row.season} match</button></li>)}</ul>
    </section>}
    {data?.merged.length ? <section><h3>Retained merged identities</h3><p>Restore separates identities only. Combined winner notes, progress and list memberships stay unchanged to preserve later edits. Reload the library after restoring.</p><ul>{data.merged.map((row) => <li key={row.id}>{row.title} ({row.source}:{row.external_id}) <button type="button" disabled={busy} onClick={() => void run(async () => { await undoMediaMerge(itemId, row.id); setMessage('Identity restored. Reload the library to see both titles.') })}>Restore {row.title}</button></li>)}</ul></section> : null}
    {data && <section><h3>Recent account match decisions</h3><ol>{data.audit.map((row) => <li key={row.id}>{row.alias_a} ↔ {row.alias_b}: {row.old_decision ?? 'unset'} → {row.new_decision ?? 'removed'} <time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time></li>)}</ol>{!data.audit.length && <p>No decisions recorded since the migration.</p>}</section>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </details>
}
