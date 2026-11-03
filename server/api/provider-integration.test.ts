import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GET as search } from './search'
import { GET as details } from './details'
import { GET as discover } from './discover'
import { GET as anilist } from './anilist'
import { resetProviderCache } from './_lib/provider'
beforeEach(() => {
 vi.stubEnv('ANILIST_ENABLED','true')
 vi.stubEnv('ANILIST_PERMISSION_REFERENCE','test-only permission')
})
afterEach(() => {resetProviderCache();vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks()})
it.each([[search,'search?query=error-test'],[details,'details?externalId=movie:1'],[discover,'discover?feed=trending'],[anilist,'anilist?operation=discover']])('does not log upstream error data: %s',async (handler,path) => {
 vi.stubEnv('TMDB_API_KEY','test')
 const log=vi.spyOn(console,'error').mockImplementation(() => {})
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Object.assign(new Error('private upstream body'),{name:'private upstream credential'})))
 const response=await handler(new Request(`https://test/api/${path}`))
 expect(response.status).toBeGreaterThanOrEqual(500)
 expect(response.headers.get('cache-control')).toBe('no-store')
 expect(await response.text()).not.toContain('private upstream')
 expect(JSON.stringify(log.mock.calls)).not.toContain('private upstream')
})
it.each([[search,'search?query=limit-test'],[discover,'discover?feed=trending']])('preserves rate-limit retry guidance without caching failures',async (handler,path) => {
 vi.stubEnv('TMDB_API_KEY','test')
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:429,headers:{'retry-after':'15'}})))
 const response=await handler(new Request(`https://test/api/${path}`))
 expect(response.status).toBe(429)
 expect(response.headers.get('retry-after')).toBe('15')
})
it.each([[search,'search?query=timeout-test'],[discover,'discover?feed=trending']])('maps provider timeouts to no-store gateway timeout',async (handler,path) => {
 vi.stubEnv('TMDB_API_KEY','test')
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Object.assign(new Error('secret upstream URL'),{name:'TimeoutError'})))
 const response=await handler(new Request(`https://test/api/${path}`))
 expect(response.status).toBe(504)
 expect(response.headers.get('cache-control')).toBe('no-store')
 expect(await response.text()).not.toContain('secret')
})
it.each([
 [search,'search?query=cache-test',{results:[]}],
 [details,'details?externalId=movie:1',{id:1,title:'Test'}],
 [discover,'discover?feed=trending',{results:[]}],
 [anilist,'anilist?operation=discover',{data:{Page:{media:[]}}}],
])('coalesces catalogue calls across repeated requests: %s', async (handler,path,body) => {
 vi.stubEnv('TMDB_API_KEY','test')
 const fetcher=vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body))))
 vi.stubGlobal('fetch',fetcher)
 const a=await handler(new Request(`https://test/api/${path}`))
 const b=await handler(new Request(`https://test/api/${path}`))
 expect(a.status).toBe(200);expect(b.status).toBe(200)
 expect(fetcher).toHaveBeenCalledTimes(1)
})
