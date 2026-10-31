import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { removeOwnedStorage } from '../_lib/storage.js'
import { adminClient, authenticateUser, json } from '../_lib/afterlistApi.js'

export async function POST(request: Request) {
  const user = await authenticateUser(request)
  if (!user) return json({ error: 'Unauthorized.' }, 401)
  let output: Buffer
  try {
    const type = request.headers.get('content-type')
    const formats: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' }
    if (!type || !formats[type] || !request.body) throw new Error('type')
    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('size') }
      chunks.push(value)
    }
    const image = sharp(Buffer.concat(chunks), { limitInputPixels: 4096 * 4096, failOn: 'warning' })
    const metadata = await image.metadata()
    if (metadata.format !== formats[type] || !metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096 || (metadata.pages ?? 1) !== 1) throw new Error('dimensions/type')
    output = await image.rotate().resize(512, 512, { fit: 'inside', withoutEnlargement: true }).webp().toBuffer()
  } catch {
    return json({ error: 'Use a valid single-frame PNG, JPEG or WebP, at most 2 MiB and 4096 × 4096 pixels.' }, 400)
  }
  const client = adminClient()
  const name = `${user.id}/${randomUUID()}.webp`
  const bucket = client.storage.from('avatars')
  const { error } = await bucket.upload(name, output, { contentType: 'image/webp', upsert: false, cacheControl: '0' })
  if (error) return json({ error: 'Avatar unavailable. Apply the safe_avatars migration and retry.' }, 503)
  const avatarUrl = bucket.getPublicUrl(name).data.publicUrl
  const result = await client.from('profiles').update({ avatar_url: avatarUrl }).eq('user_id', user.id).select('user_id').single()
  if (result.error || !result.data) {
    await bucket.remove([name])
    return json({ error: 'Profile unavailable. Apply profile migrations and retry.' }, 503)
  }
  return json({ avatarUrl })
}

export async function DELETE(request: Request) {
  const user = await authenticateUser(request)
  if (!user) return json({ error: 'Unauthorized.' }, 401)
  try { await removeOwnedStorage(user.id, true) } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : 'Storage unavailable.' }, 503)
  }
  const result = await adminClient().from('profiles').update({ avatar_url: null }).eq('user_id', user.id).select('user_id').single()
  if (result.error || !result.data) return json({ error: 'Profile unavailable. Apply profile migrations and retry.' }, 503)
  return new Response(null, { status: 204 })
}
