import type { MediaItem, MediaSource, MediaType, MediaUpdate } from '../types/media'

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

export function getMediaKey(item: Pick<MediaItem, 'source' | 'externalId'>) {
  return item.source && item.externalId ? `${item.source}:${item.externalId}` : ''
}

export function applyMediaUpdate(item: MediaItem, updates: MediaUpdate, now = new Date().toISOString()): MediaItem {
  const updated = { ...item, ...updates, updatedAt: now }

  updated.runtimeMinutes = Number.isFinite(updated.runtimeMinutes) && updated.runtimeMinutes! > 0
    ? Math.round(updated.runtimeMinutes!)
    : undefined

  updated.personalRating = updated.personalRating == null || !Number.isFinite(updated.personalRating)
    ? null
    : Math.min(10, Math.max(1, Math.round(updated.personalRating)))

  if (updated.type === 'Movie') {
    updated.currentEpisode = undefined
    updated.totalEpisodes = undefined
    return updated
  }

  updated.currentEpisode = Number.isFinite(updated.currentEpisode)
    ? Math.max(0, Math.floor(updated.currentEpisode ?? 0))
    : 0
  updated.totalEpisodes = Number.isFinite(updated.totalEpisodes) && updated.totalEpisodes! > 0
    ? Math.floor(updated.totalEpisodes!)
    : undefined
  if (updated.totalEpisodes) {
    updated.currentEpisode = Math.min(updated.currentEpisode ?? 0, updated.totalEpisodes)
    if (updated.currentEpisode === updated.totalEpisodes) updated.status = 'Watched'
    else if (updates.currentEpisode !== undefined && item.status === 'Watched') updated.status = 'Watching'
  }

  return updated
}

export function mergeWatchlists(
  localItems: MediaItem[],
  cloudItems: MediaItem[],
  localItemsWithUnknownRecency = new Set<string>(),
) {
  return localItems.reduce((merged, localItem) => {
    const cloudIndex = merged.findIndex((cloudItem) => areSameMediaEntry(localItem, cloudItem))
    if (cloudIndex < 0) return [...merged, localItem]

    const cloudItem = merged[cloudIndex]
    const localKey = getMediaKey(localItem)
    const localIsNewer = !localItemsWithUnknownRecency.has(localKey)
      && Boolean(localItem.updatedAt)
      && (!cloudItem.updatedAt || localItem.updatedAt! > cloudItem.updatedAt)

    if (localIsNewer) merged[cloudIndex] = { ...localItem, id: cloudItem.id }
    return merged
  }, [...cloudItems])
}
