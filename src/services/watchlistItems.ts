import type { MediaItem, MediaSource, MediaStatus, MediaType, MediaUpdate } from '../types/media'
import { supabase } from './supabase'
import { applyMediaUpdate, areSameMediaEntry, mergeWatchlists } from '../utils/media'

export type WatchlistItemRow = {
  id: string
  user_id: string
  external_id: string
  source: MediaSource
  title: string
  type: MediaType
  status: MediaStatus
  poster: string
  backdrop: string
  progress: string
  rating: string
  description: string
  year: string | null
  current_episode: number
  total_episodes: number | null
  runtime_minutes: number | null
  personal_rating: number | null
  is_favorite: boolean
  media_id: string | null
  is_rewatching: boolean
  rewatch_count: number
  started_on: string | null
  completed_on: string | null
  private_notes: string
  merged_into_id: string | null
  created_at: string
  updated_at: string
}

type WatchlistInsertPayload = Omit<WatchlistItemRow, 'id' | 'created_at' | 'updated_at' | 'merged_into_id'>

function assertSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured yet.')
  }

  return supabase
}

export function mapWatchlistRowToMediaItem(row: WatchlistItemRow): MediaItem {
  return {
    id: row.id,
    externalId: row.external_id,
    source: row.source,
    title: row.title,
    type: row.type,
    status: row.status,
    poster: row.poster,
    backdrop: row.backdrop,
    progress: row.progress,
    rating: row.rating,
    description: row.description,
    year: row.year ?? undefined,
    currentEpisode: row.current_episode,
    totalEpisodes: row.total_episodes ?? undefined,
    runtimeMinutes: row.runtime_minutes ?? undefined,
    personalRating: row.personal_rating,
    isFavorite: row.is_favorite,
    updatedAt: row.updated_at,
    canonicalId: row.media_id ?? undefined,
    isRewatching: row.is_rewatching ?? false,
    rewatchCount: row.rewatch_count ?? 0,
    startedAt: row.started_on ?? null,
    completedAt: row.completed_on ?? null,
    privateNotes: row.private_notes ?? '',
  }
}

function mapMediaItemToInsertPayload(item: MediaItem, userId: string): WatchlistInsertPayload {
  if (!item.source || !item.externalId) {
    throw new Error('Only API-backed items can be synced to your account.')
  }

  return {
    user_id: userId,
    external_id: item.externalId,
    source: item.source,
    title: item.title,
    type: item.type,
    status: item.status,
    poster: item.poster,
    backdrop: item.backdrop,
    progress: item.progress || (item.status === 'Watched' ? 'Watched' : item.year ?? ''),
    rating: item.rating || 'N/A',
    description: item.description || '',
    year: item.year ?? null,
    current_episode: item.currentEpisode ?? 0,
    total_episodes: item.totalEpisodes ?? null,
    runtime_minutes: item.runtimeMinutes ?? null,
    personal_rating: item.personalRating ?? null,
    is_favorite: item.isFavorite ?? false,
    media_id: item.canonicalId ?? null,
    is_rewatching: item.isRewatching ?? false,
    rewatch_count: item.rewatchCount ?? 0,
    started_on: item.startedAt ?? null,
    completed_on: item.completedAt ?? null,
    private_notes: item.privateNotes ?? '',
  }
}

export async function fetchCloudWatchlist(userId: string) {
  const client = assertSupabase()
  const watchlistRequest = client
    .from('watchlist_items')
    .select('*')
    .eq('user_id', userId)
    .is('merged_into_id', null)
    .order('created_at', { ascending: false })
  const aliasesRequest = client
    .from('user_media_alias_links')
    .select('media_id,provider,external_id')
    .eq('user_id', userId)
  const [{ data, error }, aliasesResult] = await Promise.all([watchlistRequest, aliasesRequest])

  if (error) throw error
  const aliasesByMediaId = new Map<string, MediaItem['aliases']>()
  if (!aliasesResult.error) {
    for (const alias of aliasesResult.data as Array<{ media_id: string; provider: string; external_id: string }> ?? []) {
      if (alias.provider !== 'tmdb' && alias.provider !== 'anilist') continue
      const aliases = aliasesByMediaId.get(alias.media_id) ?? []
      aliases.push({ source: alias.provider, externalId: alias.external_id })
      aliasesByMediaId.set(alias.media_id, aliases)
    }
  }
  return (data as WatchlistItemRow[]).map((row) => ({
    ...mapWatchlistRowToMediaItem(row),
    aliases: row.media_id ? aliasesByMediaId.get(row.media_id) : undefined,
  }))
}

export async function createCloudWatchlistItem(item: MediaItem, userId: string) {
  const client = assertSupabase()
  const payload = mapMediaItemToInsertPayload(item, userId)

  const { data, error } = await client
    .from('watchlist_items')
    .insert(payload)
    .select('*')
    .single()

  if (error) throw error

  return mapWatchlistRowToMediaItem(data as WatchlistItemRow)
}

export async function updateCloudWatchlistItem(id: string, updates: MediaUpdate, userId: string, currentItem?: MediaItem) {
  const client = assertSupabase()

  let baseItem = currentItem
  if (!baseItem) {
    const { data: current, error: fetchError } = await client
      .from('watchlist_items')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()
    if (fetchError) throw fetchError
    baseItem = mapWatchlistRowToMediaItem(current as WatchlistItemRow)
  }
  const updated = applyMediaUpdate(baseItem, updates)

  const { data, error } = await client
    .from('watchlist_items')
    .update({
      poster: updated.poster,
      backdrop: updated.backdrop,
      status: updated.status,
      current_episode: updated.currentEpisode ?? 0,
      total_episodes: updated.totalEpisodes ?? null,
      runtime_minutes: updated.runtimeMinutes ?? null,
      personal_rating: updated.personalRating ?? null,
      is_favorite: updated.isFavorite ?? false,
      is_rewatching: updated.isRewatching ?? false,
      rewatch_count: updated.rewatchCount ?? 0,
      started_on: updated.startedAt ?? null,
      completed_on: updated.completedAt ?? null,
      private_notes: updated.privateNotes ?? '',
      updated_at: updated.updatedAt,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) throw error

  return mapWatchlistRowToMediaItem(data as WatchlistItemRow)
}

async function replaceCloudWatchlistItem(item: MediaItem, cloudId: string, userId: string) {
  const client = assertSupabase()
  const payload = mapMediaItemToInsertPayload(item, userId)
  const { data, error } = await client
    .from('watchlist_items')
    .update({ ...payload, updated_at: item.updatedAt ?? new Date().toISOString() })
    .eq('id', cloudId)
    .eq('user_id', userId)
    .select('*')
    .single()
  if (error) throw error
  return mapWatchlistRowToMediaItem(data as WatchlistItemRow)
}

export async function syncGuestWatchlist(
  localItems: MediaItem[],
  cloudItems: MediaItem[],
  userId: string,
  unknownRecencyKeys: Set<string>,
) {
  const merged = mergeWatchlists(localItems, cloudItems, unknownRecencyKeys)
  const synced = await Promise.all(merged.map(async (item) => {
    const cloudItem = cloudItems.find((candidate) => areSameMediaEntry(candidate, item))
    if (!cloudItem) return createCloudWatchlistItem(item, userId)
    if (item.id === cloudItem.id && item.updatedAt === cloudItem.updatedAt) return cloudItem
    return replaceCloudWatchlistItem(item, cloudItem.id, userId)
  }))
  return synced
}

export async function deleteCloudWatchlistItem(id: string, userId: string) {
  const client = assertSupabase()

  const { error } = await client
    .from('watchlist_items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}
