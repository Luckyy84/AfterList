// Public catalogue requests only. Never pass user authorization or private payloads.
const cache = new Map<string, { expires: number; response: Response }>()
const pending = new Map<string, Promise<Response>>()
const limits = new Map<string, {until:number; count:number}>()
export function resetProviderCache() { cache.clear(); pending.clear(); limits.clear() }
export function isAnilistEnabled() {
 return process.env.ANILIST_ENABLED === 'true' && Boolean(process.env.ANILIST_PERMISSION_REFERENCE?.trim())
}
export async function providerFetch(url: string, init?: RequestInit): Promise<Response> {
 const parsed = new URL(url)
 const host = parsed.hostname
 const headers = new Headers(init?.headers)
 if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password || headers.has('cookie') || (host === 'graphql.anilist.co' && headers.has('authorization'))) throw new Error('Only public catalogue requests are allowed')
 if (!['api.themoviedb.org', 'graphql.anilist.co'].includes(host)) throw new Error('Unsupported catalogue provider')
 if (host === 'graphql.anilist.co' && !isAnilistEnabled()) return new Response(JSON.stringify({error:'AniList integration is disabled.'}), {status:503,headers:{'content-type':'application/json','cache-control':'no-store'}})
 const key = `${url}:${init?.body ?? ''}:${new Headers(init?.headers).get('authorization') ?? ''}`
 const hit = cache.get(key)
 if (hit && hit.expires > Date.now()) return hit.response.clone()
 const running = pending.get(key)
 if (running) return (await running).clone()
 if (pending.size >= 12) return new Response(null, {status:429, headers:{'retry-after':'2'}})
 const now = Date.now()
 const limit = limits.get(host)
 const window = limit && limit.until > now ? limit : {until:now+60_000,count:0}
 if (window.count >= 60) return new Response(null,{status:429,headers:{'retry-after':String(Math.max(1,Math.ceil((window.until-now)/1000)))}})
 window.count++
 limits.set(host,window)
 const task = (async () => {
  const response = await fetch(url, init)
  if (response.ok) {
   const text = await response.clone().text()
   let valid = false
   try {
    const data = JSON.parse(text)
    // Let the route normalize GraphQL errors/missing titles; neither enters the cache.
    if (host === 'graphql.anilist.co' && (data?.data?.Media === null || (Array.isArray(data?.errors) && data.errors.length))) return response
    valid = !!data && typeof data === 'object' && !data.errors && (host === 'api.themoviedb.org'
     ? Array.isArray(data.results) || (Number.isSafeInteger(data.id) && (typeof data.title === 'string' || typeof data.name === 'string'))
     : Array.isArray(data.data?.Page?.media) || (Number.isSafeInteger(data.data?.Media?.id) && !!data.data.Media.title))
   } catch { /* invalid responses are not cached */ }
   if (!valid) return new Response(null, {status:502})
   if (text.length <= 512_000) {
    if (cache.size >= 128) cache.delete(cache.keys().next().value!)
    cache.set(key, {expires: Date.now()+60_000, response:response.clone()})
   }
  }
  return response
 })()
 pending.set(key, task)
 try { return (await task).clone() } finally { pending.delete(key) }
}
