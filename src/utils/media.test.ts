import { describe, expect, it } from 'vitest'
import type { MediaItem } from '../types/media'
import { applyMediaUpdate, findMatchingMediaItem, findProbableMediaDuplicate, mergeWatchlists, searchResultToMediaItem } from './media'

const item: MediaItem = {
  id: 'local', externalId: 'tv:1', source: 'tmdb', title: 'Show', type: 'TV Series',
  status: 'Watched', poster: '', backdrop: '', progress: '', rating: '', description: '',
  currentEpisode: 10, totalEpisodes: 10, updatedAt: '2026-01-02T00:00:00.000Z',
}

describe('watchlist tracking', () => {
  it('clamps progress and keeps completion status in sync', () => {
    expect(applyMediaUpdate(item, { currentEpisode: 99 }, 'now')).toMatchObject({ currentEpisode: 10, status: 'Watched' })
    expect(applyMediaUpdate(item, { currentEpisode: 4 }, 'now')).toMatchObject({ currentEpisode: 4, status: 'Watching' })
    expect(applyMediaUpdate(item, { personalRating: 99 }, 'now')).toMatchObject({ personalRating: 10 })
  })

  it('ignores episode tracking for movies', () => {
    expect(applyMediaUpdate({ ...item, type: 'Movie' }, { currentEpisode: 2, totalEpisodes: 3, personalRating: 99 }, 'now'))
      .toMatchObject({ currentEpisode: undefined, totalEpisodes: undefined, personalRating: 10 })
  })

  it('normalizes rewatch fields and private notes', () => {
    expect(applyMediaUpdate(item, { rewatchCount: -4, privateNotes: 'x'.repeat(6000) }, 'now'))
      .toMatchObject({ rewatchCount: 0, privateNotes: 'x'.repeat(5000) })
  })

  it('starts a rewatch with fresh progress and lifecycle dates', () => {
    expect(applyMediaUpdate({
      ...item,
      isRewatching: false,
      startedAt: '2026-07-01',
      completedAt: '2026-07-02',
    }, { isRewatching: true }, '2026-08-18T09:00:00.000Z')).toMatchObject({
      status: 'Watching',
      currentEpisode: 0,
      isRewatching: true,
      startedAt: '2026-08-18',
      completedAt: null,
    })
  })

  it('adds lifecycle dates when tracking starts or completes without overwriting existing dates', () => {
    const planned = { ...item, status: 'Planned' as const, currentEpisode: 0, startedAt: null, completedAt: null }
    expect(applyMediaUpdate(planned, { status: 'Watching' }, '2026-08-08T21:00:00.000Z'))
      .toMatchObject({ status: 'Watching', startedAt: '2026-08-08', completedAt: null })
    expect(applyMediaUpdate(planned, { status: 'Watched' }, '2026-08-08T21:00:00.000Z'))
      .toMatchObject({ status: 'Watched', completedAt: '2026-08-08' })

    const dated = { ...planned, startedAt: '2026-07-01', completedAt: '2026-07-31' }
    expect(applyMediaUpdate(dated, { status: 'Watching' }, '2026-08-08T21:00:00.000Z'))
      .toMatchObject({ startedAt: '2026-07-01', completedAt: '2026-07-31' })
  })

  it('adds completion dates when episode progress completes a title', () => {
    const watching = { ...item, status: 'Watching' as const, currentEpisode: 9, completedAt: null }
    expect(applyMediaUpdate(watching, { currentEpisode: 10 }, '2026-08-08T21:00:00.000Z'))
      .toMatchObject({ status: 'Watched', completedAt: '2026-08-08' })
  })

  it('flags only cross-identity title and year matches as probable', () => {
    const probable = { ...item, id: 'anime', source: 'anilist' as const, externalId: '99', year: '2026', progress: '2026' }
    const existing = { ...item, title: 'Show!', year: '2026', progress: '2026' }
    expect(findProbableMediaDuplicate([existing], probable)).toEqual(existing)
    expect(findProbableMediaDuplicate([existing], { ...probable, year: '2025', progress: '2025' })).toBeUndefined()
    expect(findProbableMediaDuplicate([existing], { ...probable, source: 'tmdb', externalId: 'tv:1' })).toBeUndefined()
  })

  it('uses newest records but prefers cloud for unknown local recency', () => {
    const cloud = { ...item, id: 'cloud', updatedAt: '2026-01-01T00:00:00.000Z' }
    expect(mergeWatchlists([item], [cloud])[0]).toMatchObject({ id: 'cloud', updatedAt: item.updatedAt })
    expect(mergeWatchlists([item], [cloud], new Set(['tmdb:tv:1']))[0]).toEqual(cloud)
  })

  it('recognizes a previously confirmed provider alias without prompting again', () => {
    const saved = { ...item, canonicalId: 'media-1', aliases: [{ source: 'tmdb' as const, externalId: 'tv:1' }, { source: 'anilist' as const, externalId: '99' }] }
    const candidate = searchResultToMediaItem({ externalId: '99', source: 'anilist', title: 'Show', type: 'Anime', year: '2026', poster: '', backdrop: '', rating: '8', description: '' })
    expect(findMatchingMediaItem([saved], candidate)).toEqual(saved)
    expect(findProbableMediaDuplicate([saved], candidate)).toBeUndefined()
  })
})
