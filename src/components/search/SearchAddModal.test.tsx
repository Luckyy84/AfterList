import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SearchAddModal from './SearchAddModal'
import { discoverTmdb, searchTmdb } from '../../services/tmdb'

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  LayoutGroup: ({ children }: { children: React.ReactNode }) => children,
  motion: { button: 'button', div: 'div' },
  useReducedMotion: () => true,
}))
vi.mock('../../hooks/useMediaQuery', () => ({ useIsMobile: () => false }))
vi.mock('../../services/tmdb', () => ({ discoverTmdb: vi.fn(), searchTmdb: vi.fn() }))

const result = {
  externalId: 'movie:1', source: 'tmdb' as const, title: 'Obsession', type: 'Movie' as const,
  year: '2026', poster: '/poster.jpg', backdrop: '/backdrop.jpg', rating: '8.3', description: 'A thriller.',
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SearchAddModal results', () => {
  it('closes when the user clicks outside the search shell', async () => {
    vi.mocked(discoverTmdb).mockResolvedValue([result])

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
    vi.mocked(discoverTmdb).mockResolvedValue([result])

    render(
      <MemoryRouter>
        <SearchAddModal items={[]} onCreate={vi.fn()} onOpenExisting={vi.fn()} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(screen.getByText('Trending now')).not.toBeNull())
    expect(screen.getByRole('link', { name: /Obsession/ })).not.toBeNull()
    expect(discoverTmdb).toHaveBeenCalledWith(expect.objectContaining({ feed: 'trending', mediaType: 'all' }))
  })

  it('opens details from the card and adds separately from the plus button', async () => {
    vi.mocked(discoverTmdb).mockResolvedValue([])
    vi.mocked(searchTmdb).mockResolvedValue([result])
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
    expect(screen.getByText('/details/tmdb/movie%3A1')).not.toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
