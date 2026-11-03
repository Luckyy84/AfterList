import { createClient } from '@supabase/supabase-js'
import { GET as tmdbDetails } from './details.js'
import { GET as anilistDetails } from './anilist.js'
import { publicJson, rateLimit } from './public/_lib.js'

const MAX_AGE_MS = 24 * 60 * 60 * 1000
export async function GET(request: Request) {
  const retry = rateLimit(request, 'catalog')
  if (retry) return publicJson({ error: 'Too many requests.' }, 429, { 'retry-after': String(retry) })
  const params = new URL(request.url).searchParams
  const query = params.get('q')?.trim()
  const source = params.get('source')
  const externalId = params.get('externalId') ?? ''
  if (query !== undefined ? query.length < 2 || query.length > 100 : !((source === 'tmdb' && /^(tv|movie):[1-9][0-9]{0,9}$/.test(externalId)) || (source === 'anilist' && /^[1-9][0-9]{0,9}$/.test(externalId)))) return publicJson({ error: 'Invalid catalog request.' }, 400)
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return publicJson({ error: 'Shared catalog is not configured.', catalog: { status: 'unconfigured' } }, 503)
  try {
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    if (query !== undefined) {
      const result = await db.rpc('search_media_catalog', { p_query: query, p_limit: 30 })
      if (result.error) return publicJson({ error: 'Catalog search needs the systems_tracking migration or is temporarily unavailable.', catalog: { status: 'migration-needed' } }, 503)
      return publicJson({ results: result.data ?? [] })
    }
    const stored = await db.from('media_catalog').select('payload,refreshed_at').eq('provider', source).eq('external_id', externalId).maybeSingle()
    if (stored.error) return publicJson({ error: 'Shared catalog needs the systems_tracking migration or is temporarily unavailable.', catalog: { status: 'migration-needed' } }, 503)
    const record = stored.data as { payload: Record<string, unknown>; refreshed_at: string } | null
    if (record && Date.now() - Date.parse(record.refreshed_at) < MAX_AGE_MS) return publicJson({ ...record.payload, catalog: { status: 'fresh', refreshedAt: record.refreshed_at } })
    if (source === 'anilist' && params.get('refresh') === 'false') {
      return record ? publicJson({ ...record.payload, catalog: { status: 'stale', refreshedAt: record.refreshed_at } }) : publicJson({ error: 'AniList integration is disabled.' }, 503)
    }
    // Reuse validated provider handlers; clients cannot write metadata snapshots.
    const providerUrl = new URL(request.url)
    providerUrl.search = source === 'anilist' ? new URLSearchParams({ operation: 'details', id: externalId }).toString() : new URLSearchParams({ externalId }).toString()
    const response = await (source === 'anilist' ? anilistDetails : tmdbDetails)(new Request(providerUrl, { signal: request.signal }))
    if (!response.ok) {
      if (record) return publicJson({ ...record.payload, catalog: { status: 'stale', refreshedAt: record.refreshed_at } })
      return response
    }
    const payload = await response.json() as { item: { title: string; source: string; externalId: string }; details: unknown }
    if (!payload.item || !payload.details || payload.item.source !== source || payload.item.externalId !== externalId) return publicJson({ error: 'Provider returned mismatched metadata.' }, 502)
    const refreshedAt = new Date().toISOString()
    const saved = await db.from('media_catalog').upsert({ provider: source, external_id: externalId, title: payload.item.title, payload, refreshed_at: refreshedAt }, { onConflict: 'provider,external_id' })
    return publicJson({ ...payload, catalog: { status: saved.error ? 'save-failed' : 'fresh', refreshedAt: saved.error ? null : refreshedAt } })
  } catch { return publicJson({ error: 'Shared catalog temporarily unavailable.' }, 503) }
}
