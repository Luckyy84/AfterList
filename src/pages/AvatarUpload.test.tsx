import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ session: { access_token: 'session-token' } }) }))
import AvatarUpload from './AvatarUpload'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('uploads the raw file with session auth and displays the server URL only after success', async () => {
  const changed = vi.fn()
  const fetcher = vi.fn().mockResolvedValue(Response.json({ avatarUrl: 'https://test/owner/new.webp' }))
  vi.stubGlobal('fetch', fetcher)
  render(<AvatarUpload avatarUrl="" onChanged={changed} />)
  const file = new File(['png'], 'avatar.png', { type: 'image/png' })
  await userEvent.upload(screen.getByLabelText('Upload avatar'), file)
  expect(fetcher).toHaveBeenCalledWith('/api/account/avatar', expect.objectContaining({ method: 'POST', body: file, headers: expect.objectContaining({ Authorization: 'Bearer session-token' }) }))
  expect(changed).toHaveBeenCalledWith('https://test/owner/new.webp')
})
it('retains displayed avatar and exposes failed removal', async () => {
  const changed = vi.fn(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Storage unavailable' }, { status: 503 })))
  render(<AvatarUpload avatarUrl="https://test/old.webp" onChanged={changed} />)
  await userEvent.click(screen.getByRole('button', { name: 'Remove avatar' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Storage unavailable')
  expect(changed).not.toHaveBeenCalled()
})
