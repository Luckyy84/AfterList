import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MediaItem } from '../../types/media'
import MediaCard from './MediaCard'

vi.mock('motion/react', () => ({
  motion: { article: ({ children, className }: { children: React.ReactNode; className?: string }) => <article className={className}>{children}</article> },
  useReducedMotion: () => true,
}))

const item: MediaItem = {
  id: 'tmdb-tv:1', externalId: 'tv:1', source: 'tmdb', title: 'House of the Dragon', type: 'TV Series',
  status: 'Planned', poster: '/poster.jpg', backdrop: '/backdrop.jpg', progress: '2022', rating: '8.4',
  description: '', year: '2022',
}

afterEach(cleanup)

describe('MediaCard', () => {
  it('opens the dedicated details route', async () => {
    function Path() { return <span>{useLocation().pathname}</span> }
    render(<MemoryRouter><MediaCard item={item} /><Path /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: `Open details for ${item.title}` }))
    expect(screen.getByText('/details/tmdb/tv%3A1')).not.toBeNull()
  })

  it('shows discovery metadata and Add without exposing the temporary Planned status', () => {
    const { rerender } = render(<MemoryRouter><MediaCard item={item} isSaved={false} onAdd={vi.fn()} /></MemoryRouter>)

    expect(screen.queryByText('Planned')).toBeNull()
    expect(screen.getByRole('button', { name: 'Add to watchlist' })).not.toBeNull()
    expect(screen.getByText('TV Series · 2022')).not.toBeNull()
    expect(screen.getByText('TMDB 8.4')).not.toBeNull()

    rerender(<MemoryRouter><MediaCard item={item} isSaved /></MemoryRouter>)
    expect(screen.getByText('Planned')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Add to watchlist' })).toBeNull()
  })

  it('shows the real saved status and hides Add', () => {
    render(<MemoryRouter><MediaCard item={item} isSaved /></MemoryRouter>)

    expect(screen.getByText('Planned')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Add to watchlist' })).toBeNull()
  })

  it('replaces failed artwork without exposing a broken image', () => {
    render(<MemoryRouter><MediaCard item={item} /></MemoryRouter>)
    const image = screen.getByAltText('House of the Dragon poster')

    fireEvent.error(image)

    expect(screen.queryByAltText('House of the Dragon poster')).toBeNull()
    expect(screen.getByText('HO')).not.toBeNull()
  })
})
