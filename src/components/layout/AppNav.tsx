import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import SearchAddModal from '../search/SearchAddModal'
import type { MediaItem } from '../../types/media'
import { useAuth } from '../../context/AuthContext'
import type { User } from '@supabase/supabase-js'

type AppNavProps = {
  items: MediaItem[]
  onCreate: (item: MediaItem) => void
  onOpenExisting: (id: string) => void
}

const navItems = [
  { label: 'Home', to: '/', end: true },
  { label: 'Discover', to: '/discover' },
  { label: 'Library', to: '/library' },
  { label: 'Statistics', to: '/statistics' },
]

function ActiveNavBackground() {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#ffffff',
        borderRadius: '999px',
        zIndex: 1,
      }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    />
  )
}

function getDisplayName(user: User | null) {
  if (!user) return 'Account'

  const metadata = user.user_metadata ?? {}
  const name = metadata.display_name || metadata.full_name || metadata.name || user.email?.split('@')[0]

  return typeof name === 'string' && name.trim() ? name.trim() : 'Account'
}

function AccountIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.25" /><path d="M6.5 19c.55-3.35 2.38-5 5.5-5s4.95 1.65 5.5 5" /></svg>
}

function SettingsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.08-1l2-1.55-2-3.45-2.46 1A7 7 0 0 0 14.7 6L14.35 3h-4.7L9.3 6A7 7 0 0 0 7.54 7L5.08 6l-2 3.45 2 1.55a7 7 0 0 0 0 2l-2 1.55 2 3.45 2.46-1a7 7 0 0 0 1.76 1l.35 3h4.7l.35-3a7 7 0 0 0 1.76-1l2.46 1 2-3.45-2-1.55c.05-.33.08-.66.08-1Z" /></svg>
}

export default function AppNav({ items, onCreate, onOpenExisting }: AppNavProps) {
  const { isLoading, signOut, user } = useAuth()
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)
  const displayName = getDisplayName(user)

  useEffect(() => {
    if (!isAccountOpen) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAccountOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAccountOpen])

  const handleSignOut = async () => {
    setIsAccountOpen(false)
    await signOut()
  }

  return (
    <nav className="nav" aria-label="Primary navigation">
      <div className="nav-main">
        <NavLink className="brand" to="/" end>
          <img src="/favicon-32.png" alt="" />
          AfterList
        </NavLink>

        <div className="nav-links">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} style={{ position: 'relative' }}>
              {({ isActive }) => (
                <>
                  <span style={{ position: 'relative', zIndex: 2 }}>{item.label}</span>
                  {isActive && <ActiveNavBackground />}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <SearchAddModal items={items} onCreate={onCreate} onOpenExisting={onOpenExisting} />
      </div>

      <div className="nav-tools" ref={accountMenuRef}>
        {user ? (
          <button className="nav-icon-button" type="button" aria-label={`Open account menu for ${displayName}`} aria-expanded={isAccountOpen} onClick={() => setIsAccountOpen((isOpen) => !isOpen)}>
            <AccountIcon />
          </button>
        ) : (
          <NavLink className="nav-icon-button" to="/login" aria-label={isLoading ? 'Account' : 'Sign in'}>
            <AccountIcon />
          </NavLink>
        )}
        <button className="nav-icon-button" type="button" aria-label="Open preferences" aria-expanded={isAccountOpen} onClick={() => setIsAccountOpen((isOpen) => !isOpen)}>
          <SettingsIcon />
        </button>

        {isAccountOpen && (
          <div className="nav-account-dropdown glass-panel" role="menu">
            <div className="nav-account-details">
              <span>{displayName}</span>
              {user?.email && <small>{user.email}</small>}
            </div>
            {!user && <Link role="menuitem" to="/login" onClick={() => setIsAccountOpen(false)}>Sign in for cloud sync</Link>}
            <Link role="menuitem" to="/privacy" onClick={() => setIsAccountOpen(false)}>Privacy</Link>
            <Link role="menuitem" to="/terms" onClick={() => setIsAccountOpen(false)}>Terms</Link>
            {user && <button className="nav-auth-action" type="button" role="menuitem" onClick={() => void handleSignOut()}>Sign out</button>}
          </div>
        )}
      </div>
    </nav>
  )
}
