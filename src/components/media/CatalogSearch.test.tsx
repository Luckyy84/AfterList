import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import CatalogSearch from './CatalogSearch'
vi.mock('../../services/catalog', () => ({ searchCatalog: vi.fn(async () => [{ provider: 'tmdb', external_id: 'tv:1', title: 'Show', refreshed_at: '2026-10-30', payload: { item: { source: 'tmdb', externalId: 'tv:1', title: 'Show', type: 'TV Series' } } }]) }))
it('links indexed catalog matches to canonical title pages with refresh timestamps', async () => {
  render(<MemoryRouter><CatalogSearch /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Search shared catalog'), { target: { value: 'Show' } })
  fireEvent.click(screen.getByText('Search catalog'))
  expect((await screen.findByRole('link', { name: 'Show' })).getAttribute('href')).toBe('/tv/1/show')
})
