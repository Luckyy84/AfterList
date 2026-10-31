import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import MediaIdentityPanel from './MediaIdentityPanel'
const api = vi.hoisted(() => ({ fetchMediaIdentityAudit: vi.fn(), undoMediaMerge: vi.fn(), saveAnimeSeasonMatch: vi.fn(), libraryError: (e: Error) => e.message }))
vi.mock('../../services/mediaLibrary', () => api)
const user = { id: 'owner' }
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user }) }))
it('shows retained source identities and reverses a merge through the owner RPC', async () => {
  api.fetchMediaIdentityAudit.mockResolvedValue({ merged: [{ id: 'loser', title: 'Other Film', source: 'anilist', external_id: '400' }], audit: [], seasons: [] })
  api.undoMediaMerge.mockResolvedValue({ decision: 'undone' })
  render(<MediaIdentityPanel itemId="winner" source="tmdb" externalId="movie:300" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Restore Other Film' }))
  await waitFor(() => expect(api.undoMediaMerge).toHaveBeenCalledWith('winner', 'loser'))
  expect(await screen.findByText(/Identity restored/)).toBeTruthy()
})
