import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import AccountExport from './AccountExport'
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear() })
it('discards late owner data after switching accounts', async () => {
 let resolve!: (response: Response) => void
 const pending = new Promise<Response>(done => { resolve = done })
 vi.stubGlobal('fetch', vi.fn(() => pending))
 const createObjectURL = vi.fn(() => 'blob:export')
 vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
 const view = render(<AccountExport accessToken="a-session" owner="a" />)
 fireEvent.click(screen.getByRole('button', { name: 'Export account JSON' }))
 view.rerender(<AccountExport accessToken="b-session" owner="b" />)
 resolve(Response.json({ records: { profiles: [{ user_id: 'a' }] } }))
 await new Promise(done => setTimeout(done, 20))
 expect(createObjectURL).not.toHaveBeenCalled()
})
it('downloads cloud records plus only this owner’s pending edits without queue tokens', async () => {
 const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:export')
 vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
 const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
 localStorage.setItem('afterlist_queue:a', JSON.stringify([{ item: { source: 'tmdb', externalId: 'movie:1', privateNotes: 'mine' }, removed: false, token: 'queue-secret', attempts: 0 }]))
 localStorage.setItem('afterlist_queue:b', 'broken')
 vi.stubGlobal('fetch', vi.fn(async () => Response.json({ records: { profiles: [{ user_id: 'a' }] } })))
 render(<AccountExport accessToken="session" owner="a" />)
 fireEvent.click(screen.getByRole('button', { name: 'Export account JSON' }))
 await waitFor(() => expect(click).toHaveBeenCalled())
 const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob
 const text = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob) })
 expect(JSON.parse(text).pendingEdits).toEqual([{ item: { source: 'tmdb', externalId: 'movie:1', privateNotes: 'mine' }, removed: false }])
 expect(text).not.toContain('queue-secret')
 click.mockRestore()
})
it('does not download partial data when the server cannot export account records', async () => {
 vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Export unavailable' }, { status: 503 })))
 render(<AccountExport accessToken="session" owner="a" />)
 fireEvent.click(screen.getByRole('button', { name: 'Export account JSON' }))
 await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Export unavailable'))
})
