import './testEnvironment'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CategoryPage from '../src/components/media/CategoryPage'
import { mediaItems } from './fixtures'

describe('CategoryPage filters', () => {
  it('filters the collection by watch status', () => {
    render(
      <CategoryPage
        title="Movies"
        subtitle="Saved movies"
        type="Movie"
        items={mediaItems}
        onRemove={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Planned' }))

    expect(screen.getByRole('button', { name: 'Open details for Second Feature' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Open details for First Feature' })).toBeNull()
  })

  it('shows a filter-specific empty state', () => {
    render(
      <CategoryPage
        title="Movies"
        subtitle="Saved movies"
        type="Movie"
        items={mediaItems}
        onRemove={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dropped' }))

    expect(screen.getByRole('heading', { name: 'No dropped titles.' })).toBeTruthy()
  })
})
