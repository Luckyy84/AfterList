import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WatchlistHistory from './WatchlistHistory'
import { fetchWatchlistEvents } from '../../services/mediaLibrary'

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../services/mediaLibrary', () => ({ fetchWatchlistEvents: vi.fn(async () => [
  { id: 1, watchlist_item_id: 'i1', event_type: 'tracking_updated', old_value: { status: 'Watching', privateNotes: 'secret old' }, new_value: { status: 'Paused', privateNotes: 'secret new' }, created_at: '2026-08-04T00:00:00Z' },
  { id: 2, watchlist_item_id: 'i1', event_type: 'created', old_value: null, new_value: {}, created_at: '2026-08-03T00:00:00Z' },
  { id: 3, watchlist_item_id: 'i1', event_type: 'merged', old_value: null, new_value: {}, created_at: '2026-08-02T00:00:00Z' },
  { id: 4, watchlist_item_id: 'i1', event_type: 'tracking_updated', old_value: { personalRating: 1 }, new_value: { personalRating: 2 }, created_at: '2026-08-01T00:00:00Z' },
]) }))

afterEach(cleanup)
describe('WatchlistHistory', () => {
  it('shows an owner-safe summary without note bodies', async () => {
    render(<WatchlistHistory itemId="i1" />)
    expect(await screen.findByText('Status changed to Paused')).not.toBeNull()
    expect(screen.queryByText(/secret/)).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByText('Rating updated')).toBeNull()
    expect(fetchWatchlistEvents).toHaveBeenCalledWith('u1', 'i1', 3)
  })
})
