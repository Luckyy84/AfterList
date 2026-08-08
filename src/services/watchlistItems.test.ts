import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCloudWatchlist, type WatchlistItemRow } from './watchlistItems'

const mocks = vi.hoisted(() => ({ from: vi.fn(), is: vi.fn(), aliasError: false }))
vi.mock('./supabase', () => ({ supabase: { from: mocks.from } }))

const row: WatchlistItemRow = {
  id: 'w1', user_id: 'u1', external_id: 'tv:1', source: 'tmdb', title: 'Show', type: 'Anime', status: 'Watching', poster: '', backdrop: '', progress: '2026', rating: '8', description: '', year: '2026', current_episode: 1, total_episodes: 12, runtime_minutes: 24, personal_rating: null, is_favorite: false, media_id: 'media-1', is_rewatching: false, rewatch_count: 0, started_on: null, completed_on: null, private_notes: '', merged_into_id: null, created_at: '2026-01-01', updated_at: '2026-01-01',
}

describe('cloud watchlist identity hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.aliasError = false
    mocks.from.mockImplementation((table: string) => table === 'watchlist_items'
      ? { select: () => ({ eq: () => ({ is: mocks.is }) }) }
      : { select: () => ({ eq: () => Promise.resolve({ data: [{ media_id: 'media-1', provider: 'tmdb', external_id: 'tv:1' }, { media_id: 'media-1', provider: 'anilist', external_id: '99' }, { media_id: 'media-1', provider: 'mal', external_id: '5' }], error: mocks.aliasError ? new Error('missing table') : null }) }) })
    mocks.is.mockReturnValue({ order: () => Promise.resolve({ data: [row], error: null }) })
  })

  it('filters merged rows and attaches confirmed frontend aliases', async () => {
    const items = await fetchCloudWatchlist('u1')
    expect(mocks.is).toHaveBeenCalledWith('merged_into_id', null)
    expect(items[0].aliases).toEqual([{ source: 'tmdb', externalId: 'tv:1' }, { source: 'anilist', externalId: '99' }])
  })

  it('keeps loading the watchlist when the alias migration is unavailable', async () => {
    mocks.aliasError = true
    const items = await fetchCloudWatchlist('u1')
    expect(items).toHaveLength(1)
    expect(items[0].aliases).toBeUndefined()
  })
})
