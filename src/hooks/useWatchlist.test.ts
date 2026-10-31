import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useWatchlist } from './useWatchlist'
const auth = vi.hoisted(() => ({user:{id:'owner-a'},isLoading:false}))
vi.mock('../context/AuthContext', () => ({useAuth: () => auth}))
vi.mock('../services/supabase', () => ({supabase:{rpc: vi.fn().mockResolvedValue({error:{code:'PGRST202'}})}}))
vi.mock('../services/watchlistItems', () => ({fetchCloudWatchlist:vi.fn().mockResolvedValue([]),syncGuestWatchlist:vi.fn().mockResolvedValue([]),createCloudWatchlistItem:vi.fn().mockRejectedValue(new Error('offline'))}))

import { supabase } from '../services/supabase'
import { fetchCloudWatchlist } from '../services/watchlistItems'

vi.mock('../services/tmdb', async (original) => ({...await original<typeof import('../services/tmdb')>(),fetchTmdbDetails:vi.fn().mockResolvedValue({runtimeMinutes:120})}))

it('clears account sync errors when signing out',async () => {
 localStorage.clear();auth.user={id:'owner-a'}
 const {result,rerender,unmount}=renderHook(() => useWatchlist())
 await act(async () => {await result.current.handleAddItem({id:'x',source:'anilist',externalId:'1',title:'Private',type:'Anime',status:'Planned',poster:'',backdrop:'',progress:'',rating:'',description:''})})
 expect(result.current.syncError).toMatch(/migration/i)
 auth.user=null as never
 rerender()
 await waitFor(() => expect(result.current.syncError).toBeNull())
 expect(result.current.isSyncing).toBe(false)
 expect(result.current.items).toEqual([])
 unmount();auth.user={id:'owner-a'}
})

