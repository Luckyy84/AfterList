import type { MediaItem, MediaSource, MediaType } from '../types/media'

export function getStatusLabel(status: string) {
  return status.toUpperCase()
}

type MediaComparable = {
  title: string
  type: MediaType
  source?: MediaSource
  externalId?: string
  year?: string
  progress?: string
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function getComparableYear(item: MediaComparable) {
  if (item.year) return item.year.trim()

  const yearMatch = item.progress?.match(/\b(19|20)\d{2}\b/)
  return yearMatch?.[0]
}

export function areSameMediaEntry(first: MediaComparable, second: MediaComparable) {
  if (first.source && first.externalId && second.source && second.externalId) {
    return first.source === second.source && first.externalId === second.externalId
  }

  if (normalizeText(first.title) !== normalizeText(second.title)) return false
  if (first.type !== second.type) return false

  const firstYear = getComparableYear(first)
  const secondYear = getComparableYear(second)

  if (firstYear && secondYear) return firstYear === secondYear

  return true
}

export function dedupeMediaItems(items: MediaItem[]) {
  return items.reduce<MediaItem[]>((uniqueItems, item) => {
    const alreadyExists = uniqueItems.some((existingItem) => areSameMediaEntry(existingItem, item))
    return alreadyExists ? uniqueItems : [...uniqueItems, item]
  }, [])
}

export function findMatchingMediaItem<TItem extends MediaComparable>(items: MediaItem[], targetItem: TItem) {
  return items.find((item) => areSameMediaEntry(item, targetItem))
}
