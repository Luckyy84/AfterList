import type { MediaItem, MediaSource, MediaStatus, MediaType } from '../types/media'
import { supabase } from './supabase'

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
  created_at: string
  updated_at: string
}

type WatchlistInsertPayload = Omit<WatchlistItemRow, 'id' | 'created_at' | 'updated_at'>

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
  }
}

export async function fetchCloudWatchlist(userId: string) {
  const client = assertSupabase()

  const { data, error } = await client
    .from('watchlist_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data as WatchlistItemRow[]).map(mapWatchlistRowToMediaItem)
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

export async function updateCloudWatchlistItemStatus(id: string, status: MediaStatus, userId: string) {
  const client = assertSupabase()

  const { data, error } = await client
    .from('watchlist_items')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) throw error

  return mapWatchlistRowToMediaItem(data as WatchlistItemRow)
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
