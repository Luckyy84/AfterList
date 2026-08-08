import { boundedInteger, publicJson, publicNotFound, publicProfilesEnabled, publicRpc, rateLimit, validListSlug, validUsername } from './_lib.js'

export async function GET(request: Request) {
  if (!publicProfilesEnabled()) return publicNotFound()
  const retryAfter = rateLimit(request, 'list')
  if (retryAfter) return publicJson({ error: 'Too many requests.' }, 429, { 'retry-after': String(retryAfter) })
  const params = new URL(request.url).searchParams
  const username = params.get('username')?.trim().toLowerCase() ?? ''
  const slug = params.get('slug')?.trim().toLowerCase() ?? ''
  const limit = boundedInteger(params.get('limit'), 50, 1, 100)
  const offset = boundedInteger(params.get('offset'), 0, 0, 10_000)
  if (!validUsername(username) || !validListSlug(slug) || limit === null || offset === null) return publicJson({ error: 'Invalid public list request.' }, 400)

  try {
    const { data, error } = await publicRpc('get_public_list', { p_username: username, p_list_slug: slug, p_limit: limit, p_offset: offset })
    if (error) return publicJson({ error: 'Public profiles are temporarily unavailable.' }, 503)
    if (!data) return publicNotFound()
    const result = data as { redirectUsername?: string | null }
    return publicJson(result)
  } catch {
    return publicJson({ error: 'Public profiles are temporarily unavailable.' }, 503)
  }
}
