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
  return <motion.span className="active-nav-background" initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
}

function getDisplayName(user: User | null) {
  if (!user) return 'Account'
  const metadata = user.user_metadata ?? {}
  const name = metadata.display_name || metadata.full_name || metadata.name || user.email?.split('@')[0]
  return typeof name === 'string' && name.trim() ? name.trim() : 'Account'
}

function Icon({ name }: { name: 'account' | 'settings' | 'menu' | 'close' | 'home' | 'discover' | 'library' | 'statistics' | 'signout' }) {
  const paths = {
    account: <><circle cx="12" cy="8" r="3.25" /><path d="M6.5 19c.55-3.35 2.38-5 5.5-5s4.95 1.65 5.5 5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.08-1l2-1.55-2-3.45-2.46 1A7 7 0 0 0 14.7 6L14.35 3h-4.7L9.3 6A7 7 0 0 0 7.54 7L5.08 6l-2 3.45 2 1.55a7 7 0 0 0 0 2l-2 1.55 2 3.45 2.46-1a7 7 0 0 0 1.76 1l.35 3h4.7l.35-3a7 7 0 0 0 1.76-1l2.46 1 2-3.45-2-1.55c.05-.33.08-.66.08-1Z" /></>,
    menu: <path d="M5 8h14M5 16h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    home: <path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4Z" />,
    discover: <><circle cx="12" cy="12" r="8" /><path d="m15 9-2 4-4 2 2-4Z" /></>,
    library: <path d="M5 4h4v16H5zM11 4h4v16h-4zM17 5l3-1 3 14-3 1z" />,
    statistics: <path d="M5 20v-7h4v7M10 20V8h4v12M15 20V4h4v16" />,
    signout: <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

export default function AppNav({ items, onCreate, onOpenExisting }: AppNavProps) {
  const { isLoading, signOut, user } = useAuth()
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isNavOpen, setIsNavOpen] = useState(false)
  const navRef = useRef<HTMLElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)
  const displayName = getDisplayName(user)

  useEffect(() => {
    if (!isAccountOpen) return undefined
    const handlePointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setIsAccountOpen(false)
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

  useEffect(() => {
    if (!isNavOpen) return undefined
    const previousOverflow = document.body.style.overflow
    const drawer = navRef.current?.querySelector<HTMLElement>('.nav-mobile-drawer')
    const focusable = drawer?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    document.body.style.overflow = 'hidden'
    first?.focus()

    const handlePointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setIsNavOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNavOpen(false)
        menuButtonRef.current?.focus()
      }
      if (event.key !== 'Tab' || !first || !last) return
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isNavOpen])

  const closeNav = () => setIsNavOpen(false)
  const openAccount = () => { setIsNavOpen(false); setIsAccountOpen(true) }
  const handleSignOut = async () => {
    setIsAccountOpen(false)
    setIsNavOpen(false)
    await signOut()
  }

  return (
    <nav className="nav" aria-label="Primary navigation" ref={navRef}>
      <div className="nav-main">
        <NavLink className="brand" to="/" end><img src="/favicon-32.png" alt="" />AfterList</NavLink>
        <div className="nav-links">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {({ isActive }) => <><span>{item.label}</span>{isActive && <ActiveNavBackground />}</>}
            </NavLink>
          ))}
        </div>
        <SearchAddModal items={items} onCreate={onCreate} onOpenExisting={onOpenExisting} />
        <button ref={menuButtonRef} className="nav-menu-button" type="button" aria-label={isNavOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={isNavOpen} aria-controls="mobile-navigation" onClick={() => setIsNavOpen((isOpen) => !isOpen)}>
          <Icon name={isNavOpen ? 'close' : 'menu'} />
        </button>
      </div>

      <div className="nav-tools" ref={accountMenuRef}>
        {user ? (
          <button className="nav-icon-button" type="button" aria-label={`Open account menu for ${displayName}`} aria-expanded={isAccountOpen} onClick={() => setIsAccountOpen((isOpen) => !isOpen)}><Icon name="account" /></button>
        ) : (
          <NavLink className="nav-icon-button" to="/login" aria-label={isLoading ? 'Account' : 'Sign in'}><Icon name="account" /></NavLink>
        )}
        <NavLink className="nav-icon-button" to="/settings" aria-label="Settings"><Icon name="settings" /></NavLink>

        {isAccountOpen && (
          <div className="nav-account-dropdown glass-panel" role="menu">
            <div className="nav-account-details"><span>{displayName}</span>{user?.email && <small>{user.email}</small>}</div>
            {!user && <Link role="menuitem" to="/login" onClick={() => setIsAccountOpen(false)}>Sign in for cloud sync</Link>}
            <Link role="menuitem" to="/privacy" onClick={() => setIsAccountOpen(false)}>Privacy &amp; Cookies</Link>
            <Link role="menuitem" to="/terms" onClick={() => setIsAccountOpen(false)}>Terms of Use</Link>
            {user && <button className="nav-auth-action" type="button" role="menuitem" onClick={() => void handleSignOut()}>Sign out</button>}
          </div>
        )}
      </div>

      {isNavOpen && (
        <div className="nav-mobile-drawer" id="mobile-navigation" role="dialog" aria-label="Navigation menu" aria-modal="true">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={closeNav}>
              <Icon name={item.label.toLowerCase() as 'home' | 'discover' | 'library' | 'statistics'} /><span>{item.label}</span><span className="nav-current-mark" aria-hidden="true">✓</span>
            </NavLink>
          ))}
          <span className="nav-mobile-divider" aria-hidden="true" />
          {user
            ? <button type="button" onClick={openAccount}><Icon name="account" /><span>Profile</span><small>{displayName}<br />Signed in</small></button>
            : <Link to="/login" onClick={closeNav}><Icon name="account" /><span>Sign in</span></Link>}
          <Link to="/settings" onClick={closeNav}><Icon name="settings" /><span>Settings</span></Link>
          {user && <button type="button" onClick={() => void handleSignOut()}><Icon name="signout" /><span>Sign out</span></button>}
        </div>
      )}
    </nav>
  )
}
