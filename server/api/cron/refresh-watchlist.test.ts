import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildMetadataPatch, GET, isBerlinRefreshHour, type RefreshableWatchlistRow } from './refresh-watchlist'

const client = vi.hoisted(() => ({rpc:vi.fn(),from:vi.fn()}))
vi.mock('../_lib/afterlistApi.js', async (original) => ({...await original<typeof import('../_lib/afterlistApi.js')>(),adminClient:() => client}))

const row: RefreshableWatchlistRow = {
  id: 'row-1',
  external_id: 'tv:1',
  current_episode: 72,
  total_episodes: 2,
  runtime_minutes: 20,
  poster: 'old-poster',
  backdrop: 'old-backdrop',
}

afterEach(() => vi.unstubAllEnvs())

describe('daily watchlist metadata refresh', () => {
  it('reports migration needed before touching rows when durable jobs are unavailable', async () => {
    vi.stubEnv('CRON_SECRET','test-secret')
    client.rpc.mockResolvedValue({error:{code:'PGRST202'}})
    const response=await GET(new Request('https://test/api/cron/refresh-watchlist?force=true',{headers:{authorization:'Bearer test-secret'}}))
    expect(response.status).toBe(503)
    expect(await response.text()).toMatch(/migration/i)
    expect(client.from).not.toHaveBeenCalled()
  })
  it('does not execute a job already claimed or completed', async () => {
    vi.stubEnv('CRON_SECRET','test-secret')
    client.rpc.mockResolvedValue({data:null,error:null})
    const response=await GET(new Request('https://test/api/cron/refresh-watchlist?force=true',{headers:{authorization:'Bearer test-secret'}}))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({skipped:true})
    expect(client.from).not.toHaveBeenCalled()
  })
  it('exposes durable status without claiming or running the job', async () => {
    vi.stubEnv('CRON_SECRET','test-secret')
    client.rpc.mockClear()
    const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{status:'failed',attempts:3,failed:1},error:null})}
    client.from.mockReturnValue(query)
    const response=await GET(new Request('https://test/api/cron/refresh-watchlist?status=true',{headers:{authorization:'Bearer test-secret'}}))
    expect(await response.json()).toMatchObject({job:{status:'failed',attempts:3}})
    expect(client.rpc).not.toHaveBeenCalled()
    client.from.mockReset()
  })
  it('persists and reads back an empty successful job before reporting success', async () => {
    vi.stubEnv('CRON_SECRET','test-secret')
    client.rpc.mockReset().mockResolvedValueOnce({data:'lease',error:null}).mockResolvedValueOnce({data:true,error:null})
    const rows={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),range:vi.fn().mockResolvedValue({data:[],error:null})}
    const job={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),single:vi.fn().mockResolvedValue({data:{status:'succeeded',scanned:0},error:null})}
    client.from.mockImplementation((table) => table==='refresh_jobs'?job:rows)
    const response=await GET(new Request('https://test/api/cron/refresh-watchlist?force=true',{headers:{authorization:'Bearer test-secret'}}))
    expect(await response.json()).toMatchObject({ok:true,job:{status:'succeeded'},scanned:0})
    expect(client.rpc).toHaveBeenLastCalledWith('finish_refresh_job',expect.objectContaining({p_lease:'lease',p_ok:true}))
    client.from.mockReset()
  })
  it('reports a concurrently changed row as failed instead of claiming an update', async () => {
    vi.stubEnv('CRON_SECRET','test-secret');vi.stubEnv('TMDB_API_KEY','test')
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({number_of_episodes:100}))))
    client.rpc.mockReset().mockResolvedValueOnce({data:'lease',error:null}).mockResolvedValueOnce({data:true,error:null})
    const write={eq:vi.fn().mockReturnThis(),select:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:null,error:null})}
    const rows={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),range:vi.fn().mockResolvedValue({data:[row],error:null}),update:vi.fn().mockReturnValue(write)}
    const job={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),single:vi.fn().mockResolvedValue({data:{status:'failed'},error:null})}
    client.from.mockImplementation((table) => table==='refresh_jobs'?job:rows)
    const response=await GET(new Request('https://test/api/cron/refresh-watchlist?force=true',{headers:{authorization:'Bearer test-secret'}}))
    expect(response.status).toBe(502)
    expect(client.rpc).toHaveBeenLastCalledWith('finish_refresh_job',expect.objectContaining({p_ok:false,p_failed:1,p_updated:0}))
    client.from.mockReset();vi.unstubAllGlobals()
  })
  it('runs at 02:00 Berlin time in both summer and winter', () => {
    expect(isBerlinRefreshHour(new Date('2026-08-08T00:00:00Z'))).toBe(true)
    expect(isBerlinRefreshHour(new Date('2026-12-08T01:00:00Z'))).toBe(true)
    expect(isBerlinRefreshHour(new Date('2026-08-08T01:00:00Z'))).toBe(false)
  })

  it('updates artwork and metadata without lowering progress', () => {
    expect(buildMetadataPatch(row, {
      number_of_episodes: 24,
      episode_run_time: [25],
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
    })).toEqual({
      total_episodes: 72,
      runtime_minutes: 25,
      poster: 'https://image.tmdb.org/t/p/w500/poster.jpg',
      backdrop: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
    })
  })

  it('keeps existing artwork when TMDB has no image', () => {
    expect(buildMetadataPatch({ ...row, total_episodes: 72 }, {})).toEqual({})
  })

  it('rejects requests without the cron secret', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    const response = await GET(new Request('https://afterlist.test/api/cron/refresh-watchlist'))
    expect(response.status).toBe(401)
  })
})
