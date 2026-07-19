import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchTmdbDetails } from '../services/tmdb'
import type { MediaItem } from '../types/media'
import { calculateStatistics, formatWatchTime } from '../utils/statistics'
import StatisticsPage from './StatisticsPage'

vi.mock('../services/tmdb', () => ({
  canFetchTmdbDetails: (item: MediaItem) => item.source === 'tmdb' && Boolean(item.externalId),
  fetchTmdbDetails: vi.fn(),
}))

const baseItem: MediaItem = {
  id: 'movie',
  source: 'tmdb',
  externalId: 'movie:1',
  title: 'Movie',
  type: 'Movie',
  status: 'Watched',
  poster: '',
  backdrop: '',
  progress: 'Watched',
  rating: '8.0',
  description: '',
  runtimeMinutes: 120,
  personalRating: 8,
  isFavorite: true,
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StatisticsPage', () => {
  it('calculates the requested library statistics and watch-time rules', () => {
    const items: MediaItem[] = [
      baseItem,
      { ...baseItem, id: 'series', externalId: 'tv:2', title: 'Series', type: 'TV Series', currentEpisode: 4, totalEpisodes: 6, runtimeMinutes: 30, personalRating: 10, isFavorite: false },
      { ...baseItem, id: 'anime', externalId: 'tv:3', title: 'Anime', type: 'Anime', status: 'Watching', currentEpisode: 3, totalEpisodes: 12, runtimeMinutes: 24, personalRating: null },
    ]

    const statistics = calculateStatistics(items)

    expect(statistics).toMatchObject({
      totalTitles: 3,
      completionRate: 67,
      favorites: 2,
      averageRating: '9.0',
      episodesWatched: 7,
      watchMinutes: 372,
    })
    expect(statistics.statusCounts).toEqual({ Planned: 0, Watching: 1, Watched: 2, Dropped: 0 })
    expect(statistics.typeCounts).toEqual({ Anime: 1, Movie: 1, 'TV Series': 1 })
    expect(formatWatchTime(statistics.watchMinutes)).toBe('6h 12m')
  })

  it('renders the approved non-grid summaries and breakdowns', () => {
    render(<StatisticsPage items={[baseItem]} onUpdate={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Statistics' })).not.toBeNull()
    expect(screen.getByText('Completion rate')).not.toBeNull()
    expect(screen.getByText('Estimated watch time')).not.toBeNull()
    expect(screen.getByTestId('watch-time-value').textContent).toBe('2h')
    expect(screen.getByRole('heading', { name: 'All statuses' })).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'All types' })).not.toBeNull()
  })

  it('backfills missing TMDB runtime metadata', async () => {
    vi.mocked(fetchTmdbDetails).mockResolvedValue({ genres: [], countries: [], runtimeMinutes: 45, totalEpisodes: 8 })
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const legacyItem = { ...baseItem, id: 'legacy', externalId: 'tv:9', type: 'TV Series' as const, runtimeMinutes: undefined }

    render(<StatisticsPage items={[legacyItem]} onUpdate={onUpdate} />)

    expect(screen.getByText('Calculating from TMDB runtimes…')).not.toBeNull()
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('legacy', { runtimeMinutes: 45, totalEpisodes: 8 }))
  })

  it('keeps other metrics visible when runtime metadata is unavailable', async () => {
    vi.mocked(fetchTmdbDetails).mockRejectedValue(new Error('Unavailable'))
    const legacyItem = { ...baseItem, id: 'legacy', runtimeMinutes: undefined }

    render(<StatisticsPage items={[legacyItem]} onUpdate={vi.fn()} />)

    expect(screen.getByText('Total titles')).not.toBeNull()
    await waitFor(() => expect(screen.getByText('Some runtimes unavailable')).not.toBeNull())
  })

  it('shows the focused empty state without zero-value distributions', () => {
    render(<StatisticsPage items={[]} onUpdate={vi.fn()} />)

    expect(screen.getByText('Your story starts with one title')).not.toBeNull()
    expect(screen.queryByRole('heading', { name: 'All statuses' })).toBeNull()
  })
})
