import { useLocation } from 'react-router-dom'
import PageMetadata from './PageMetadata'
import type { PageMetadataConfig } from './metadata'

const HOME_DESCRIPTION = 'Build a personal watchlist for anime, movies, and TV series, then track what you plan to watch, are watching, and have finished.'

function staticMetadata(pathname: string): PageMetadataConfig | null {
  if (/^\/(?:movie|tv|anime)\/\d+(?:\/[^/]+)?\/?$/.test(pathname) || pathname.startsWith('/user/')) return null

  if (pathname.startsWith('/details/')) return {
    title: 'Updating saved link | AfterList',
    description: 'AfterList is updating this saved media link.',
    canonicalPath: pathname,
    index: false,
  }

  if (pathname === '/') return { title: 'AfterList — Anime, Movie & TV Watchlist', description: HOME_DESCRIPTION, canonicalPath: '/', index: true }
  if (pathname === '/discover') return { title: 'Discover Anime, Movies & TV | AfterList', description: 'Explore trending and recommended anime, movies, and TV series, then add titles to your AfterList watchlist.', canonicalPath: '/discover', index: true }
  if (pathname === '/privacy') return { title: 'Privacy Policy | AfterList', description: 'Learn how AfterList stores guest and account watchlists, uses service providers, and protects your privacy.', canonicalPath: '/privacy', index: true }
  if (pathname === '/terms') return { title: 'Terms of Use | AfterList', description: 'Read the terms that apply when using AfterList to track anime, movies, and TV series.', canonicalPath: '/terms', index: true }
  if (pathname === '/login') return { title: 'Sign in | AfterList', description: 'Sign in to sync your AfterList watchlist across devices.', canonicalPath: '/login', index: false }
  if (pathname === '/signup') return { title: 'Create account | AfterList', description: 'Create an AfterList account to back up and sync your watchlist.', canonicalPath: '/signup', index: false }
  if (pathname === '/reset-password') return { title: 'Reset password | AfterList', description: 'Choose a new password for your AfterList account.', canonicalPath: '/reset-password', index: false }
  if (pathname === '/library' || pathname === '/anime' || pathname === '/movies' || pathname === '/series') return { title: 'Your Library | AfterList', description: 'View and organize your personal AfterList watchlist.', canonicalPath: pathname, index: false }
  if (pathname === '/statistics') return { title: 'Your Statistics | AfterList', description: 'Review private statistics for your AfterList watchlist.', canonicalPath: '/statistics', index: false }
  if (pathname === '/settings' || pathname.startsWith('/settings/')) {
    const section = pathname.split('/')[2]
    const label = section ? `${section[0].toUpperCase()}${section.slice(1)} settings` : 'Settings'
    return { title: `${label} | AfterList`, description: 'Manage your private AfterList account and app preferences.', canonicalPath: pathname, index: false }
  }
  return null
}

export default function RouteMetadata() {
  const { pathname } = useLocation()
  return <PageMetadata config={staticMetadata(pathname)} />
}
