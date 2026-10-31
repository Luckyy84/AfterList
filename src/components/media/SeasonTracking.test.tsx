import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import SeasonTracking from './SeasonTracking'
const api = vi.hoisted(() => ({ fetchSeasonProgress: vi.fn(), saveSeasonProgress: vi.fn(), libraryError: (e: Error) => e.message }))
vi.mock('../../services/mediaLibrary', () => api)
const user = { id: 'owner' }
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user }) }))
afterEach(cleanup)
it('saves a season counter without changing existing title progress', async () => {
  api.fetchSeasonProgress.mockResolvedValue([])
  api.saveSeasonProgress.mockResolvedValue({ season: 2, current_episode: 5, total_episodes: 12, updated_at: '2026-10-30' })
  render(<SeasonTracking itemId="item" source="tmdb" />)
  await screen.findByText('No season progress yet.')
  fireEvent.change(screen.getByLabelText('Season number'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Season progress'), { target: { value: '5' } })
  fireEvent.change(screen.getByLabelText('Season total'), { target: { value: '12' } })
  fireEvent.click(screen.getByText('Save season'))
  await waitFor(() => expect(api.saveSeasonProgress).toHaveBeenCalledWith('item', 2, 5, 12))
  expect(await screen.findByText('Season 2: 5 / 12')).toBeTruthy()
})
