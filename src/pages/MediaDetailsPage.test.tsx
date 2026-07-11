import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MediaItem } from '../types/media'
import MediaDetailsPage from './MediaDetailsPage'

vi.mock('motion/react', () => ({ motion: { article: 'article', img: 'img', div: 'div' } }))
vi.mock('../services/tmdb', () => ({ fetchTmdbDetails: vi.fn(() => new Promise(() => undefined)) }))

const item: MediaItem = {
  id: 'tmdb-tv:1', externalId: 'tv:1', source: 'tmdb', title: 'Test Show', type: 'TV Series',
  status: 'Watching', poster: '/poster.jpg', backdrop: '/backdrop.jpg', progress: '2024', rating: '8.2',
  description: 'A test show.', currentEpisode: 2, totalEpisodes: 3,
}

afterEach(cleanup)

describe('MediaDetailsPage tracking controls', () => {
  it('updates progress and rating with direct controls', async () => {
    const onUpdate = vi.fn()
    render(<MemoryRouter initialEntries={['/details/tmdb/tv%3A1']}><Routes><Route path="/details/:source/:externalId" element={<MediaDetailsPage items={[item]} onCreate={vi.fn()} onRemove={vi.fn()} onUpdate={onUpdate} />} /></Routes></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: 'Increase current episode' }))
    await userEvent.click(screen.getByRole('button', { name: 'Rate 8 out of 10' }))

    expect(onUpdate).toHaveBeenCalledWith(item.id, { currentEpisode: 3 })
    expect(onUpdate).toHaveBeenCalledWith(item.id, { personalRating: 8 })
  })

  it('accepts a typed episode and clamps it to the known total', async () => {
    const onUpdate = vi.fn()
    render(<MemoryRouter initialEntries={['/details/tmdb/tv%3A1']}><Routes><Route path="/details/:source/:externalId" element={<MediaDetailsPage items={[item]} onCreate={vi.fn()} onRemove={vi.fn()} onUpdate={onUpdate} />} /></Routes></MemoryRouter>)

    const input = screen.getByRole('spinbutton', { name: 'Current episode' })
    await userEvent.clear(input)
    await userEvent.type(input, '12')

    expect(onUpdate).toHaveBeenLastCalledWith(item.id, { currentEpisode: 3 })
  })

  it('stops episode controls at known boundaries', () => {
    const finishedItem = { ...item, currentEpisode: 3 }
    render(<MemoryRouter initialEntries={['/details/tmdb/tv%3A1']}><Routes><Route path="/details/:source/:externalId" element={<MediaDetailsPage items={[finishedItem]} onCreate={vi.fn()} onRemove={vi.fn()} onUpdate={vi.fn()} />} /></Routes></MemoryRouter>)

    expect(screen.getByRole('button', { name: 'Increase current episode' }).hasAttribute('disabled')).toBe(true)
  })
})
