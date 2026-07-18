import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MediaItem } from '../types/media'
import HomePage from './HomePage'

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: { section: 'section', button: 'button' },
  useReducedMotion: () => true,
}))
vi.mock('../hooks/useMediaQuery', () => ({ useIsMobile: () => false }))
vi.mock('../services/tmdb', () => ({ discoverTmdb: vi.fn(async () => []) }))
vi.mock('../components/media/MediaRow', () => ({
  default: ({ items, title }: { items: MediaItem[]; title: string }) => <div data-testid="media-row">{title}:{items.map((item) => item.title).join(',')}</div>,
}))

const baseItem: MediaItem = {
  id: 'watching', source: 'tmdb', externalId: 'tv:1', title: 'Watching title', type: 'TV Series', status: 'Watching',
  poster: '/poster.jpg', backdrop: '/backdrop.jpg', progress: '2026', rating: '8.0', description: 'Description', year: '2026',
}

afterEach(cleanup)

describe('HomePage watchlist tabs', () => {
  it('shows only the selected status rail', async () => {
    const watchedItem = { ...baseItem, id: 'watched', externalId: 'movie:2', title: 'Watched title', type: 'Movie' as const, status: 'Watched' as const }
    render(<MemoryRouter><HomePage items={[baseItem, watchedItem]} onCreate={vi.fn()} /></MemoryRouter>)

    expect(screen.getByRole('tab', { name: 'Watching 1' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Watching:Watching title')).not.toBeNull()

    await userEvent.click(screen.getByRole('tab', { name: 'Watched 1' }))

    expect(screen.getByRole('tab', { name: 'Watched 1' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Watched:Watched title')).not.toBeNull()
  })
})
