import type { MediaItem, MediaSource, MediaType, MediaUpdate } from '../types/media'
import type { SearchResultItem } from '../types/search'

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
  canonicalId?: string
  aliases?: MediaItem['aliases']
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function getComparableYear(item: MediaComparable) {
  if (item.year) return item.year.trim()

  const yearMatch = item.progress?.match(/\b(19|20)\d{2}\b/)
  return yearMatch?.[0]
}

export function areSameMediaEntry(first: MediaComparable, second: MediaComparable) {
  if (first.canonicalId && second.canonicalId && first.canonicalId === second.canonicalId) return true
  const firstAliases = new Set((first.aliases ?? []).map((alias) => `${alias.source}:${alias.externalId}`))
  if ((second.aliases ?? []).some((alias) => firstAliases.has(`${alias.source}:${alias.externalId}`))) return true
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

export function findProbableMediaDuplicate(items: MediaItem[], targetItem: MediaComparable) {
  return items.find((item) => {
    if (areSameMediaEntry(item, targetItem)) return false
    const itemYear = getComparableYear(item)
    const targetYear = getComparableYear(targetItem)
    return normalizeText(item.title) === normalizeText(targetItem.title)
      && Boolean(itemYear && targetYear && itemYear === targetYear)
  })
}

export function getMediaKey(item: Pick<MediaItem, 'source' | 'externalId'>) {
  return item.source && item.externalId ? `${item.source}:${item.externalId}` : ''
}

function localDateValue(timestamp: string) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function applyAutomaticTrackingDates(updated: MediaItem, now: string) {
  const today = localDateValue(now)
  if (!today) return

  if (updated.status === 'Watching' && !updated.startedAt) updated.startedAt = today
  if (updated.status === 'Watched' && !updated.completedAt) updated.completedAt = today
}

export function applyMediaUpdate(item: MediaItem, updates: MediaUpdate, now = new Date().toISOString()): MediaItem {
  const updated = { ...item, ...updates, updatedAt: now }
  const startingRewatch = updates.isRewatching === true && !item.isRewatching

  if (startingRewatch) {
    updated.status = 'Watching'
    updated.currentEpisode = item.type === 'Movie' ? undefined : 0
    updated.startedAt = localDateValue(now)
    updated.completedAt = null
  }

  updated.runtimeMinutes = Number.isFinite(updated.runtimeMinutes) && updated.runtimeMinutes! > 0
    ? Math.round(updated.runtimeMinutes!)
    : undefined

  updated.personalRating = updated.personalRating == null || !Number.isFinite(updated.personalRating)
    ? null
    : Math.min(10, Math.max(1, Math.round(updated.personalRating)))
  updated.rewatchCount = Number.isFinite(updated.rewatchCount)
    ? Math.max(0, Math.floor(updated.rewatchCount ?? 0))
    : 0
  updated.privateNotes = updated.privateNotes?.slice(0, 5000) ?? ''

  if (updated.type === 'Movie') {
    updated.currentEpisode = undefined
    updated.totalEpisodes = undefined
    applyAutomaticTrackingDates(updated, now)
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

  applyAutomaticTrackingDates(updated, now)

  return updated
}

export function searchResultToMediaItem(result: SearchResultItem, status: MediaItem['status'] = 'Planned'): MediaItem {
  return {
    id: `${result.source}-${result.externalId}`,
    externalId: result.externalId,
    source: result.source,
    title: result.title,
    type: result.type,
    status,
    poster: result.poster,
    backdrop: result.backdrop,
    progress: status === 'Watched' ? 'Watched' : result.year,
    rating: result.rating,
    description: result.description,
    year: result.year,
    aliases: [{ source: result.source, externalId: result.externalId }],
  }
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
