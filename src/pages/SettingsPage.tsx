import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'

function getDisplayName(email?: string, metadata?: Record<string, unknown>) {
  const name = metadata?.display_name || metadata?.full_name || metadata?.name || email?.split('@')[0]
  return typeof name === 'string' && name.trim() ? name.trim() : 'AfterList user'
}

export default function SettingsPage() {
  const { isLoading, signOut, user } = useAuth()
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const displayName = getDisplayName(user?.email, user?.user_metadata)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
      navigate('/')
    } finally {
      setIsSigningOut(false)
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
