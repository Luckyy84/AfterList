import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'
import { usePreferences, type Preferences } from '../context/PreferencesContext'

const sections = [
  { id: 'account', label: 'Account', description: 'Your sign-in and watchlist storage.' },
  { id: 'library', label: 'Library', description: 'Choose how your collection opens.' },
  { id: 'appearance', label: 'Appearance', description: 'Tune density and motion on this device.' },
  { id: 'integrations', label: 'Integrations', description: 'Manage access for Jellyfin and personal clients.' },
  { id: 'privacy', label: 'Privacy', description: 'Review data handling and legal information.' },
] as const

type SectionId = (typeof sections)[number]['id']

function getDisplayName(email?: string, metadata?: Record<string, unknown>) {
  const name = metadata?.display_name || metadata?.full_name || metadata?.name || email?.split('@')[0]
  return typeof name === 'string' && name.trim() ? name.trim() : 'AfterList user'
}

export default function SettingsPage() {
  const { section } = useParams()
  const activeSection = sections.find((item) => item.id === section)
  const { isLoading, session, signOut, user } = useAuth()
  const { preferences, resetPreferences, updatePreference } = usePreferences()
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [tokens, setTokens] = useState<Array<{ id: string; name: string; created_at: string; last_used_at: string | null; expires_at: string | null }>>([])
  const [tokenName, setTokenName] = useState('Jellyfin')
  const [newToken, setNewToken] = useState('')
  const [tokenError, setTokenError] = useState('')
  const [isTokenBusy, setIsTokenBusy] = useState(false)
  const displayName = getDisplayName(user?.email, user?.user_metadata)

  const setPreference = <Key extends keyof Preferences>(key: Key) => (event: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const value = event.currentTarget instanceof HTMLInputElement && event.currentTarget.type === 'checkbox'
      ? event.currentTarget.checked
      : event.currentTarget.value
    updatePreference(key, value as Preferences[Key])
  }

  useEffect(() => {
    if (section !== 'integrations' || !session?.access_token) return
    fetch('/api/v1/tokens', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Server returned ${response.status}.`)
        const body = await response.json() as { tokens?: typeof tokens }
        setTokens(body.tokens ?? [])
      })
      .catch(() => setTokenError('Could not load integration tokens.'))
  }, [section, session?.access_token])

  if (!activeSection) return <Navigate to="/settings/account" replace />

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

  const content: Record<SectionId, React.ReactNode> = {
    account: (
      <section className="settings-panel">
        <div className="settings-block">
          <h3>Account status</h3>
          <p>Cloud sync is optional. Guest watchlists continue to work locally.</p>
          {isLoading ? <span className="settings-value">Checking account...</span> : user ? (
            <div className="settings-account">
              <span className="settings-avatar" aria-hidden="true">{displayName[0]?.toUpperCase()}</span>
              <span><strong>{displayName}</strong><small>{user.email}</small></span>
              <button type="button" onClick={() => void handleSignOut()} disabled={isSigningOut}>{isSigningOut ? 'Signing out...' : 'Sign out'}</button>
            </div>
          ) : <Link className="settings-action" to="/login">Sign in for cloud sync</Link>}
        </div>
        <div className="settings-block settings-block-divided">
          <h3>Watchlist storage</h3>
          <dl className="settings-list">
            <div><dt>Storage</dt><dd>{user ? 'Synced to your account' : 'Saved in this browser'}</dd></div>
            <div><dt>Media information</dt><dd>Provided by TMDB</dd></div>
          </dl>
        </div>
      </section>
    ),
    library: (
      <section className="settings-panel settings-preferences">
        <div className="settings-controls">
          <label><span>Default status<small>Filter shown when Library opens</small></span><select aria-label="Default library status" value={preferences.libraryStatus} onChange={setPreference('libraryStatus')}><option>All</option><option>Planned</option><option>Watching</option><option>Watched</option><option>Dropped</option></select></label>
          <label><span>Default sorting<small>Order titles automatically</small></span><select aria-label="Default library sorting" value={preferences.librarySort} onChange={setPreference('librarySort')}><option value="recent">Recently updated</option><option value="title">Title</option><option value="rating">My rating</option></select></label>
          <label className="settings-toggle"><span>Favorites only<small>Open Library with favorites filtered</small></span><input aria-label="Favorites only by default" type="checkbox" checked={preferences.favoritesOnly} onChange={setPreference('favoritesOnly')} /></label>
        </div>
      </section>
    ),
    appearance: (
      <section className="settings-panel settings-preferences">
        <div className="settings-controls">
          <label><span>Card density<small>Controls poster size across your collection</small></span><select aria-label="Card density" value={preferences.cardDensity} onChange={setPreference('cardDensity')}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
          <label><span>Motion<small>Override your device preference</small></span><select aria-label="Motion preference" value={preferences.motion} onChange={setPreference('motion')}><option value="system">Use device setting</option><option value="full">Full motion</option><option value="reduced">Reduce motion</option></select></label>
        </div>
        <button className="settings-reset" type="button" onClick={resetPreferences}>Restore defaults</button>
      </section>
    ),
    integrations: user ? (
      <section className="settings-panel settings-integrations">
        <div className="settings-block">
          <h3>Integration tokens</h3>
          <p>Create a revocable watchlist token for Jellyfin or another personal client.</p>
        </div>
        <form className="settings-token-form" onSubmit={(event) => void createToken(event)}>
          <label htmlFor="token-name">Token name</label>
          <div><input id="token-name" value={tokenName} maxLength={80} onChange={(event) => setTokenName(event.target.value)} required /><button type="submit" disabled={isTokenBusy}>Create token</button></div>
        </form>
        {newToken && <div className="settings-new-token" role="status"><strong>Copy this token now—it is shown once.</strong><code>{newToken}</code><button type="button" onClick={() => void navigator.clipboard.writeText(newToken)}>Copy token</button></div>}
        {tokens.length > 0 && <ul className="settings-token-list">{tokens.map((token) => <li key={token.id}><span><strong>{token.name}</strong><small>{token.last_used_at ? `Last used ${new Date(token.last_used_at).toLocaleDateString()}` : 'Never used'}{token.expires_at ? ` · Expires ${new Date(token.expires_at).toLocaleDateString()}` : ' · No expiry'}</small></span><button type="button" disabled={isTokenBusy} onClick={() => void revokeToken(token.id)}>Revoke</button></li>)}</ul>}
        {tokenError && <p className="settings-token-error" role="alert">{tokenError}</p>}
      </section>
    ) : (
      <section className="settings-panel settings-empty-panel">
        <div><h3>Sign in to create integration tokens</h3><p>Tokens belong to your account and can access only your watchlist.</p></div>
        <Link className="settings-action" to="/login">Sign in for integrations</Link>
      </section>
    ),
    privacy: (
      <section className="settings-panel">
        <div className="settings-block">
          <h3>Privacy &amp; data</h3>
          <p>Review how AfterList stores account and watchlist data, including the services used to keep the app running.</p>
          <div className="settings-links"><Link to="/privacy">Privacy &amp; Cookies</Link><Link to="/terms">Terms of Use</Link></div>
        </div>
      </section>
    ),
  }

  return (
    <motion.section className="settings-page" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
      <header className="settings-header">
        <h1>Settings</h1>
        <p>Manage your account and AfterList experience.</p>
      </header>

      <div className="settings-layout">
        <aside className="settings-sidebar">
          <nav className="settings-nav" aria-label="Settings sections">
            {sections.map((item) => <NavLink key={item.id} to={`/settings/${item.id}`}>{item.label}</NavLink>)}
          </nav>
        </aside>

        <div className="settings-content">
          <header className="settings-section-header">
            <h2>{activeSection.label}</h2>
            <p>{activeSection.description}</p>
          </header>
          {content[activeSection.id]}
        </div>
      </div>
    </motion.section>
  )
}
