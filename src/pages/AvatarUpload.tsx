import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AvatarUpload({ avatarUrl, onChanged }: { avatarUrl: string; onChanged: (url: string) => void }) {
  const { session } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function change(file?: File) {
    if (!session) { setError('Sign in to change your avatar.'); return }
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/account/avatar', { method: file ? 'POST' : 'DELETE', headers: { Authorization: `Bearer ${session.access_token}`, ...(file ? { 'Content-Type': file.type } : {}) }, body: file })
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'Could not change avatar.') }
      onChanged(file ? (await response.json()).avatarUrl : '')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change avatar.') }
    finally { setBusy(false) }
  }
  return <div aria-busy={busy}>
    {avatarUrl && <img src={avatarUrl} alt="Current avatar" width="64" height="64" />}
    <label>Upload avatar<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void change(file) }} /></label>
    <small>PNG, JPEG or WebP; up to 2 MiB and 4096 × 4096 pixels. Uploaded avatars are public. Original files and metadata are not retained.</small>
    <button type="button" disabled={busy || !avatarUrl} onClick={() => void change()}>Remove avatar</button>
    {error && <p role="alert">{error}</p>}
  </div>
}
