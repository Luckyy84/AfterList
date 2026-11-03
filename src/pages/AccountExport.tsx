import { useEffect, useRef, useState } from 'react'
import { readQueue } from '../services/watchlistQueue'

export default function AccountExport({ accessToken, owner }: { accessToken: string; owner: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => { pending.current?.abort() }, [owner, accessToken])
  return <div className="settings-block settings-block-divided">
    <h3>Export account data</h3>
    <p>Includes cloud records, private notes, tracking history, profile, lists, integration metadata and this account’s pending browser edits. Does not include passwords or access tokens. Uploaded image files and provider logs are not included.</p>
    <button className="settings-action" type="button" disabled={busy} onClick={() => {
      setBusy(true); setError('')
      const controller = new AbortController()
      pending.current = controller
      void (async () => {
        const response = await fetch('/api/account/export', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store', signal: controller.signal })
        const body = await response.json()
        if (controller.signal.aborted) return
        if (!response.ok) throw new Error(body.error || 'Could not export account.')
        const pendingEdits = readQueue(owner).map(({ item, removed }) => ({ item, removed }))
        const blob = new Blob([JSON.stringify({ ...body, pendingEdits }, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        try {
          const link = document.createElement('a')
          link.href = url; link.download = `afterlist-account-${new Date().toISOString().slice(0, 10)}.json`; link.click()
        } finally { URL.revokeObjectURL(url) }
      })().catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not export account.') }).finally(() => setBusy(false))
    }}>Export account JSON</button>
    {error && <p role="alert">{error}</p>}
  </div>
}
