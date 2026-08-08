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

import { GET, cumulativeEpisode } from './watchlist'

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
