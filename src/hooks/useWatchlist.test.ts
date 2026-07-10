import { describe, expect, it } from 'vitest'
import { enqueueByKey, parseSavedItems } from './useWatchlist'

describe('guest watchlist migration', () => {
  it('migrates legacy status and stamps defaults while retaining unknown recency', () => {
    const result = parseSavedItems(JSON.stringify([{
      id: '1', externalId: 'movie:1', source: 'tmdb', title: 'Movie', type: 'Movie',
      status: 'Completed', poster: '', backdrop: '', progress: '', rating: '', description: '',
    }]), '2026-01-01T00:00:00.000Z')

    expect(result.items[0]).toMatchObject({ status: 'Watched', currentEpisode: 0, personalRating: null, isFavorite: false })
    expect(result.unknownRecencyKeys).toContain('tmdb:movie:1')
  })

  it('serializes cloud updates for the same title', async () => {
    const queues = new Map<string, Promise<unknown>>()
    const events: string[] = []
    let releaseFirst: () => void = () => {}
    const gate = new Promise<void>((resolve) => { releaseFirst = resolve })
    const first = enqueueByKey(queues, 'title', async () => { events.push('first start'); await gate; events.push('first end') })
    const second = enqueueByKey(queues, 'title', async () => { events.push('second') })

    await Promise.resolve()
    await Promise.resolve()
    expect(events).toEqual(['first start'])
    releaseFirst()
    await Promise.all([first, second])
    expect(events).toEqual(['first start', 'first end', 'second'])
  })
})
