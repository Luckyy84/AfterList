import { useEffect, useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { fetchTmdbMedia } from '../services/tmdb'
import type { MediaItem } from '../types/media'
import { getMediaPath, mediaIdentityMatches, parseTmdbExternalId } from '../utils/mediaRoutes'

type LegacyState = { from?: string; item?: MediaItem }

export default function LegacyMediaDetailsRoute() {
  const { source, externalId } = useParams()
  const location = useLocation()
  const state = (location.state as LegacyState | null) ?? null
  const validExternalId = source === 'tmdb' && parseTmdbExternalId(externalId) ? externalId! : ''
  const seed = state?.item && mediaIdentityMatches(state.item, 'tmdb', validExternalId) ? state.item : null
  const [item, setItem] = useState<MediaItem | null>(seed)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    if (seed || !validExternalId) return undefined
    const controller = new AbortController()
    fetchTmdbMedia(validExternalId, { signal: controller.signal })
      .then((response) => setItem(response.item))
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Details are unavailable.')
      })
    return () => controller.abort()
  }, [requestVersion, seed, validExternalId])

  if (item) return <Navigate replace to={getMediaPath(item)} state={state} />
  if (!validExternalId) return <Navigate replace to="/discover" />
  if (error) return <section className="empty-state details-not-found" role="alert"><h1>Title unavailable</h1><p>{error}</p><button className="primary-action" type="button" onClick={() => { setError(''); setRequestVersion((version) => version + 1) }}>Try again</button></section>
  return <section className="empty-state details-not-found" aria-busy="true" role="status"><h1>Loading title…</h1><p>Updating this saved link.</p></section>
}
