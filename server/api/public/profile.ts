import { publicJson, publicNotFound, publicProfilesEnabled, publicRpc, rateLimit, validUsername } from './_lib.js'

export async function GET(request: Request) {
  if (!publicProfilesEnabled()) return publicNotFound()
  const retryAfter = rateLimit(request, 'profile')
  if (retryAfter) return publicJson({ error: 'Too many requests.' }, 429, { 'retry-after': String(retryAfter) })
  const username = new URL(request.url).searchParams.get('username')?.trim().toLowerCase() ?? ''
  if (!validUsername(username)) return publicJson({ error: 'A valid username is required.' }, 400)

  try {
    const { data, error } = await publicRpc('get_public_profile', { p_username: username })
    if (error) return publicJson({ error: 'Public profiles are temporarily unavailable.' }, 503)
    if (!data) return publicNotFound()
    const result = data as { redirectUsername?: string | null }
    return publicJson(result)
  } catch {
    return publicJson({ error: 'Public profiles are temporarily unavailable.' }, 503)
  }
}
