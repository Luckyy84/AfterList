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

  const force = new URL(request.url).searchParams.get('force') === 'true'

  const day = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  let lease: string | null = null
  let client: ReturnType<typeof adminClient> | null = null
  try {
    client = adminClient()
    if (new URL(request.url).searchParams.get('status') === 'true') {
      const status = await client.from('refresh_jobs').select('job_day,status,attempts,started_at,finished_at,scanned,updated,failed').eq('job_day',day).maybeSingle()
      if (status.error) return json({error:status.error.code === '42P01' || status.error.code === 'PGRST205' ? 'Systems reliability migration needed.' : 'Could not read job status.'},503)
      return json({job:status.data})
    }
    const claim = await client.rpc('claim_refresh_job', {p_day:day,p_start:force || isBerlinRefreshHour(new Date())})
    if (claim.error) return json({error: claim.error.code === 'PGRST202' || claim.error.code === '42883'
      ? 'Systems reliability migration needed; no refresh was run.' : 'Could not claim durable refresh job.'},503)
    lease = claim.data as string | null
    if (!lease) return json({skipped:true,reason:'Daily job is running, complete, or retries exhausted.'})
    const deadline = Date.now()+45_000
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
        if (Date.now() > deadline) { failed += matchingRows.length; continue }

        let details: TmdbRefreshDetails
        try {
          details = await fetchTmdbDetails(externalId)
        } catch {
          failed += matchingRows.length
          console.error('Daily metadata provider request failed.')
          continue
        }

        for (const row of matchingRows) {
          try {
            const patch = buildMetadataPatch(row, details)
            if (!Object.keys(patch).length) continue
            const { data, error } = await client!.from('watchlist_items').update(patch).eq('id', row.id).eq('current_episode',row.current_episode).select('id').maybeSingle()
            if (error || !data) throw new Error('Row changed while refreshing')
            updated += 1
          } catch {
            failed += 1
            console.error('Daily metadata row refresh failed.')
          }
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(REFRESH_CONCURRENCY, groups.length) }, refreshNext))
    const finished = await client.rpc('finish_refresh_job', {p_day:day,p_lease:lease,p_ok:failed===0,p_scanned:rows.length,p_updated:updated,p_failed:failed})
    if (finished.error || !finished.data) return json({error:'Could not persist refresh result; inspect durable job status.'},503)
    const check = await client.from('refresh_jobs').select('job_day,status,attempts,scanned,updated,failed').eq('job_day',day).single()
    if (check.error || check.data?.status !== (failed ? 'failed' : 'succeeded')) return json({error:'Refresh status verification failed.'},503)
    return json({ ok: failed===0, job:check.data, scanned: rows.length, titles: groups.length, updated, failed },failed ? 502 : 200)
  } catch {
    if (client && lease) await client.rpc('finish_refresh_job', {p_day:day,p_lease:lease,p_ok:false,p_scanned:0,p_updated:0,p_failed:1}).then(() => undefined, () => undefined)
    console.error('Daily watchlist metadata refresh failed.')
    return json({ error: 'Daily watchlist metadata refresh failed.' }, 500)
  }
}
