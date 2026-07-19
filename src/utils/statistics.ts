import type { MediaItem, MediaStatus, MediaType } from '../types/media'

const statuses: MediaStatus[] = ['Planned', 'Watching', 'Watched', 'Dropped']
const mediaTypes: MediaType[] = ['Anime', 'Movie', 'TV Series']

export function getWatchedEpisodeCount(item: MediaItem) {
  if (item.type === 'Movie') return 0
  if (item.status === 'Watched') return item.totalEpisodes ?? item.currentEpisode ?? 0
  return item.currentEpisode ?? 0
}

export function calculateStatistics(items: MediaItem[]) {
  const statusCounts = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<MediaStatus, number>
  const typeCounts = Object.fromEntries(mediaTypes.map((type) => [type, 0])) as Record<MediaType, number>
  let favorites = 0
  let episodesWatched = 0
  let ratingTotal = 0
  let ratingCount = 0
  let watchMinutes = 0

  for (const item of items) {
    statusCounts[item.status] += 1
    typeCounts[item.type] += 1
    if (item.isFavorite) favorites += 1
    if (item.personalRating != null) {
      ratingTotal += item.personalRating
      ratingCount += 1
    }

    episodesWatched += item.currentEpisode ?? 0
    if (item.runtimeMinutes) {
      watchMinutes += item.type === 'Movie'
        ? (item.status === 'Watched' ? item.runtimeMinutes : 0)
        : getWatchedEpisodeCount(item) * item.runtimeMinutes
    }
  }

  return {
    totalTitles: items.length,
    completionRate: items.length ? Math.round(statusCounts.Watched / items.length * 100) : 0,
    favorites,
    averageRating: ratingCount ? (ratingTotal / ratingCount).toFixed(1) : '—',
    episodesWatched,
    watchMinutes,
    statusCounts,
    typeCounts,
  }
}

export function formatWatchTime(totalMinutes: number) {
  if (totalMinutes < 60) return `${totalMinutes}m`
  const totalHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (totalHours < 24) return minutes ? `${totalHours}h ${minutes}m` : `${totalHours}h`
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours ? `${days}d ${hours}h` : `${days}d`
}
