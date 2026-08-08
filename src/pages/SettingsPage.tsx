import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'
import { usePreferences, type Preferences } from '../context/PreferencesContext'
import type { MediaItem } from '../types/media'
import { createCustomList, deleteCustomList, fetchCustomLists, type CustomList } from '../services/mediaLibrary'
import type { OwnProfile } from '../types/profile'
import { claimUsername, saveOwnProfile, setCustomListPublic } from '../services/profiles'

const sections = [
  { id: 'account', label: 'Account', description: 'Your sign-in and watchlist storage.' },
  { id: 'profile', label: 'Profile', description: 'Choose what other people can see.' },
  { id: 'library', label: 'Library', description: 'Choose how your collection opens.' },
  { id: 'appearance', label: 'Appearance', description: 'Tune density and motion on this device.' },
  { id: 'integrations', label: 'Integrations', description: 'Manage access for Jellyfin and personal clients.' },
  { id: 'privacy', label: 'Privacy', description: 'Review data handling and legal information.' },
] as const

type SectionId = (typeof sections)[number]['id']

export function ProfileSettings({ userId, profile, onSaved }: { userId: string; profile: OwnProfile | null; onSaved?: () => void | Promise<void> }) {
  const [username, setUsername] = useState(profile?.username ?? ''); const [displayName, setDisplayName] = useState(profile?.display_name ?? ''); const [bio, setBio] = useState(profile?.bio ?? ''); const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? ''); const [website, setWebsite] = useState(profile?.external_links?.[0]?.url ?? ''); const [isPublic, setIsPublic] = useState(profile?.is_public ?? false); const [showLibrary, setShowLibrary] = useState(profile?.show_library ?? false); const [showFavorites, setShowFavorites] = useState(profile?.show_favorites ?? false); const [showStats, setShowStats] = useState(profile?.show_stats ?? false); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false)
  return <form className="settings-panel settings-preferences" onSubmit={(event) => { event.preventDefault(); setBusy(true); setMessage(''); void (async () => { const clean = username.trim().toLowerCase(); if (!/^[a-z0-9_]{3,30}$/.test(clean)) throw new Error('Username must be 3–30 letters, numbers, or underscores.'); if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) throw new Error('Avatar must use an http or https URL.'); if (website && !/^https?:\/\//i.test(website)) throw new Error('Website must use an http or https URL.'); if (clean !== profile?.username) await claimUsername(clean); await saveOwnProfile({ user_id: userId, username: clean, display_name: displayName.trim(), bio: bio.trim(), avatar_url: avatarUrl || null, external_links: website ? [{ label: 'Website', url: website }] : [], is_public: isPublic, show_library: showLibrary, show_favorites: showFavorites, show_stats: showStats }); await onSaved?.(); setMessage('Profile saved.') })().catch((cause) => setMessage(cause instanceof Error ? cause.message : 'Could not save profile.')).finally(() => setBusy(false)) }}><div className="settings-controls"><label><span>Username</span><input aria-label="Username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label><span>Display name</span><input aria-label="Display name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label><span>Bio</span><textarea aria-label="Bio" maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} /></label><label><span>Avatar URL</span><input aria-label="Avatar URL" type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} /></label><label><span>Website</span><input aria-label="Website" type="url" value={website} onChange={(event) => setWebsite(event.target.value)} /></label><label className="settings-toggle"><span>Public profile</span><input aria-label="Public profile" type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /></label><label className="settings-toggle"><span>Show library</span><input aria-label="Show library" type="checkbox" checked={showLibrary} disabled={!isPublic} onChange={(event) => setShowLibrary(event.target.checked)} /></label><label className="settings-toggle"><span>Show favorites</span><input aria-label="Show favorites" type="checkbox" checked={showFavorites} disabled={!isPublic} onChange={(event) => setShowFavorites(event.target.checked)} /></label><label className="settings-toggle"><span>Show statistics</span><input aria-label="Show statistics" type="checkbox" checked={showStats} disabled={!isPublic} onChange={(event) => setShowStats(event.target.checked)} /></label></div><button className="settings-action" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save profile'}</button>{message && <p role="status">{message}</p>}</form>
}

function getDisplayName(email?: string, metadata?: Record<string, unknown>) {
  const name = metadata?.display_name || metadata?.full_name || metadata?.name || email?.split('@')[0]
  return typeof name === 'string' && name.trim() ? name.trim() : 'AfterList user'
}

export default function SettingsPage({ items = [], ownProfile = null, onProfileSaved }: { items?: MediaItem[]; ownProfile?: OwnProfile | null; onProfileSaved?: () => void | Promise<void> }) {
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
  const [customLists, setCustomLists] = useState<CustomList[]>([])
  const [listName, setListName] = useState('')
  const [listError, setListError] = useState('')
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

  useEffect(() => {
    if (section !== 'library' || !user) return
    fetchCustomLists(user.id).then(setCustomLists).catch(() => setListError('Could not load custom lists.'))
  }, [section, user])

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
    profile: user ? <ProfileSettings key={ownProfile?.username ?? 'new'} userId={user.id} profile={ownProfile} onSaved={onProfileSaved} /> : <section className="settings-panel settings-empty-panel"><p>Sign in to create a public profile.</p><Link to="/login">Sign in</Link></section>,
    library: (
      <section className="settings-panel settings-preferences">
        <div className="settings-controls">
          <label><span>Default status<small>Filter shown when Library opens</small></span><select aria-label="Default library status" value={preferences.libraryStatus} onChange={setPreference('libraryStatus')}><option>All</option><option>Planned</option><option>Watching</option><option>Paused</option><option>Watched</option><option>Dropped</option></select></label>
          <label><span>Default sorting<small>Order titles automatically</small></span><select aria-label="Default library sorting" value={preferences.librarySort} onChange={setPreference('librarySort')}><option value="recent">Recently updated</option><option value="title">Title</option><option value="rating">My rating</option></select></label>
          <label className="settings-toggle"><span>Favorites only<small>Open Library with favorites filtered</small></span><input aria-label="Favorites only by default" type="checkbox" checked={preferences.favoritesOnly} onChange={setPreference('favoritesOnly')} /></label>
        </div>
        <div className="settings-block settings-block-divided">
          <h3>Custom lists</h3>
          {user ? <><form onSubmit={(event) => { event.preventDefault(); setListError(''); void createCustomList(user.id, listName).then((list) => { setCustomLists((current) => [...current, list]); setListName('') }).catch((cause) => setListError(cause instanceof Error ? cause.message : 'Could not create list.')) }}><label><span>List name</span><input aria-label="Custom list name" maxLength={80} required value={listName} onChange={(event) => setListName(event.target.value)} /></label><button className="settings-action" type="submit">Create list</button></form><ul className="settings-token-list">{customLists.map((list) => <li key={list.id}><span><strong>{list.name}</strong><small>/{list.slug}</small></span><label><input aria-label={`Make ${list.name} public`} type="checkbox" checked={list.is_public} onChange={(event) => { const isPublic = event.target.checked; setCustomLists((current) => current.map((item) => item.id === list.id ? { ...item, is_public: isPublic } : item)); void setCustomListPublic(list.id, user.id, isPublic).catch(() => setListError('Could not update list privacy.')) }} />Public</label><button type="button" onClick={() => void deleteCustomList(list.id, user.id).then(() => setCustomLists((current) => current.filter((item) => item.id !== list.id))).catch(() => setListError('Could not delete list.'))}>Delete</button></li>)}</ul></> : <p>Sign in to create custom lists.</p>}
          {listError && <p role="alert" className="settings-token-error">{listError}</p>}
        </div>
        <div className="settings-block settings-block-divided">
          <h3>Export library</h3>
          <p>Download a JSON backup including your tracking history and private notes.</p>
          <button className="settings-action" type="button" onClick={() => {
            const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, items }, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `afterlist-export-${new Date().toISOString().slice(0, 10)}.json`
            link.click()
            URL.revokeObjectURL(url)
          }}>Export JSON</button>
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
