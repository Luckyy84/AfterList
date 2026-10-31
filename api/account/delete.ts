import { adminClient, authenticateUser, json } from '../_lib/afterlistApi.js'
import { removeOwnedStorage } from '../_lib/storage.js'

export async function DELETE(request: Request) {
  const user = await authenticateUser(request)
  if (!user) return json({ error: 'Unauthorized.' }, 401)
  const body = await request.json().catch(() => null)
  if (body?.confirmation !== 'DELETE' || typeof body?.password !== 'string' || !body.password || body.password.length > 1024) {
    return json({ error: 'Type DELETE and enter your current password. Google-only accounts must first set a password through account recovery.' }, 400)
  }
  const client = adminClient()
  const { data: allowed, error: limitError } = await client.rpc('consume_account_reauth_attempt', { p_user_id: user.id })
  if (limitError) return json({ error: 'Account deletion unavailable. Apply the systems_foundation migration on this environment and retry.' }, 503)
  if (!allowed) return json({ error: 'Too many attempts. Wait 15 minutes and try again.' }, 429)
  if (!user.email) return json({ error: 'This account has no password sign-in email.' }, 403)
  // signIn mutates client authorization even without persistence; never reuse it for admin work.
  const { data, error } = await adminClient().auth.signInWithPassword({ email: user.email, password: body.password })
  if (error || data.user?.id !== user.id) return json({ error: 'Current password could not be verified.' }, 403)
  try { await removeOwnedStorage(user.id) } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : 'Storage cleanup unavailable. Apply safe_avatars migration.' }, 503)
  }
  // Fresh credentials are verified here, never trusted from client timestamps or JWT iat.
  const { error: deleteError } = await client.auth.admin.deleteUser(user.id)
  if (deleteError) return json({ error: 'Account could not be deleted. Your account remains active; retry or contact support.' }, 500)
  return new Response(null, { status: 204 })
}
