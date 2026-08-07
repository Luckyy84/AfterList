import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildMetadataPatch, GET, isBerlinRefreshHour, type RefreshableWatchlistRow } from './refresh-watchlist'

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
