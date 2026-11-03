import { useEffect, useRef, useState } from 'react'
import { clearOwnerQueue } from '../services/watchlistQueue'

export default function AccountDeletion({ owner, accessToken, onDeleted }: { owner: string; accessToken: string; onDeleted: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => { pending.current?.abort() }, [owner, accessToken])
  return <form className="settings-block settings-block-divided" onSubmit={(event) => {
    event.preventDefault()
    setBusy(true); setError('')
    // Do not cancel server deletion: only suppress callbacks into a new account.
    const controller = new AbortController()
    pending.current = controller
    void (async () => {
      const response = await fetch('/api/account/delete', { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation, password }) })
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'Could not delete account.') }
      setPassword('')
      clearOwnerQueue(owner)
      if (!controller.signal.aborted) await onDeleted()
    })().catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not delete account.') }).finally(() => setBusy(false))
  }}>
    <h3>Delete account permanently</h3>
    <p>This deletes your cloud watchlist, profile, lists, history and integration tokens. Export your library first. Browser guest data is not deleted. Google-only accounts must first set a password using account recovery.</p>
    <label>Type DELETE to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" disabled={busy} /></label>
    <label>Current password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /></label>
    <button type="submit" disabled={busy || confirmation !== 'DELETE' || !password}>Delete my account permanently</button>
    {error && <p role="alert">{error}</p>}
  </form>
}
