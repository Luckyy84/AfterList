import { adminClient, authenticateUser, json } from '../_lib/afterlistApi.js'

// Stable unique ordering prevents page-boundary loss. Never select token hashes.
const tables: Record<string, string[]> = {
  watchlist_items: ['id'], profiles: ['user_id'], custom_lists: ['id'],
  custom_list_items: ['list_id', 'watchlist_item_id'], watchlist_events: ['id'],
  season_progress: ['watchlist_item_id', 'season'],
  user_media_alias_links: ['provider', 'external_id'], user_media_match_decisions: ['alias_a', 'alias_b'],
  media_match_audit: ['id'], anime_season_matches: ['watchlist_item_id', 'season'],
  username_history: ['username'], watchlist_tombstones: ['source', 'external_id'], api_tokens: ['id'],
}
export async function GET(request: Request) {
  const user = await authenticateUser(request)
  if (!user) return json({ error: 'Unauthorized.' }, 401)
  const client = adminClient()
  const records: Record<string, unknown[]> = {}
  for (const [table, order] of Object.entries(tables)) {
    records[table] = []
    for (let start = 0; ; start += 500) {
      let query = client.from(table).select(table === 'api_tokens' ? 'id,name,scopes,created_at,last_used_at,expires_at,revoked_at' : '*').eq('user_id', user.id)
      for (const column of order) query = query.order(column)
      const { data, error } = await query.range(start, start + 499)
      if (error || !Array.isArray(data)) return json({ error: 'Account export unavailable. No partial backup was created; retry or contact support.' }, 503)
      records[table].push(...data)
      if (data.length < 500) break
    }
  }
  const response = json({ version: 2, exportedAt: new Date().toISOString(), account: { id: user.id, email: user.email, created_at: user.created_at }, records })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
