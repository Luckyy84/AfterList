import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  adminClient: vi.fn(),
  authenticateIntegration: vi.fn(),
}))

vi.mock('../_lib/afterlistApi.js', () => ({
  adminClient: apiMocks.adminClient,
  authenticateIntegration: apiMocks.authenticateIntegration,
  hashToken: (value: string) => value,
  json: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
}))

import { GET, PUT, cumulativeEpisode } from './watchlist'

beforeEach(() => {
  vi.clearAllMocks()
  apiMocks.authenticateIntegration.mockResolvedValue({ user_id: 'user-1', rawToken: 'token' })
})

describe('Jellyfin episode progress', () => {
  it('maps a season episode to its show-wide episode number and ignores specials', () => {
    expect(cumulativeEpisode([
      { season_number: 0, episode_count: 5 },
      { season_number: 1, episode_count: 24 },
      { season_number: 2, episode_count: 24 },
      { season_number: 3, episode_count: 24 },
      { season_number: 4, episode_count: 24 },
    ], 4, 2)).toBe(74)
  })
})

describe('v1 watchlist reads', () => {
  it('returns only active rows through the stable legacy projection', async () => {
    const query: Record<string, ReturnType<typeof vi.fn>> & { then?: unknown } = {
      select: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn(), gt: vi.fn(),
    }
    for (const method of ['select', 'eq', 'is', 'order', 'gt'] as const) query[method].mockReturnValue(query)
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [{ id: 'visible' }], error: null }).then(resolve)
    apiMocks.adminClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) })

    const response = await GET(new Request('http://localhost/api/v1/watchlist'))
    const projection = query.select.mock.calls[0][0] as string

    expect(response.status).toBe(200)
    expect(query.is).toHaveBeenCalledWith('merged_into_id', null)
    expect(projection).toContain('external_id')
    expect(projection).toContain('current_episode')
    expect(projection).not.toContain('media_id')
    expect(projection).not.toContain('merged_into_id')
    expect(projection).not.toContain('private_notes')
    await expect(response.json()).resolves.toEqual({ items: [{ id: 'visible' }] })
  })
})

describe('v1 watchlist writes', () => {
  it('marks a series watched and dates completion when progress reaches the total', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { applied: true }, error: null })
    apiMocks.adminClient.mockReturnValue({ rpc })

    const response = await PUT(new Request('http://localhost/api/v1/watchlist', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source: 'tmdb', externalId: 'tv:12', title: 'Show', type: 'TV Series', status: 'Watching',
        currentEpisode: 12, totalEpisodes: 12, updatedAt: '2026-08-18T09:00:00.000Z',
      }),
    }))

    expect(response.status).toBe(200)
    expect(rpc.mock.calls[0][1].p_item).toMatchObject({
      status: 'Watched', current_episode: 12, total_episodes: 12, completed_on: '2026-08-18',
    })
  })

  it('passes an explicit rewatch transition and fresh start date to the database', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { applied: true }, error: null })
    apiMocks.adminClient.mockReturnValue({ rpc })

    await PUT(new Request('http://localhost/api/v1/watchlist', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source: 'tmdb', externalId: 'tv:12', title: 'Show', type: 'TV Series', status: 'Watching',
        currentEpisode: 0, totalEpisodes: 12, isRewatching: true, updatedAt: '2026-08-18T09:00:00.000Z',
      }),
    }))

    expect(rpc.mock.calls[0][1].p_item).toMatchObject({
      status: 'Watching', current_episode: 0, is_rewatching: true,
      started_on: '2026-08-18', completed_on: null,
    })
  })
})
