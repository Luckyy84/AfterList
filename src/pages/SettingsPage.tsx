import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'

function getDisplayName(email?: string, metadata?: Record<string, unknown>) {
  const name = metadata?.display_name || metadata?.full_name || metadata?.name || email?.split('@')[0]
  return typeof name === 'string' && name.trim() ? name.trim() : 'AfterList user'
}

export default function SettingsPage() {
  const { isLoading, session, signOut, user } = useAuth()
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [tokens, setTokens] = useState<Array<{ id: string; name: string; created_at: string; last_used_at: string | null }>>([])
  const [tokenName, setTokenName] = useState('Jellyfin')
  const [newToken, setNewToken] = useState('')
  const [tokenError, setTokenError] = useState('')
  const [isTokenBusy, setIsTokenBusy] = useState(false)
  const displayName = getDisplayName(user?.email, user?.user_metadata)

  useEffect(() => {
    if (!session?.access_token) return
    fetch('/api/v1/tokens', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Server returned ${response.status}.`)
        const body = await response.json() as { tokens?: typeof tokens }
        setTokens(body.tokens ?? [])
      })
      .catch(() => setTokenError('Could not load integration tokens.'))
  }, [session?.access_token])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
      navigate('/')
    } finally {
      setIsSigningOut(false)
    }
  }

  const createToken = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!session?.access_token) return
    setIsTokenBusy(true)
    setTokenError('')
    try {
      const response = await fetch('/api/v1/tokens', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tokenName }),
      })
      if (!response.ok) throw new Error(`Server returned ${response.status}. Check the API deployment and server variables.`)
      const body = await response.json() as { token?: string; integration?: (typeof tokens)[number] }
      if (!body.token || !body.integration) throw new Error('The API returned an invalid response.')
      setNewToken(body.token)
      setTokens((current) => [body.integration!, ...current])
    } catch (error) {
      setTokenError(error instanceof Error ? error.message : 'Could not create integration token.')
    } finally {
      setIsTokenBusy(false)
    }
  }

  const revokeToken = async (id: string) => {
    if (!session?.access_token) return
    setIsTokenBusy(true)
    setTokenError('')
    try {
      const response = await fetch(`/api/v1/tokens?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!response.ok) throw new Error('Could not revoke integration token.')
      setTokens((current) => current.filter((token) => token.id !== id))
    } catch (error) {
      setTokenError(error instanceof Error ? error.message : 'Could not revoke integration token.')
    } finally {
      setIsTokenBusy(false)
    }
  }

  return (
    <motion.section className="settings-page" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
      <header className="settings-header">
        <h1>Settings</h1>
        <p>Manage your account, storage, and AfterList experience.</p>
      </header>

      <div className="settings-grid">
        <section className="settings-panel">
          <div><h2>Account</h2><p>Cloud sync is optional. Guest watchlists continue to work locally.</p></div>
          {isLoading ? <span className="settings-value">Checking account...</span> : user ? (
            <div className="settings-account">
              <span className="settings-avatar" aria-hidden="true">{displayName[0]?.toUpperCase()}</span>
              <span><strong>{displayName}</strong><small>{user.email}</small></span>
              <button type="button" onClick={() => void handleSignOut()} disabled={isSigningOut}>{isSigningOut ? 'Signing out...' : 'Sign out'}</button>
            </div>
          ) : <Link className="settings-action" to="/login">Sign in for cloud sync</Link>}
        </section>

        {user && <section className="settings-panel settings-integrations">
          <div><h2>Integrations</h2><p>Create a revocable watchlist token for Jellyfin or another personal client.</p></div>
          <form className="settings-token-form" onSubmit={(event) => void createToken(event)}>
            <label htmlFor="token-name">Token name</label>
            <div><input id="token-name" value={tokenName} maxLength={80} onChange={(event) => setTokenName(event.target.value)} required /><button type="submit" disabled={isTokenBusy}>Create</button></div>
          </form>
          {newToken && <div className="settings-new-token" role="status"><strong>Copy this token now—it is shown once.</strong><code>{newToken}</code><button type="button" onClick={() => void navigator.clipboard.writeText(newToken)}>Copy token</button></div>}
          {tokens.length > 0 && <ul className="settings-token-list">{tokens.map((token) => <li key={token.id}><span><strong>{token.name}</strong><small>{token.last_used_at ? `Last used ${new Date(token.last_used_at).toLocaleDateString()}` : 'Never used'}</small></span><button type="button" disabled={isTokenBusy} onClick={() => void revokeToken(token.id)}>Revoke</button></li>)}</ul>}
          {tokenError && <p className="settings-token-error" role="alert">{tokenError}</p>}
        </section>}

        <section className="settings-panel">
          <div><h2>Watchlist storage</h2><p>Your saved titles stay available without changing how you use the app.</p></div>
          <dl className="settings-list">
            <div><dt>Storage</dt><dd>{user ? 'Synced to your account' : 'Saved in this browser'}</dd></div>
            <div><dt>Media information</dt><dd>Provided by TMDB</dd></div>
          </dl>
        </section>

        <section className="settings-panel">
          <div><h2>Experience</h2><p>AfterList follows your device preferences automatically.</p></div>
          <dl className="settings-list">
            <div><dt>Theme</dt><dd>Cinematic dark</dd></div>
            <div><dt>Motion</dt><dd>Follows reduced-motion settings</dd></div>
          </dl>
        </section>

        <section className="settings-panel">
          <div><h2>Privacy &amp; legal</h2><p>Review how AfterList stores data and the terms for using the project.</p></div>
          <div className="settings-links"><Link to="/privacy">Privacy &amp; Cookies</Link><Link to="/terms">Terms of Use</Link></div>
        </section>
      </div>
    </motion.section>
  )
}
