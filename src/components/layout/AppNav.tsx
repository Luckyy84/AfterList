import { NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import SearchAddModal from '../search/SearchAddModal'
import type { MediaItem } from '../../types/media'
import { useAuth } from '../../context/AuthContext'

type AppNavProps = {
  items: MediaItem[]
  onCreate: (item: MediaItem) => void
  onOpenExisting: (id: string) => void
}

const navItems = [
  { label: 'Home', to: '/', end: true },
  { label: 'Anime', to: '/anime' },
  { label: 'Movies', to: '/movies' },
  { label: 'TV Series', to: '/series' },
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

function getDisplayName(email?: string) {
  if (!email) return 'Account'
  return email.split('@')[0]
}

export default function AppNav({ items, onCreate, onOpenExisting }: AppNavProps) {
  const { isLoading, signOut, user } = useAuth()

  return (
    <nav className="nav">
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
          <div className="nav-auth-menu" aria-label="Signed-in account">
            <span className="nav-user-pill">{getDisplayName(user.email)}</span>
            <button className="nav-auth-action" type="button" onClick={() => void signOut()}>
              Sign out
            </button>
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
