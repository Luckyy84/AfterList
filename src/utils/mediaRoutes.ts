import type { MediaItem, MediaSource } from '../types/media'

export type MediaRouteKind = 'anime' | 'movie' | 'tv'

type RoutableMedia = Pick<MediaItem, 'externalId' | 'source' | 'title'>

export function slugifyTitle(title: string) {
  const slug = title
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'untitled'
}

export function parseTmdbExternalId(externalId?: string) {
  const match = externalId?.match(/^(movie|tv):(\d+)$/)
  if (!match || Number(match[2]) <= 0) return null
  return { kind: match[1] as 'movie' | 'tv', id: match[2] }
}

export function parsePositiveMediaId(id?: string) {
  return id && /^[1-9]\d*$/.test(id) ? id : null
}

export function getMediaPath(item: RoutableMedia) {
  if (item.source === 'tmdb') {
    const identity = parseTmdbExternalId(item.externalId)
    if (identity) return `/${identity.kind}/${identity.id}/${slugifyTitle(item.title)}`
  }

  if (item.source === 'anilist') {
    const id = parsePositiveMediaId(item.externalId)
    if (id) return `/anime/${id}/${slugifyTitle(item.title)}`
  }

  return '/discover'
}

export function mediaIdentityMatches(
  item: Pick<MediaItem, 'externalId' | 'source'>,
  source: MediaSource,
  externalId: string,
) {
  return item.source === source && item.externalId === externalId
}
