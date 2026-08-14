import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchTmdbMedia } from '../services/tmdb'
import type { MediaItem } from '../types/media'
import LegacyMediaDetailsRoute from './LegacyMediaDetailsRoute'

vi.mock('../services/tmdb', () => ({ fetchTmdbMedia: vi.fn() }))

const item: MediaItem = {
  id: 'tmdb-movie:550', externalId: 'movie:550', source: 'tmdb', title: 'Fight Club', type: 'Movie',
  status: 'Planned', poster: '/poster.jpg', backdrop: '/backdrop.jpg', progress: '1999', year: '1999',
  rating: '8.4', description: 'A test movie.',
}

function Path() { return <output>{useLocation().pathname}</output> }

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LegacyMediaDetailsRoute', () => {
  it('redirects a validated state seed without refetching', async () => {
    render(<MemoryRouter initialEntries={[{ pathname: '/details/tmdb/movie%3A550', state: { item } }]}><Routes><Route path="/details/:source/:externalId" element={<LegacyMediaDetailsRoute />} /><Route path="/movie/:id/:slug" element={null} /></Routes><Path /></MemoryRouter>)
    expect(await screen.findByText('/movie/550/fight-club')).not.toBeNull()
    expect(fetchTmdbMedia).not.toHaveBeenCalled()
  })

  it('resolves a directly loaded legacy link before redirecting', async () => {
    vi.mocked(fetchTmdbMedia).mockResolvedValue({ item, details: { genres: [], countries: [] } })
    render(<MemoryRouter initialEntries={['/details/tmdb/movie%3A550']}><Routes><Route path="/details/:source/:externalId" element={<LegacyMediaDetailsRoute />} /><Route path="/movie/:id/:slug" element={null} /></Routes><Path /></MemoryRouter>)
    expect(screen.getByText('Updating this saved link.')).not.toBeNull()
    expect(await screen.findByText('/movie/550/fight-club')).not.toBeNull()
    expect(fetchTmdbMedia).toHaveBeenCalledWith('movie:550', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })
})