it('clears unknown recency when the guest explicitly edits a migrated title',async () => {
 localStorage.clear();auth.user=null as never
 localStorage.setItem('afterlist_items',JSON.stringify([{id:'old',source:'anilist',externalId:'2',title:'Legacy',status:'Planned'}]))
 localStorage.setItem('afterlist_items_unknown_recency',JSON.stringify(['anilist:2']))
 const {result,unmount}=renderHook(() => useWatchlist())
 await act(async () => {await result.current.handleUpdateItem('old',{privateNotes:'Edited'})})
 expect(localStorage.getItem('afterlist_items_unknown_recency')).toBe('[]')
 unmount();auth.user={id:'owner-a'}
})
it('retains automatic runtime enrichment when adding a guest TMDB title',async () => {
 localStorage.clear();auth.user=null as never
 const {result,unmount}=renderHook(() => useWatchlist())
 await act(async () => {await result.current.handleAddItem({id:'runtime',source:'tmdb',externalId:'movie:1',title:'Runtime',type:'Movie',status:'Planned',poster:'',backdrop:'',progress:'',rating:'',description:''})})
 await waitFor(() => expect(result.current.items[0]?.runtimeMinutes).toBe(120))
 unmount();auth.user={id:'owner-a'}
})
it('never replays or displays another account queue after switching owners', async () => {
 localStorage.clear()
 localStorage.setItem('afterlist_queue:owner-a',JSON.stringify([{item:{id:'x',source:'anilist',externalId:'1',title:'Private A'},removed:false,token:'pending',attempts:0}]))
 auth.user={id:'owner-b'}
 vi.mocked(supabase!.rpc).mockClear()
 const {result,unmount}=renderHook(() => useWatchlist())
 await waitFor(() => expect(vi.mocked(fetchCloudWatchlist)).toHaveBeenCalledWith('owner-b'))
 await act(async () => {await Promise.resolve()})
 expect(result.current.items).toEqual([])
 expect(supabase!.rpc).not.toHaveBeenCalled()
 expect(localStorage.getItem('afterlist_queue:owner-a')).toContain('Private A')
 unmount();auth.user={id:'owner-a'}
})
it('drains a removal staged while an add is in flight without resurrecting the item',async () => {
 localStorage.clear()
 let release: () => void = () => {}
 const gate=new Promise<void>((resolve) => {release=resolve})
 const rpc=vi.mocked(supabase!.rpc)
 rpc.mockReset().mockImplementationOnce((async () => {await gate;return {data:{applied:true},error:null}}) as never).mockResolvedValue({data:{applied:true},error:null} as never)
 const {result,unmount}=renderHook(() => useWatchlist())
 await act(async () => {await Promise.resolve();await Promise.resolve()})
 let add:Promise<void>=Promise.resolve(), remove:Promise<void>=Promise.resolve()
 act(() => {add=result.current.handleAddItem({id:'x',source:'anilist',externalId:'1',title:'Rapid',type:'Anime',status:'Planned',poster:'',backdrop:'',progress:'',rating:'',description:''})})
 act(() => {remove=result.current.handleRemoveItem('x')})
 release()
 await act(async () => {await Promise.all([add,remove])})
 expect(localStorage.getItem('afterlist_queue:owner-a')).toBe('[]')
 expect(rpc).toHaveBeenCalledWith('apply_browser_watchlist_edit',expect.objectContaining({p_removed:true,p_owner:'owner-a'}))
 expect(result.current.items).toEqual([])
 unmount();rpc.mockResolvedValue({error:{code:'PGRST202'}} as never)
})
it('claims guest imports into the owner queue before clearing the guest bucket', async () => {
 localStorage.clear()
 localStorage.setItem('afterlist_items',JSON.stringify([{id:'x',source:'anilist',externalId:'1',title:'Guest',type:'Anime',status:'Planned',poster:'',backdrop:'',progress:'',rating:'',description:''}]))
 const {result,unmount}=renderHook(() => useWatchlist())
 await waitFor(() => expect(result.current.syncError).toMatch(/migration/i))
 expect(localStorage.getItem('afterlist_queue:owner-a')).toContain('Guest')
 expect(localStorage.getItem('afterlist_items')).toBeNull()
 unmount()
})
it('retains an offline addition durably and reports missing migration', async () => {
 localStorage.clear()
 const {result} = renderHook(() => useWatchlist())
 await waitFor(() => expect(result.current.isSyncing).toBe(false))
 await act(async () => { await result.current.handleAddItem({id:'x',source:'anilist',externalId:'1',title:'Test',type:'Anime',status:'Planned',poster:'',backdrop:'',progress:'',rating:'',description:''}) })
 expect(result.current.items).toHaveLength(1)
 expect(localStorage.getItem('afterlist_queue:owner-a')).toContain('Test')
 expect(result.current.syncError).toMatch(/migration/i)
})
import { enqueueByKey, parseSavedItems, applyLocalEdit } from './useWatchlist'
it('orders rapid local edits even when the wall clock has not advanced',() => {
 const item=parseSavedItems(JSON.stringify([{id:'x',source:'anilist',externalId:'1',title:'Clock',updatedAt:'2026-01-01T00:00:00.000Z'}])).items[0]
 expect(applyLocalEdit(item,{},Date.parse(item.updatedAt!)).updatedAt).toBe('2026-01-01T00:00:00.001Z')
})

describe('guest watchlist migration', () => {
  it('migrates legacy status and stamps defaults while retaining unknown recency', () => {
    const result = parseSavedItems(JSON.stringify([{
      id: '1', externalId: 'movie:1', source: 'tmdb', title: 'Movie', type: 'Movie',
      status: 'Completed', poster: '', backdrop: '', progress: '', rating: '', description: '',
    }]), '2026-01-01T00:00:00.000Z')

    expect(result.items[0]).toMatchObject({ status: 'Watched', currentEpisode: 0, personalRating: null, isFavorite: false })
    expect(result.unknownRecencyKeys).toContain('tmdb:movie:1')
  })

  it('serializes cloud updates for the same title', async () => {
    const queues = new Map<string, Promise<unknown>>()
    const events: string[] = []
    let releaseFirst: () => void = () => {}
    const gate = new Promise<void>((resolve) => { releaseFirst = resolve })
    const first = enqueueByKey(queues, 'title', async () => { events.push('first start'); await gate; events.push('first end') })
    const second = enqueueByKey(queues, 'title', async () => { events.push('second') })

    await Promise.resolve()
    await Promise.resolve()
    expect(events).toEqual(['first start'])
    releaseFirst()
    await Promise.all([first, second])
    expect(events).toEqual(['first start', 'first end', 'second'])
  })
})
