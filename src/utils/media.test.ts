import { describe, expect, it } from 'vitest'
import type { MediaItem } from '../types/media'
import { areSameMediaEntry, dedupeMediaItems, findMatchingMediaItem } from './media'

function createItem(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: 'item-1',
    externalId: 'movie:1',
    source: 'tmdb',
    title: 'Example Movie',
    type: 'Movie',
    status: 'Planned',
    poster: '/poster.jpg',
    backdrop: '/backdrop.jpg',
    progress: '2024',
    rating: '8.0',
    description: 'Example description',
    year: '2024',
    ...overrides,
  }
}

describe('areSameMediaEntry', () => {
  it('uses source and external ID for API-backed items', () => {
    const first = createItem({ title: 'Localized title' })
    const second = createItem({ id: 'item-2', title: 'Original title' })

    expect(areSameMediaEntry(first, second)).toBe(true)
    expect(areSameMediaEntry(first, createItem({ externalId: 'movie:2' }))).toBe(false)
  })

  it('falls back to normalized title, type, and year', () => {
    const first = createItem({ source: undefined, externalId: undefined, title: 'Dune: Part Two' })
    const second = createItem({
      id: 'item-2',
      source: undefined,
      externalId: undefined,
      title: ' dune part two ',
      year: undefined,
      progress: 'Released in 2024',
    })

    expect(areSameMediaEntry(first, second)).toBe(true)
    expect(areSameMediaEntry(first, { ...second, type: 'TV Series' })).toBe(false)
    expect(areSameMediaEntry(first, { ...second, year: '2023' })).toBe(false)
  })
})

describe('media collections', () => {
  it('deduplicates entries while preserving the first item', () => {
    const first = createItem()
    const duplicate = createItem({ id: 'item-2', status: 'Watched' })
    const distinct = createItem({ id: 'item-3', externalId: 'movie:3', title: 'Another Movie' })

    expect(dedupeMediaItems([first, duplicate, distinct])).toEqual([first, distinct])
  })

  it('finds an existing item using media identity', () => {
    const item = createItem()

    expect(findMatchingMediaItem([item], createItem({ id: 'search-result' }))).toBe(item)
    expect(findMatchingMediaItem([item], createItem({ externalId: 'movie:99' }))).toBeUndefined()
  })
})
