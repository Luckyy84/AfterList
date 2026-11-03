import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { providerFetch, resetProviderCache } from './provider.js'
beforeEach(() => { resetProviderCache(); vi.restoreAllMocks() })
afterEach(() => { vi.unstubAllEnvs() })
it('blocks AniList before cached responses when permission is revoked', async () => {
 vi.stubEnv('ANILIST_ENABLED', 'true')
 vi.stubEnv('ANILIST_PERMISSION_REFERENCE', 'test permission')
 const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{"data":{"Page":{"media":[]}}}'))
 expect((await providerFetch('https://graphql.anilist.co')).status).toBe(200)
 vi.stubEnv('ANILIST_PERMISSION_REFERENCE', '')
 expect((await providerFetch('https://graphql.anilist.co')).status).toBe(503)
 expect(fetcher).toHaveBeenCalledTimes(1)
})
it('refuses authenticated AniList and cookie-bearing requests before touching shared cache', async () => {
 const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{}'))
 await expect(providerFetch('https://graphql.anilist.co',{headers:{authorization:'Bearer private'}})).rejects.toThrow(/public/i)
 await expect(providerFetch('https://api.themoviedb.org/3/movie/1',{headers:{cookie:'private'}})).rejects.toThrow(/public/i)
 expect(fetcher).not.toHaveBeenCalled()
})
it('does not cache failures or malformed catalogue payloads', async () => {
 const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async () => new Response('{}'))
 const first=await providerFetch('https://api.themoviedb.org/3/movie/1');await providerFetch('https://api.themoviedb.org/3/movie/1')
 expect(first.status).toBe(502)
 expect(fetcher).toHaveBeenCalledTimes(2)
})
it('bounds distinct in-flight requests', async () => {
 let release: () => void = () => {}
 const gate=new Promise<void>((resolve) => {release=resolve})
 vi.spyOn(globalThis,'fetch').mockImplementation(async () => {await gate;return new Response('{}')})
 const pending=Array.from({length:12},(_,id) => providerFetch(`https://api.themoviedb.org/3/movie/${id}`))
 expect((await providerFetch('https://api.themoviedb.org/3/movie/99')).status).toBe(429)
 release();await Promise.all(pending)
})
it('caps cache misses per provider minute, including failures', async () => {
 vi.spyOn(Date,'now').mockReturnValue(1000)
 const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async () => new Response('{}',{status:503}))
 for(let i=0;i<60;i++) await providerFetch(`https://api.themoviedb.org/3/movie/${i}`)
 expect((await providerFetch('https://api.themoviedb.org/3/movie/999')).status).toBe(429)
 expect(fetcher).toHaveBeenCalledTimes(60)
})
it('expires successful responses', async () => {
 const clock=vi.spyOn(Date,'now').mockReturnValue(0)
 const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async () => new Response('{"id":1,"title":"Test"}'))
 await providerFetch('https://api.themoviedb.org/3/movie/1');clock.mockReturnValue(60_001)
 await providerFetch('https://api.themoviedb.org/3/movie/1');expect(fetcher).toHaveBeenCalledTimes(2)
})
it('coalesces public requests and returns independent cached responses', async () => {
 const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"id":1,"title":"Test"}'))
 const [a,b] = await Promise.all([providerFetch('https://api.themoviedb.org/3/movie/1'), providerFetch('https://api.themoviedb.org/3/movie/1')])
 expect(await a.json()).toEqual({id:1,title:'Test'}); expect(await b.json()).toEqual({id:1,title:'Test'}); expect(fetcher).toHaveBeenCalledTimes(1)
})
it('bounds cached entries and does not retain oversized responses', async () => {
 const clock=vi.spyOn(Date,'now').mockReturnValue(0)
 const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async () => new Response('{"id":1,"title":"Test"}'))
 for(let id=0;id<129;id++) {
  // Separate rate-limit windows without expiring the entire cache at once.
  clock.mockReturnValue(id*1100)
  await providerFetch(`https://api.themoviedb.org/3/movie/${id}`)
 }
 // Rewind so the oldest entry would still be a hit unless capacity evicted it.
 clock.mockReturnValue(0)
 const before=fetcher.mock.calls.length
 await providerFetch('https://api.themoviedb.org/3/movie/0')
 expect(fetcher).toHaveBeenCalledTimes(before+1)
 fetcher.mockImplementation(async () => new Response(JSON.stringify({id:1,title:'x'.repeat(512_000)})))
 await providerFetch('https://api.themoviedb.org/3/movie/large')
 await providerFetch('https://api.themoviedb.org/3/movie/large')
 expect(fetcher).toHaveBeenCalledTimes(before+3)
})
it('separates credentials and releases rejected in-flight requests without retrying', async () => {
 const fetcher=vi.spyOn(globalThis,'fetch').mockRejectedValueOnce(new Error('offline'))
 await expect(providerFetch('https://api.themoviedb.org/3/movie/1')).rejects.toThrow('offline')
 expect(fetcher).toHaveBeenCalledTimes(1)
 fetcher.mockImplementation(async () => new Response('{"id":1,"title":"Test"}'))
 await providerFetch('https://api.themoviedb.org/3/movie/1',{headers:{authorization:'Bearer first'}})
 await providerFetch('https://api.themoviedb.org/3/movie/1',{headers:{authorization:'Bearer second'}})
 expect(fetcher).toHaveBeenCalledTimes(3)
})
