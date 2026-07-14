import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
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
        backgroundColor: 'var(--nav-active)',
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

        {user ? (
          <div className="nav-auth-menu" ref={accountMenuRef}>
            <button
              className="nav-icon-button"
              type="button"
              aria-label="Open account menu"
              aria-expanded={isAccountOpen}
              aria-haspopup="menu"
              title="Account"
              onClick={() => setIsAccountOpen((isOpen) => !isOpen)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" />
              </svg>
            </button>

            {isAccountOpen && (
              <div className="nav-account-dropdown glass-panel" role="menu">
                <div className="nav-account-details">
                  <span>{displayName}</span>
                  {user.email && <small>{user.email}</small>}
                </div>

                <button className="nav-auth-action" type="button" role="menuitem" onClick={() => void handleSignOut()}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <NavLink className="nav-icon-button" to="/login" aria-label={isLoading ? 'Account' : 'Sign in'} title={isLoading ? 'Account' : 'Sign in'}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" />
            </svg>
          </NavLink>
        )}

        <NavLink className="nav-icon-button" to="/settings" aria-label="Settings" title="Settings">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1.4 1.6H9.4A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 13.6V9.4A1.7 1.7 0 0 0 4.6 8a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10.4 3h4.2A1.7 1.7 0 0 0 16 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.6 1.4v4.2a1.7 1.7 0 0 0-1.6 1.4Z" />
          </svg>
        </NavLink>
      </div>

      <SearchAddModal items={items} onCreate={onCreate} onOpenExisting={onOpenExisting} />
    </nav>
  )
}
