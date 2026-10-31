import { beforeEach, expect, it, vi } from 'vitest'
const s = vi.hoisted(() => ({ user: { id: 'owner' } as { id: string } | null, upload: vi.fn(), remove: vi.fn(), update: vi.fn(), rpc: vi.fn() }))
vi.mock('../_lib/afterlistApi.js', () => ({ authenticateUser: async () => s.user, adminClient: () => ({ storage: { from: () => ({ upload: s.upload, remove: s.remove, getPublicUrl: (name: string) => ({ data: { publicUrl: `https://storage.test/${name}` } }) }) }, rpc: s.rpc, from: () => ({ update: s.update }) }), json: (body: unknown, status = 200) => Response.json(body, { status }) }))
import { POST, DELETE } from './avatar'
import sharp from 'sharp'
beforeEach(() => { s.user = { id: 'owner' }; s.upload.mockReset().mockResolvedValue({ error: null }); s.remove.mockReset().mockResolvedValue({ error: null }); s.rpc.mockReset().mockResolvedValue({ data: [], error: null }); s.update.mockReset().mockImplementation(() => ({ eq: (_key: string, id: string) => ({ select: () => ({ single: async () => ({ data: { user_id: id }, error: null }) }) }) })) })
const request = (bytes: Uint8Array, type = 'image/png') => new Request('https://app.test/api/account/avatar', { method: 'POST', headers: { 'content-type': type }, body: bytes as BodyInit })
it('requires authentication before processing images or removal', async () => { s.user = null; expect((await POST(request(new Uint8Array()))).status).toBe(401); expect((await DELETE(new Request('https://app.test'))).status).toBe(401); expect(s.upload).not.toHaveBeenCalled() })
it('decodes and strips metadata, generates owner object names and updates only that profile', async () => {
  const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'red' } }).png().withMetadata().toBuffer()
  const response = await POST(request(bytes)); expect(response.status).toBe(200)
  const [name, output, options] = s.upload.mock.calls[0]; expect(name).toMatch(/^owner\/[a-f0-9-]+\.webp$/); expect(options).toMatchObject({ contentType: 'image/webp', upsert: false }); const metadata = await sharp(output).metadata(); expect(metadata.format).toBe('webp'); expect(metadata.exif).toBeUndefined(); expect(metadata.icc).toBeUndefined()
  expect(s.update).toHaveBeenCalledWith(expect.objectContaining({ avatar_url: expect.stringContaining('/owner/') }))
})

it('rejects HTML, SVG, MIME spoofing, corrupt images, oversized bytes and dimensions', async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer()
  const huge = await sharp({ create: { width: 4097, height: 1, channels: 3, background: 'red' } }).png().toBuffer()
  for (const [bytes, type] of [[Buffer.from('<svg/>'), 'image/svg+xml'], [Buffer.from('<html/>'), 'image/png'], [png, 'image/jpeg'], [Buffer.from('broken'), 'image/png'], [Buffer.alloc(2 * 1024 * 1024 + 1), 'image/png'], [huge, 'image/png']] as const) {
    expect((await POST(request(bytes, type))).status).toBe(400)
  }
  expect(s.upload).not.toHaveBeenCalled()
})
it('removes only authenticated owner objects and clears profile', async () => {
  s.rpc.mockResolvedValueOnce({ data: [{ bucket_id: 'avatars', name: 'owner/old.webp' }], error: null })
  expect((await DELETE(new Request('https://app.test', { method: 'DELETE', body: JSON.stringify({ userId: 'victim' }) }))).status).toBe(204)
  expect(s.rpc).toHaveBeenCalledWith('owned_storage_objects', { p_user_id: 'owner', p_avatars_only: true })
  expect(s.remove).toHaveBeenCalledWith(['owner/old.webp'])
  expect(s.update).toHaveBeenCalledWith({ avatar_url: null })
})
it('fails closed on storage inventory or removal errors', async () => {
  s.rpc.mockResolvedValue({ data: null, error: new Error('missing migration') })
  expect((await DELETE(new Request('https://app.test'))).status).toBe(503)
  expect(s.update).not.toHaveBeenCalled()
})

it('fails with deployment guidance when bucket upload is unavailable', async () => {
  const bytes = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } }).png().toBuffer()
  s.upload.mockResolvedValue({ error: new Error('bucket missing') })
  const response = await POST(request(bytes))
  expect(response.status).toBe(503); expect((await response.json()).error).toMatch(/safe_avatars migration/)
  expect(s.update).not.toHaveBeenCalled()
})
it('removes a new derivative if the owner profile update fails', async () => {
  const bytes = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } }).png().toBuffer()
  s.update.mockImplementation(() => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error('profile missing') }) }) }) }))
  expect((await POST(request(bytes))).status).toBe(503)
  expect(s.remove).toHaveBeenCalledWith([s.upload.mock.calls[0][0]])
})
it('fails removal closed and does not clear the profile on byte deletion failure', async () => {
  s.rpc.mockResolvedValueOnce({ data: [{ bucket_id: 'avatars', name: 'owner/old.webp' }], error: null })
  s.remove.mockResolvedValue({ error: new Error('storage failure') })
  expect((await DELETE(new Request('https://app.test'))).status).toBe(503)
  expect(s.update).not.toHaveBeenCalled()
})
