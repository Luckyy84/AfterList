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
      layoutId="activeNavBg"
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
              className="nav-user-pill"
              type="button"
              aria-expanded={isAccountOpen}
              aria-haspopup="menu"
              onClick={() => setIsAccountOpen((isOpen) => !isOpen)}
            >
              <span>{displayName}</span>
              <span className="nav-user-chevron" aria-hidden="true">v</span>
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
          <NavLink to="/login" style={{ position: 'relative' }}>
            {({ isActive }) => (
              <>
                <span style={{ position: 'relative', zIndex: 2 }}>{isLoading ? 'Account' : 'Sign in'}</span>
                {isActive && <ActiveNavBackground />}
              </>
            )}
          </NavLink>
        )}
      </div>

      <SearchAddModal items={items} onCreate={onCreate} onOpenExisting={onOpenExisting} />
    </nav>
  )
}
