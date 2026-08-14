import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MediaDetails, MediaItem } from '../types/media'
import { fetchMedia } from '../services/media'
import MediaDetailsPage from './MediaDetailsPage'

vi.mock('motion/react', async () => import('../test/motionMock'))
vi.mock('../services/media', () => ({ fetchMedia: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }))

const item: MediaItem = {
  id: 'tmdb-tv:1', externalId: 'tv:1', source: 'tmdb', title: 'Test Show', type: 'TV Series',
  status: 'Watching', poster: '/poster.jpg', backdrop: '/backdrop.jpg', progress: '2024', rating: '8.2',
  description: 'A test show.', currentEpisode: 2, totalEpisodes: 3,
}
const details: MediaDetails = { genres: ['Drama'], countries: ['US'], totalEpisodes: 3 }

function Path() { return <output>{useLocation().pathname}</output> }

function renderDetails(items: MediaItem[] = [item], path = '/tv/1/test-show') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tv/:id/:slug" element={<MediaDetailsPage routeKind="tv" items={items} onCreate={vi.fn()} onRemove={vi.fn()} onUpdate={vi.fn()} />} />
      </Routes>
      <Path />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  document.querySelector('link[rel="canonical"]')?.remove()
})

describe('MediaDetailsPage', () => {
  it('updates progress and rating with direct controls', async () => {
    vi.mocked(fetchMedia).mockReturnValue(new Promise(() => undefined))
    const onUpdate = vi.fn()
    render(<MemoryRouter initialEntries={['/tv/1/test-show']}><Routes><Route path="/tv/:id/:slug" element={<MediaDetailsPage routeKind="tv" items={[item]} onCreate={vi.fn()} onRemove={vi.fn()} onUpdate={onUpdate} />} /></Routes></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'Increase current episode' }))
    await userEvent.click(screen.getByRole('button', { name: 'Rate 8 out of 10' }))
    expect(onUpdate).toHaveBeenCalledWith(item.id, { currentEpisode: 3 })
    expect(onUpdate).toHaveBeenCalledWith(item.id, { personalRating: 8 })
  })

  it('updates completed rewatches with reliable stepper controls', async () => {
    vi.mocked(fetchMedia).mockReturnValue(new Promise(() => undefined))
    const onUpdate = vi.fn()
    render(<MemoryRouter initialEntries={['/tv/1/test-show']}><Routes><Route path="/tv/:id/:slug" element={<MediaDetailsPage routeKind="tv" items={[{ ...item, rewatchCount: 0 }]} onCreate={vi.fn()} onRemove={vi.fn()} onUpdate={onUpdate} />} /></Routes></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: 'Increase rewatch count' }))
    expect(onUpdate).toHaveBeenCalledWith(item.id, { rewatchCount: 1 })
    expect(screen.getByRole('button', { name: 'Decrease rewatch count' }).hasAttribute('disabled')).toBe(true)
  })

  it('accepts a typed episode and clamps it to the known total', async () => {
    vi.mocked(fetchMedia).mockReturnValue(new Promise(() => undefined))
    const onUpdate = vi.fn()
    render(<MemoryRouter initialEntries={['/tv/1/test-show']}><Routes><Route path="/tv/:id/:slug" element={<MediaDetailsPage routeKind="tv" items={[item]} onCreate={vi.fn()} onRemove={vi.fn()} onUpdate={onUpdate} />} /></Routes></MemoryRouter>)
    const input = screen.getByRole('spinbutton', { name: 'Current episode' })
    await userEvent.clear(input)
    await userEvent.type(input, '12')
    expect(onUpdate).toHaveBeenLastCalledWith(item.id, { currentEpisode: 3 })
  })

  it('stops episode controls at known boundaries', () => {
    vi.mocked(fetchMedia).mockReturnValue(new Promise(() => undefined))
    renderDetails([{ ...item, currentEpisode: 3 }])
    expect(screen.getByRole('button', { name: 'Increase current episode' }).hasAttribute('disabled')).toBe(true)
  })

  it('loads an unsaved title directly and corrects a stale slug', async () => {
    vi.mocked(fetchMedia).mockResolvedValue({ item: { ...item, status: 'Planned' }, details })
    renderDetails([], '/tv/1/wrong-title')
    expect(screen.getByLabelText('Loading title details')).not.toBeNull()
    await screen.findByRole('heading', { name: 'Test Show' })
    await waitFor(() => expect(screen.getByText('/tv/1/test-show')).not.toBeNull())
    expect(screen.getByRole('button', { name: 'Add to watchlist' })).not.toBeNull()
    await waitFor(() => expect(document.title).toBe('Test Show (2024) | AfterList'))
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('index, follow')
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe('https://afterlist.luckako.uk/tv/1/test-show')
    expect(document.querySelector('#afterlist-page-jsonld')?.textContent).toContain('TVSeries')
  })

  it('ignores navigation state for a different identity', async () => {
    vi.mocked(fetchMedia).mockResolvedValue({ item: { ...item, status: 'Planned' }, details })
    const other = { ...item, externalId: 'tv:2', title: 'Wrong Show' }
    render(<MemoryRouter initialEntries={[{ pathname: '/tv/1/test-show', state: { item: other } }]}><Routes><Route path="/tv/:id/:slug" element={<MediaDetailsPage routeKind="tv" items={[]} onCreate={vi.fn()} onRemove={vi.fn()} onUpdate={vi.fn()} />} /></Routes></MemoryRouter>)
    expect(screen.queryByText('Wrong Show')).toBeNull()
    expect(await screen.findByText('Test Show')).not.toBeNull()
  })

  it('offers retry when a fresh lookup fails', async () => {
    vi.mocked(fetchMedia).mockRejectedValueOnce(new Error('Provider offline')).mockResolvedValueOnce({ item, details })
    renderDetails([], '/tv/1/test-show')
    expect(await screen.findByText('Provider offline')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Test Show')).not.toBeNull()
    expect(fetchMedia).toHaveBeenCalledTimes(2)
  })

  it('loads canonical AniList routes and shows anime metadata', async () => {
    const anime = { ...item, id: 'anilist-101', externalId: '101', source: 'anilist' as const, title: 'Test Anime', type: 'Anime' as const, status: 'Planned' as const }
    vi.mocked(fetchMedia).mockResolvedValue({ item: anime, details: { ...details, format: 'TV', alternativeTitles: ['Tesuto'], studios: [{ id: 1, name: 'Studio A' }] } })
    render(<MemoryRouter initialEntries={['/anime/101/wrong']}><Routes><Route path="/anime/:id/:slug" element={<MediaDetailsPage routeKind="anime" items={[]} onCreate={vi.fn()} onRemove={vi.fn()} onUpdate={vi.fn()} />} /></Routes><Path /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Test Anime' })).not.toBeNull()
    expect(screen.getByText('Studio A')).not.toBeNull()
    await waitFor(() => expect(screen.getByText('/anime/101/test-anime')).not.toBeNull())
    expect(fetchMedia).toHaveBeenCalledWith('anilist', '101', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })
})
