import { Link } from 'react-router-dom'
import ThemeToggle from '../components/ui/ThemeToggle'
import { useAuth } from '../context/AuthContext'

export default function SettingsPage() {
  const { signOut, user } = useAuth()

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Preferences</p>
        <h1>Settings</h1>
        <p>Adjust how AfterList looks and manage your account.</p>
      </header>

      <div className="settings-list">
        <section className="settings-card">
          <div><h2>Appearance</h2><p>Switch between dark and light mode.</p></div>
          <ThemeToggle />
        </section>
        <section className="settings-card">
          <div><h2>Account</h2><p>{user?.email ?? 'Sign in to sync your watchlist across devices.'}</p></div>
          {user
            ? <button className="secondary" type="button" onClick={() => void signOut()}>Sign out</button>
            : <Link className="secondary" to="/login">Sign in</Link>}
        </section>
      </div>
    </>
  )
}
