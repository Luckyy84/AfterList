import { cleanup, render, screen } from '@testing-library/react'
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
  it('shows discovery metadata and Add without exposing the temporary Planned status', () => {
    const { rerender } = render(<MediaCard item={item} isSaved={false} onSelect={vi.fn()} onAdd={vi.fn()} />)

    expect(screen.queryByText('Planned')).toBeNull()
    expect(screen.getByRole('button', { name: 'Add to watchlist' })).not.toBeNull()
    expect(screen.getByText('TV Series · 2022')).not.toBeNull()
    expect(screen.getByText('TMDB 8.4')).not.toBeNull()

    rerender(<MediaCard item={item} isSaved onSelect={vi.fn()} />)
    expect(screen.getByText('Planned')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Add to watchlist' })).toBeNull()
  })

  it('shows the real saved status and hides Add', () => {
    render(<MediaCard item={item} isSaved onSelect={vi.fn()} />)

    expect(screen.getByText('Planned')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Add to watchlist' })).toBeNull()
  })
})
