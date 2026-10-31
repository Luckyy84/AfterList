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

export function libraryError(error: unknown) {
  const code = (error as { code?: string })?.code
  return ['42P01', '42703', '42883', 'PGRST202', 'PGRST205'].includes(code ?? '')
    ? 'This feature needs the systems_tracking database migration. Existing title progress is still available.'
    : (error as { message?: string })?.message || 'Could not save. Please try again.'
}
export type SeasonProgress = { season: number; current_episode: number; total_episodes: number | null; updated_at: string }
export async function fetchSeasonProgress(itemId: string) {
  const { data, error } = await client().from('season_progress').select('season,current_episode,total_episodes,updated_at').eq('watchlist_item_id', itemId).order('season').limit(1000)
  if (error) throw error
  return data as SeasonProgress[]
}
export async function saveSeasonProgress(itemId: string, season: number, current: number, total: number | null) {
  if (!Number.isInteger(season) || season < 0 || season > 999 || !Number.isInteger(current) || current < 0 || current > 10000 || (total !== null && (!Number.isInteger(total) || total < 1 || total > 10000 || current > total))) throw new Error('Invalid season progress')
  const { data, error } = await client().rpc('save_season_progress', { p_item_id: itemId, p_season: season, p_current: current, p_total: total })
  if (error) throw error
  return data as SeasonProgress
}

export type CustomList = { id: string; user_id: string; name: string; slug: string; is_public: boolean; sort_order: number }
export async function fetchCustomLists(userId: string) { const { data, error } = await client().from('custom_lists').select('*').eq('user_id', userId).order('sort_order'); if (error) throw error; return data as CustomList[] }
export async function createCustomList(userId: string, name: string) { const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); const { data, error } = await client().from('custom_lists').insert({ user_id: userId, name: name.trim(), slug, is_public: false }).select('*').single(); if (error) throw error; return data as CustomList }
export async function deleteCustomList(id: string, userId: string) { const { error } = await client().from('custom_lists').delete().eq('id', id).eq('user_id', userId); if (error) throw error }
export async function setListMembership(listId: string, itemId: string, userId: string, included: boolean) { const query = client().from('custom_list_items'); const { error } = included ? await query.upsert({ list_id: listId, watchlist_item_id: itemId, user_id: userId }) : await query.delete().eq('list_id', listId).eq('watchlist_item_id', itemId).eq('user_id', userId); if (error) throw error }
export async function fetchListMemberships(itemId: string, userId: string) { const { data, error } = await client().from('custom_list_items').select('list_id').eq('watchlist_item_id', itemId).eq('user_id', userId); if (error) throw error; return new Set((data ?? []).map((row) => row.list_id as string)) }

export async function fetchCustomListItems(listId: string, userId: string) {
  const { data, error } = await client().from('custom_list_items').select('watchlist_item_id,position').eq('list_id', listId).eq('user_id', userId).order('position').order('watchlist_item_id').limit(1001)
  if (error) throw error
  if ((data ?? []).length > 1000) throw new Error('This list exceeds the 1000-title bulk editing limit.')
  return (data ?? []).map((row) => row.watchlist_item_id as string)
}
export async function saveCustomListItems(listId: string, ids: string[]) {
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate titles in list.')
  if (ids.length > 1000) throw new Error('Lists support up to 1000 titles in bulk editing.')
  const { data, error } = await client().rpc('save_custom_list_items', { p_list_id: listId, p_item_ids: ids })
  if (error) throw error
  return data
}
export async function reorderCustomLists(ids: string[]) {
  if (new Set(ids).size !== ids.length || ids.length > 1000) throw new Error('Invalid list ordering.')
  const { data, error } = await client().rpc('reorder_custom_lists', { p_list_ids: ids })
  if (error) throw error
  return data
}

export type MediaIdentityAudit = {
  merged: Array<{ id: string; title: string; source: string; external_id: string }>
  audit: Array<{ id: number; alias_a: string; alias_b: string; old_decision: string | null; new_decision: string | null; created_at: string }>
  seasons: Array<{ season: number; anilist_external_id: string }>
}
export async function fetchMediaIdentityAudit(itemId: string, userId: string): Promise<MediaIdentityAudit> {
  const [merged, audit, seasons] = await Promise.all([
    client().from('watchlist_items').select('id,title,source,external_id').eq('user_id', userId).eq('merged_into_id', itemId).order('id').limit(100),
    client().from('media_match_audit').select('id,alias_a,alias_b,old_decision,new_decision,created_at').eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50),
    client().from('anime_season_matches').select('season,anilist_external_id').eq('user_id', userId).eq('watchlist_item_id', itemId).order('season').limit(999),
  ])
  for (const result of [merged, audit, seasons]) if (result.error) throw result.error
  return { merged: merged.data ?? [], audit: audit.data ?? [], seasons: seasons.data ?? [] }
}
export async function undoMediaMerge(winnerId: string, loserId: string) {
  const { data, error } = await client().rpc('undo_media_merge', { p_winner_id: winnerId, p_loser_id: loserId })
  if (error) throw error
  return data
}
export async function saveAnimeSeasonMatch(itemId: string, season: number, anilistId: string | null) {
  if (!Number.isInteger(season) || season < 1 || season > 999 || (anilistId !== null && !/^[1-9][0-9]{0,9}$/.test(anilistId))) throw new Error('Invalid season match.')
  const { data, error } = await client().rpc('save_anime_season_match', { p_item_id: itemId, p_season: season, p_anilist_id: anilistId })
  if (error) throw error
  return data
}

export type WatchActivity = { totalEvents: number; updates: number; added: number; removed: number; completions: number; activeDays: number; trackedSeasons: number; completedSeasons: number; daily: Array<{ date: string; events: number }>; days: number }
export async function fetchWatchActivity(days = 30) {
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error('Invalid activity window.')
  const { data, error } = await client().rpc('get_watch_activity', { p_days: days })
  if (error) throw error
  return data as WatchActivity
}

export type WatchlistEvent = { id: number; watchlist_item_id: string; event_type: string; old_value: Record<string, unknown> | null; new_value: Record<string, unknown> | null; created_at: string }
export async function fetchWatchlistEvents(userId: string, itemId?: string, limit = 50) { let query = client().from('watchlist_events').select('id,watchlist_item_id,event_type,old_value,new_value,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit); if (itemId) query = query.eq('watchlist_item_id', itemId); const { data, error } = await query; if (error) throw error; return data as WatchlistEvent[] }
