import './testEnvironment'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MediaDetailsModal from '../src/components/media/MediaDetailsModal'
import SearchAddModal from '../src/components/search/SearchAddModal'
import { mediaItems } from './fixtures'

vi.mock('../src/services/tmdb', () => ({
  canFetchTmdbDetails: () => false,
  fetchTmdbDetails: vi.fn(),
  searchTmdb: vi.fn(),
}))

describe('redesigned overlays', () => {
  it('closes details with Escape and restores page scrolling', () => {
    const onClose = vi.fn()
    render(
      <MediaDetailsModal
        item={mediaItems[0]}
        onClose={onClose}
        onRemove={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )

    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('passes status changes through the existing callback contract', () => {
    const onStatusChange = vi.fn()
    render(
      <MediaDetailsModal
        item={mediaItems[0]}
        onClose={vi.fn()}
        onRemove={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'Edit status for First Feature' }), {
      target: { value: 'Watched' },
    })

    expect(onStatusChange).toHaveBeenCalledWith('tmdb-1', 'Watched')
  })

  it('opens and dismisses the search surface from the keyboard', async () => {
    render(<SearchAddModal items={[]} onCreate={vi.fn()} onOpenExisting={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Search movies, TV series, and anime' })).toBeTruthy()
    })
    expect(screen.getByText('Search to add')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy()
    })
  })
})
