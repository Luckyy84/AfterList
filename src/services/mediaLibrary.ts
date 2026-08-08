import { supabase } from './supabase'
import type { MediaItem } from '../types/media'

function client() { if (!supabase) throw new Error('Supabase is not configured.'); return supabase }
function identity(item: MediaItem) { if (!item.source || !item.externalId) throw new Error('Missing media identity.'); return { provider: item.source, id: item.externalId } }

export async function confirmMediaMatch(existing: MediaItem, candidate: MediaItem) {
  const left = identity(existing); const right = identity(candidate)
  const { data, error } = await client().rpc('confirm_media_match', { p_left_provider: left.provider, p_left_external_id: left.id, p_right_provider: right.provider, p_right_external_id: right.id })
  if (error) throw error
  return data
}
export async function rejectMediaMatch(existing: MediaItem, candidate: MediaItem) {
  const left = identity(existing); const right = identity(candidate)
  const { data, error } = await client().rpc('reject_media_match', { p_left_provider: left.provider, p_left_external_id: left.id, p_right_provider: right.provider, p_right_external_id: right.id })
  if (error) throw error
  return data
}

export type CustomList = { id: string; user_id: string; name: string; slug: string; is_public: boolean; sort_order: number }
export async function fetchCustomLists(userId: string) { const { data, error } = await client().from('custom_lists').select('*').eq('user_id', userId).order('sort_order'); if (error) throw error; return data as CustomList[] }
export async function createCustomList(userId: string, name: string) { const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); const { data, error } = await client().from('custom_lists').insert({ user_id: userId, name: name.trim(), slug, is_public: false }).select('*').single(); if (error) throw error; return data as CustomList }
export async function deleteCustomList(id: string, userId: string) { const { error } = await client().from('custom_lists').delete().eq('id', id).eq('user_id', userId); if (error) throw error }
export async function setListMembership(listId: string, itemId: string, userId: string, included: boolean) { const query = client().from('custom_list_items'); const { error } = included ? await query.upsert({ list_id: listId, watchlist_item_id: itemId, user_id: userId }) : await query.delete().eq('list_id', listId).eq('watchlist_item_id', itemId).eq('user_id', userId); if (error) throw error }
export async function fetchListMemberships(itemId: string, userId: string) { const { data, error } = await client().from('custom_list_items').select('list_id').eq('watchlist_item_id', itemId).eq('user_id', userId); if (error) throw error; return new Set((data ?? []).map((row) => row.list_id as string)) }

export type WatchlistEvent = { id: number; watchlist_item_id: string; event_type: string; old_value: Record<string, unknown> | null; new_value: Record<string, unknown> | null; created_at: string }
export async function fetchWatchlistEvents(userId: string, itemId?: string) { let query = client().from('watchlist_events').select('id,watchlist_item_id,event_type,old_value,new_value,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50); if (itemId) query = query.eq('watchlist_item_id', itemId); const { data, error } = await query; if (error) throw error; return data as WatchlistEvent[] }
