import { useState } from 'react'
import { Link } from 'react-router-dom'
import { searchCatalog, type CatalogEntry } from '../../services/catalog'
import { getMediaPath } from '../../utils/mediaRoutes'
export default function CatalogSearch() {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<CatalogEntry[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <details className="catalog-search"><summary>Search shared metadata catalog</summary><p>Indexed title-word search over previously fetched metadata. Use global Search for new provider titles.</p><form onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    try { setRows(await searchCatalog(query)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Catalog unavailable.') } finally { setBusy(false) }
  }}><label>Search shared catalog <input aria-label="Search shared catalog" minLength={2} maxLength={100} required value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></label><button disabled={busy} type="submit">Search catalog</button></form>{error && <p role="alert">{error}</p>}{rows && <><p aria-live="polite">{rows.length} matches{rows.length === 30 ? ' (first 30)' : ''}</p><ul>{rows.map((row) => <li key={`${row.provider}:${row.external_id}`}><Link to={getMediaPath(row.payload.item)}>{row.title}</Link> · {row.provider} · refreshed <time dateTime={row.refreshed_at}>{new Date(row.refreshed_at).toLocaleDateString()}</time></li>)}</ul></>}</details>
}
