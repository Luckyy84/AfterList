import { describe, expect, it } from 'vitest'
import type { MediaItem } from '../types/media'
import { applyMediaUpdate, createMediaItem, mergeWatchlists } from './media'

const item: MediaItem = {
  id: 'local', externalId: 'tv:1', source: 'tmdb', title: 'Show', type: 'TV Series',
  status: 'Watched', poster: '', backdrop: '', progress: '', rating: '', description: '',
  currentEpisode: 10, totalEpisodes: 10, updatedAt: '2026-01-02T00:00:00.000Z',
}

describe('watchlist tracking', () => {
  it('creates discovered titles with the requested default status', () => {
    const result = { externalId: 'movie:2', source: 'tmdb' as const, title: 'Film', type: 'Movie' as const, poster: '', backdrop: '', year: '2026', rating: '8', description: '' }
    expect(createMediaItem(result, 'Watching')).toMatchObject({ status: 'Watching', progress: '2026' })
    expect(createMediaItem(result, 'Watched')).toMatchObject({ status: 'Watched', progress: 'Watched' })
  })

  it('clamps progress and keeps completion status in sync', () => {
    expect(applyMediaUpdate(item, { currentEpisode: 99 }, 'now')).toMatchObject({ currentEpisode: 10, status: 'Watched' })
    expect(applyMediaUpdate(item, { currentEpisode: 4 }, 'now')).toMatchObject({ currentEpisode: 4, status: 'Watching' })
    expect(applyMediaUpdate(item, { personalRating: 99 }, 'now')).toMatchObject({ personalRating: 10 })
  })

  it('ignores episode tracking for movies', () => {
    expect(applyMediaUpdate({ ...item, type: 'Movie' }, { currentEpisode: 2, totalEpisodes: 3, personalRating: 99 }, 'now'))
      .toMatchObject({ currentEpisode: undefined, totalEpisodes: undefined, personalRating: 10 })
  })

  it('uses newest records but prefers cloud for unknown local recency', () => {
    const cloud = { ...item, id: 'cloud', updatedAt: '2026-01-01T00:00:00.000Z' }
    expect(mergeWatchlists([item], [cloud])[0]).toMatchObject({ id: 'cloud', updatedAt: item.updatedAt })
    expect(mergeWatchlists([item], [cloud], new Set(['tmdb:tv:1']))[0]).toEqual(cloud)
  })
})
