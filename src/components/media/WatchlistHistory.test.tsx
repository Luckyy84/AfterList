import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WatchlistHistory from './WatchlistHistory'

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../services/mediaLibrary', () => ({ fetchWatchlistEvents: vi.fn(async () => [{ id: 1, watchlist_item_id: 'i1', event_type: 'tracking_updated', old_value: { status: 'Watching', privateNotes: 'secret old' }, new_value: { status: 'Paused', privateNotes: 'secret new' }, created_at: '2026-08-01T00:00:00Z' }]) }))

afterEach(cleanup)
describe('WatchlistHistory', () => {
  it('shows an owner-safe summary without note bodies', async () => {
    render(<WatchlistHistory itemId="i1" />)
    expect(await screen.findByText('Status changed to Paused')).not.toBeNull()
    expect(screen.queryByText(/secret/)).toBeNull()
  })
})
