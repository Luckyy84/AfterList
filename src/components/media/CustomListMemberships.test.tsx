import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setListMembership } from '../../services/mediaLibrary'
import CustomListMemberships from './CustomListMemberships'

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }))
vi.mock('../../services/mediaLibrary', () => ({
  fetchCustomLists: vi.fn(async () => [{ id: 'l1', user_id: 'owner', name: 'Favorites', slug: 'favorites', is_public: false, sort_order: 0 }]),
  fetchListMemberships: vi.fn(async () => new Set<string>()),
  setListMembership: vi.fn(async () => undefined),
}))
afterEach(() => { cleanup(); vi.clearAllMocks() })
describe('CustomListMemberships', () => {
  it('updates owner-scoped membership', async () => {
    render(<CustomListMemberships itemId="item-1" />)
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Favorites' }))
    expect(setListMembership).toHaveBeenCalledWith('l1', 'item-1', 'owner', true)
  })
})
