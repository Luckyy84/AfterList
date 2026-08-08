import { createClient } from '@supabase/supabase-js'

const RATE_LIMIT = 60
const RATE_WINDOW_MS = 60_000
const requests = new Map<string, { count: number; resetAt: number }>()

export function publicProfilesEnabled() {
  return process.env.PUBLIC_PROFILES_ENABLED?.trim().toLowerCase() === 'true'
}

export function publicJson(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  })
}

export function publicNotFound() {
  return publicJson({ error: 'Public profile not found.' }, 404)
}

export function rateLimit(request: Request, route: string) {
  const now = Date.now()
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  const key = `${route}:${ip}`
  const current = requests.get(key)
  if (!current || current.resetAt <= now) {
    if (requests.size >= 5_000) {
      for (const [candidate, value] of requests) if (value.resetAt <= now) requests.delete(candidate)
      if (requests.size >= 5_000) requests.delete(requests.keys().next().value as string)
    }
    requests.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return null
  }
  current.count += 1
  if (current.count <= RATE_LIMIT) return null
  return Math.max(1, Math.ceil((current.resetAt - now) / 1000))
}

export function validUsername(value: string) {
  return /^[a-z0-9_]{3,30}$/.test(value)
}

export function validListSlug(value: string) {
  return value.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

export function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number) {
  if (value === null) return fallback
  if (!/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null
}

export async function publicRpc(name: 'get_public_profile' | 'get_public_library' | 'get_public_list', args: Record<string, unknown>) {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !key) throw new Error('Public profile data is not configured.')
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return client.rpc(name, args)
}
