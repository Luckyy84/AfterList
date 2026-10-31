import { adminClient } from './afterlistApi.js'

// Inventory is server-only and includes legacy owned objects in other buckets.
export async function removeOwnedStorage(userId: string, avatarsOnly = false) {
  const client = adminClient()
  let previous = ''
  for (let batch = 0; batch < 100; batch++) {
    const { data, error } = await client.rpc('owned_storage_objects', { p_user_id: userId, p_avatars_only: avatarsOnly })
    if (error || !Array.isArray(data)) throw new Error('Storage unavailable. Apply the safe_avatars migration and retry.')
    if (!data.length) return
    const inventory = JSON.stringify(data)
    if (inventory === previous) throw new Error('Storage cleanup did not converge. Account remains active; retry.')
    previous = inventory
    for (const bucket of new Set(data.map((row: { bucket_id: string }) => row.bucket_id))) {
      const names = data.filter((row: { bucket_id: string }) => row.bucket_id === bucket).map((row: { name: string }) => row.name)
      const result = await client.storage.from(bucket).remove(names)
      if (result.error) throw new Error('Owned files could not be removed. Account remains active; retry.')
    }
    // Read back until inventory is empty; never delete auth while objects remain.
  }
  throw new Error('Storage cleanup did not converge. Account remains active; retry.')
}
