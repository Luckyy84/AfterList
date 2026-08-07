import { adminClient, json } from '../_lib/afterlistApi.js'

const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'
const TMDB_TIMEOUT_MS = 10_000
const PAGE_SIZE = 1_000
const REFRESH_CONCURRENCY = 3

export type RefreshableWatchlistRow = {
  id: string
  external_id: string
  current_episode: number
  total_episodes: number | null
  runtime_minutes: number | null
  poster: string
  backdrop: string
}

export type TmdbRefreshDetails = {
  backdrop_path?: string | null
  episode_run_time?: number[]
  last_episode_to_air?: { runtime?: number | null } | null
  number_of_episodes?: number
  poster_path?: string | null
  runtime?: number | null
}

type MetadataPatch = Partial<Pick<RefreshableWatchlistRow,
  'total_episodes' | 'runtime_minutes' | 'poster' | 'backdrop'>>

function positiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : null
}

function imageUrl(path: string | null | undefined, size: 'w500' | 'w1280') {
  return path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : null
}

export function isBerlinRefreshHour(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Europe/Berlin',
  }).format(date) === '02'
}

export function buildMetadataPatch(row: RefreshableWatchlistRow, details: TmdbRefreshDetails): MetadataPatch {
  const patch: MetadataPatch = {}
  const poster = imageUrl(details.poster_path, 'w500')
  const backdrop = imageUrl(details.backdrop_path, 'w1280')
  const totalEpisodes = positiveInteger(details.number_of_episodes)
  const runtime = positiveInteger(details.runtime)
    ?? details.episode_run_time?.map(positiveInteger).find((value) => value !== null)
    ?? positiveInteger(details.last_episode_to_air?.runtime)

  if (poster && poster !== row.poster) patch.poster = poster
  if (backdrop && backdrop !== row.backdrop) patch.backdrop = backdrop
  if (runtime && runtime !== row.runtime_minutes) patch.runtime_minutes = runtime
  if (totalEpisodes) {
    const safeTotal = Math.max(totalEpisodes, row.current_episode)
    if (safeTotal !== row.total_episodes) patch.total_episodes = safeTotal
  }

  return patch
}

async function fetchTmdbDetails(externalId: string) {
  const match = /^(movie|tv):([1-9]\d*)$/.exec(externalId)
  if (!match) throw new Error(`Invalid TMDB external ID: ${externalId}`)

  const apiKey = process.env.TMDB_API_KEY?.trim()
  const accessToken = process.env.TMDB_ACCESS_TOKEN?.trim()
  if (!apiKey && !accessToken) throw new Error('TMDB is not configured.')

  const params = new URLSearchParams({ language: 'en-US' })
  if (!accessToken && apiKey) params.set('api_key', apiKey)

  const response = await fetch(`${TMDB_API_BASE_URL}/${match[1]}/${match[2]}?${params}`, {
    signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
    headers: {
      accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })
  if (!response.ok) throw new Error(`TMDB returned ${response.status} for ${externalId}`)
  return response.json() as Promise<TmdbRefreshDetails>
}

async function fetchWatchlistRows(client: ReturnType<typeof adminClient>) {
  const rows: RefreshableWatchlistRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('watchlist_items')
      .select('id,external_id,current_episode,total_episodes,runtime_minutes,poster,backdrop')
      .eq('source', 'tmdb')
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = (data ?? []) as RefreshableWatchlistRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return json({ error: 'Unauthorized.' }, 401)
  }

  if (!isBerlinRefreshHour(new Date())) {
    return json({ ok: true, skipped: true, reason: 'It is not 02:00 in Europe/Berlin.' })
  }

  try {
    const client = adminClient()
    const rows = await fetchWatchlistRows(client)
    const rowsByExternalId = new Map<string, RefreshableWatchlistRow[]>()
    for (const row of rows) {
      const matchingRows = rowsByExternalId.get(row.external_id) ?? []
      matchingRows.push(row)
      rowsByExternalId.set(row.external_id, matchingRows)
    }
    const groups = [...rowsByExternalId.entries()]
    let cursor = 0
    let updated = 0
    let failed = 0

    const refreshNext = async () => {
      while (true) {
        const group = groups[cursor]
        cursor += 1
        if (!group) return
        const [externalId, matchingRows] = group

        let details: TmdbRefreshDetails
        try {
          details = await fetchTmdbDetails(externalId)
        } catch (error) {
          failed += matchingRows.length
          console.error(`Daily metadata refresh failed for ${externalId}.`, error)
          continue
        }

        for (const row of matchingRows) {
          try {
            const patch = buildMetadataPatch(row, details)
            if (!Object.keys(patch).length) continue
            const { error } = await client.from('watchlist_items').update(patch).eq('id', row.id)
            if (error) throw error
            updated += 1
          } catch (error) {
            failed += 1
            console.error(`Daily metadata refresh failed for row ${row.id}.`, error)
          }
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(REFRESH_CONCURRENCY, groups.length) }, refreshNext))
    return json({ ok: true, scanned: rows.length, titles: groups.length, updated, failed })
  } catch (error) {
    console.error('Daily watchlist metadata refresh failed.', error)
    return json({ error: 'Daily watchlist metadata refresh failed.' }, 500)
  }
}
