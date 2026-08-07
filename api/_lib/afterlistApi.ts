import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export type ApiToken = {
  id: string
  user_id: string
  scopes: string[]
  expires_at: string | null
  revoked_at: string | null
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export function adminClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('The AfterList API is not configured.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function bearerToken(request: Request) {
  const value = request.headers.get('authorization')
  return value?.startsWith('Bearer ') ? value.slice(7).trim() : ''
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function generateToken() {
  return `aft_${randomBytes(32).toString('base64url')}`
}

export async function authenticateUser(request: Request) {
  const token = bearerToken(request)
  if (!token || token.startsWith('aft_')) return null
  const { data, error } = await adminClient().auth.getUser(token)
  return error ? null : data.user
}

export async function authenticateIntegration(request: Request, scope: string) {
  const token = bearerToken(request)
  if (!/^aft_[A-Za-z0-9_-]{43}$/.test(token)) return null
  const { data, error } = await adminClient()
    .from('api_tokens')
    .select('id,user_id,scopes,expires_at,revoked_at')
    .eq('token_hash', hashToken(token))
    .is('revoked_at', null)
    .maybeSingle()
  if (error || !data) return null
  const row = data as ApiToken
  if (!row.scopes.includes(scope) || (row.expires_at && new Date(row.expires_at) <= new Date())) return null
  return { ...row, rawToken: token }
}
