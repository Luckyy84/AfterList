import { Link } from 'react-router-dom'
import ThemeToggle from '../components/ui/ThemeToggle'
import CustomSelect from '../components/ui/CustomSelect'
import { useAuth } from '../context/AuthContext'
import { loadDefaultStatus, saveDefaultStatus } from '../services/preferences'
import type { MediaItem, MediaStatus } from '../types/media'
import { useState } from 'react'

const statusOptions = ['Planned', 'Watching', 'Watched', 'Dropped'] as const

type SettingsPageProps = {
  items: MediaItem[]
  reducedMotion: boolean
  onReducedMotionChange: (reduced: boolean) => void
}

export default function SettingsPage({ items, onReducedMotionChange, reducedMotion }: SettingsPageProps) {
  const { signOut, user } = useAuth()
  const [defaultStatus, setDefaultStatus] = useState(loadDefaultStatus)

  const changeDefaultStatus = (value: string) => {
    const status = value as MediaStatus
    setDefaultStatus(status)
    saveDefaultStatus(status)
  }

  const exportWatchlist = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items }, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `afterlist-watchlist-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Preferences</p>
        <h1>Settings</h1>
        <p>Adjust how AfterList looks and manage your account.</p>
      </header>

      <div className="settings-list">
        <section className="settings-card settings-card-stacked">
          <div><h2>Appearance</h2><p>Choose your theme and animation preference.</p></div>
          <div className="settings-controls">
            <div className="settings-control"><span>Theme</span><ThemeToggle /></div>
            <label className="settings-control"><span>Reduce motion</span><input type="checkbox" checked={reducedMotion} onChange={(event) => onReducedMotionChange(event.target.checked)} /></label>
          </div>
        </section>
        <section className="settings-card">
          <div><h2>New titles</h2><p>Choose the status selected when you add something.</p></div>
          <CustomSelect ariaLabel="Default status for new titles" value={defaultStatus} options={statusOptions.map((status) => ({ value: status, label: status }))} onChange={changeDefaultStatus} />
        </section>
        <section className="settings-card">
          <div><h2>Watchlist data</h2><p>Download a portable JSON backup of {items.length} {items.length === 1 ? 'title' : 'titles'}.</p></div>
          <button className="secondary" type="button" onClick={exportWatchlist}>Export JSON</button>
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
