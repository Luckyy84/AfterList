import { useState } from 'react'

export default function AccountDeletion({ accessToken, onDeleted }: { accessToken: string; onDeleted: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <form className="settings-block settings-block-divided" onSubmit={(event) => {
    event.preventDefault()
    setBusy(true); setError('')
    void (async () => {
      const response = await fetch('/api/account/delete', { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation, password }) })
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'Could not delete account.') }
      setPassword('')
      await onDeleted()
    })().catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not delete account.')).finally(() => setBusy(false))
  }}>
    <h3>Delete account permanently</h3>
    <p>This deletes your cloud watchlist, profile, lists, history and integration tokens. Export your library first. Browser guest data is not deleted. Google-only accounts must first set a password using account recovery.</p>
    <label>Type DELETE to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" disabled={busy} /></label>
    <label>Current password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /></label>
    <button type="submit" disabled={busy || confirmation !== 'DELETE' || !password}>Delete my account permanently</button>
    {error && <p role="alert">{error}</p>}
  </form>
}
