import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaItem } from '../types/media'

const mocks = vi.hoisted(() => ({
  auth: { user: null as { id: string } | null, isLoading: false },
  create: vi.fn(),
  fetch: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
}))

vi.mock('../context/auth', () => ({
  useAuth: () => mocks.auth,
}))

vi.mock('../services/supabase', () => ({
  supabase: {},
}))

vi.mock('../services/watchlistItems', () => ({
  createCloudWatchlistItem: mocks.create,
  deleteCloudWatchlistItem: mocks.remove,
  fetchCloudWatchlist: mocks.fetch,
  updateCloudWatchlistStatus: mocks.update,
}))

import { useWatchlist } from './useWatchlist'

const item: MediaItem = {
  id: 'tmdb-movie-550',
  externalId: 'movie:550',
  source: 'tmdb',
  title: 'Fight Club',
  type: 'Movie',
  status: 'Planned',
  poster: '/poster.jpg',
  backdrop: '/backdrop.jpg',
  progress: '1999',
  rating: '8.4',
  description: 'An insomniac meets a soap maker.',
  year: '1999',
}

describe('useWatchlist persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.auth.user = null
    mocks.auth.isLoading = false
    mocks.create.mockReset()
    mocks.fetch.mockReset().mockResolvedValue([])
    mocks.remove.mockReset()
    mocks.update.mockReset()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('persists signed-out add and remove operations in localStorage', async () => {
    const first = renderHook(() => useWatchlist())

    await act(async () => first.result.current.handleAddItem(item))
    await waitFor(() => expect(JSON.parse(localStorage.getItem('afterlist_items') ?? '[]')).toEqual([item]))
    first.unmount()

    const second = renderHook(() => useWatchlist())
    expect(second.result.current.items).toEqual([item])

    await act(async () => second.result.current.handleRemoveItem(item.id))
    await waitFor(() => expect(localStorage.getItem('afterlist_items')).toBe('[]'))
  })

  it('shows a rejected cloud mutation and keeps the hydrated cloud list unchanged', async () => {
    mocks.auth.user = { id: 'test-user-a' }
    mocks.fetch.mockResolvedValue([item])
    mocks.create.mockRejectedValue(new Error('Insert rejected by row policy.'))

    const hook = renderHook(() => useWatchlist())
    await waitFor(() => expect(hook.result.current.isHydrating).toBe(false))
    expect(hook.result.current.items).toEqual([item])

    const secondItem = { ...item, id: 'tmdb-movie-680', externalId: 'movie:680', title: 'Pulp Fiction' }
    await act(async () => hook.result.current.handleAddItem(secondItem))

    expect(hook.result.current.items).toEqual([item])
    expect(hook.result.current.syncError).toBe('Insert rejected by row policy.')
  })
})
