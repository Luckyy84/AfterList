import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SearchAddModal from './SearchAddModal'
import { discoverMedia, searchMedia } from '../../services/media'

vi.mock('motion/react', async () => import('../../test/motionMock'))
vi.mock('../../hooks/useMediaQuery', () => ({ useIsMobile: () => false }))
vi.mock('../../services/media', () => ({ discoverMedia: vi.fn(), searchMedia: vi.fn() }))

const result = {
  externalId: 'movie:1', source: 'tmdb' as const, title: 'Obsession', type: 'Movie' as const,
  year: '2026', poster: '/poster.jpg', backdrop: '/backdrop.jpg', rating: '8.3', description: 'A thriller.',
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('SearchAddModal results', () => {
  it('closes when the user clicks outside the search shell', async () => {
    vi.mocked(discoverMedia).mockResolvedValue([result])

    render(
      <MemoryRouter>
        <SearchAddModal items={[]} onCreate={vi.fn()} onOpenExisting={vi.fn()} />
        <button type="button">Outside</button>
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(screen.getByRole('textbox', { name: 'Search movies, TV series, and anime' })).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('textbox', { name: 'Search movies, TV series, and anime' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Search' })).not.toBeNull()
  })

  it('shows trending titles before a search is entered', async () => {
    vi.mocked(discoverMedia).mockResolvedValue([result])

    render(
      <MemoryRouter>
        <SearchAddModal items={[]} onCreate={vi.fn()} onOpenExisting={vi.fn()} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(screen.getByText('Trending now')).not.toBeNull())
    expect(screen.getByRole('link', { name: /Obsession/ })).not.toBeNull()
    expect(discoverMedia).toHaveBeenCalledWith(expect.objectContaining({ feed: 'trending', mediaType: 'all' }))
  })

  it('opens details from the card and adds separately from the plus button', async () => {
    vi.mocked(discoverMedia).mockResolvedValue([])
    vi.mocked(searchMedia).mockResolvedValue([result])
    const onCreate = vi.fn()
    function Path() { return <output>{useLocation().pathname}</output> }

    render(
      <MemoryRouter>
        <SearchAddModal items={[]} onCreate={onCreate} onOpenExisting={vi.fn()} />
        <Path />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Search movies, TV series, and anime' }), 'Obsession')
    await waitFor(() => expect(screen.getByRole('link', { name: /Obsession/ })).not.toBeNull())

    await userEvent.click(screen.getByRole('button', { name: 'Add Obsession to watchlist' }))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Obsession', status: 'Planned' }))
    expect(screen.getByText('/')).not.toBeNull()

    await userEvent.click(screen.getByRole('link', { name: /Obsession/ }))
    expect(screen.getByText('/movie/1/obsession')).not.toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('announces search failures and retries the same query', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(discoverMedia).mockResolvedValue([])
    vi.mocked(searchMedia).mockRejectedValueOnce(new Error('Search is unavailable.')).mockResolvedValueOnce([result])
    render(<MemoryRouter><SearchAddModal items={[]} onCreate={vi.fn()} onOpenExisting={vi.fn()} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    const input = screen.getByRole('textbox', { name: 'Search movies, TV series, and anime' })
    await userEvent.type(input, 'Obsession')
    expect((await screen.findByRole('alert')).textContent).toContain('Search is unavailable.')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: /Obsession/ })).not.toBeNull()
    expect(searchMedia).toHaveBeenCalledTimes(2)
  })

  it('labels AniList results with their actual provider', async () => {
    vi.mocked(discoverMedia).mockResolvedValue([])
    vi.mocked(searchMedia).mockResolvedValue([{ ...result, source: 'anilist', externalId: '146676', title: 'Love Flops', type: 'Anime' }])
    render(<MemoryRouter><SearchAddModal items={[]} onCreate={vi.fn()} onOpenExisting={vi.fn()} /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Search movies, TV series, and anime' }), 'Love Flops')

    expect(await screen.findByText(/Rating 8\.3 \/ AniList/)).not.toBeNull()
  })
})
