import { adminClient, authenticateUser, generateToken, hashToken, json } from '../../_lib/afterlistApi.js'

export async function GET(request: Request) {
  const user = await authenticateUser(request)
  if (!user) return json({ error: 'Unauthorized.' }, 401)
  const { data, error } = await adminClient()
    .from('api_tokens')
    .select('id,name,scopes,created_at,last_used_at,expires_at,revoked_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  return error ? json({ error: 'Could not load integration tokens.' }, 500) : json({ tokens: data })
}

export async function POST(request: Request) {
  const user = await authenticateUser(request)
  if (!user) return json({ error: 'Unauthorized.' }, 401)
  const body = await request.json().catch(() => null) as { name?: unknown } | null
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 80) return json({ error: 'Name must be between 1 and 80 characters.' }, 400)

  const token = generateToken()
  const { data, error } = await adminClient().from('api_tokens').insert({
    user_id: user.id,
    name,
    token_hash: hashToken(token),
    scopes: ['watchlist:read', 'watchlist:write'],
  }).select('id,name,scopes,created_at,last_used_at,expires_at,revoked_at').single()
  return error ? json({ error: 'Could not create integration token.' }, 500) : json({ token, integration: data }, 201)
}

export async function DELETE(request: Request) {
  const user = await authenticateUser(request)
  if (!user) return json({ error: 'Unauthorized.' }, 401)
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return json({ error: 'Token id is required.' }, 400)
  const { error } = await adminClient().from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
  return error ? json({ error: 'Could not revoke integration token.' }, 500) : new Response(null, { status: 204 })
}
