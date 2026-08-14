import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { MotionConfig, motion } from 'motion/react'
import AppNav from './components/layout/AppNav'
import RouteMetadata from './components/seo/RouteMetadata'
import { useWatchlist } from './hooks/useWatchlist'
import './styles/index.css'
import { pageMotion, softSpring } from './motion'
import { useAuth } from './context/AuthContext'
import { usePreferences } from './context/PreferencesContext'
import { getMediaPath } from './utils/mediaRoutes'
import { findMatchingMediaItem, findProbableMediaDuplicate } from './utils/media'
import { confirmMediaMatch, rejectMediaMatch } from './services/mediaLibrary'
import { useOwnProfile } from './hooks/useOwnProfile'

const HomePage = lazy(() => import('./pages/HomePage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const LegalPage = lazy(() => import('./pages/LegalPage'))
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'))
const LibraryPage = lazy(() => import('./pages/LibraryPage'))
const StatisticsPage = lazy(() => import('./pages/StatisticsPage'))
const MediaDetailsPage = lazy(() => import('./pages/MediaDetailsPage'))
const LegacyMediaDetailsRoute = lazy(() => import('./pages/LegacyMediaDetailsRoute'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const Analytics = lazy(() => import('@vercel/analytics/react').then((module) => ({ default: module.Analytics })))
const Footer = lazy(() => import('./components/layout/Footer'))

function RouteLoadingState() {
  return (
    <section className="route-loading-state" role="status" aria-live="polite" aria-busy="true">
      <span className="route-loading-mark" aria-hidden="true" />
      <span>Loading page…</span>
    </section>
  )
}

function DeferredAnalytics() {
  const [isReady, setIsReady] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), 0)
    return () => window.clearTimeout(timer)
  }, [])
  return isReady ? <Suspense fallback={null}><Analytics /></Suspense> : null
}

function DeferredFooter() {
  const [isReady, setIsReady] = useState(() => typeof window === 'undefined' || !('IntersectionObserver' in window))
  const placeholderRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (isReady) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsReady(true)
        observer.disconnect()
      }
    }, { rootMargin: '300px' })
    if (placeholderRef.current) observer.observe(placeholderRef.current)
    return () => observer.disconnect()
  }, [isReady])
  return <div ref={placeholderRef} className="deferred-footer-shell">{isReady ? <Suspense fallback={null}><Footer /></Suspense> : null}</div>
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isLoading: isAuthLoading, user } = useAuth()
  const { preferences } = usePreferences()
  const { profile: ownProfile, refresh: refreshProfile } = useOwnProfile()
  const { items, handleAddItem, handleRemoveItem, handleUpdateItem, isSyncing, retrySync, syncError } = useWatchlist()
  const [possibleDuplicate, setPossibleDuplicate] = useState<{ item: typeof items[number]; existing: typeof items[number] } | null>(null)
  const [duplicateBusy, setDuplicateBusy] = useState(false)
  const [duplicateError, setDuplicateError] = useState('')

  const openSavedItem = (id: string) => {
    const item = items.find((candidate) => candidate.id === id)
    if (item) navigate(getMediaPath(item), { state: { item, from: `${location.pathname}${location.search}` } })
  }

  const requestCreate = (item: typeof items[number]) => {
    const exact = findMatchingMediaItem(items, item)
    if (exact) {
      navigate(getMediaPath(exact), { state: { item: exact, from: `${location.pathname}${location.search}` } })
      return
    }
    const existing = findProbableMediaDuplicate(items, item)
    if (existing) {
      setDuplicateError('')
      setPossibleDuplicate({ item, existing })
      return
    }
    void handleAddItem(item)
  }

  const decideDuplicate = async (decision: 'confirm' | 'reject') => {
    if (!possibleDuplicate) return
    setDuplicateBusy(true); setDuplicateError('')
    try {
      if (user) {
        if (decision === 'confirm') await confirmMediaMatch(possibleDuplicate.existing, possibleDuplicate.item)
        else await rejectMediaMatch(possibleDuplicate.existing, possibleDuplicate.item)
      }
      const { existing, item } = possibleDuplicate
      setPossibleDuplicate(null)
      if (decision === 'confirm') navigate(getMediaPath(existing), { state: { item: existing, from: `${location.pathname}${location.search}` } })
      else await handleAddItem(item)
      retrySync()
    } catch (cause) { setDuplicateError(cause instanceof Error ? cause.message : 'Could not save this decision.') }
    finally { setDuplicateBusy(false) }
  }

  return (
    <MotionConfig reducedMotion={preferences.motion === 'system' ? 'user' : preferences.motion === 'reduced' ? 'always' : 'never'} transition={softSpring}>
    <div className={`app density-${preferences.cardDensity}`} data-motion={preferences.motion}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <RouteMetadata />
      <AppNav items={items} onCreate={requestCreate} onOpenExisting={openSavedItem} profileUsername={ownProfile?.username} profileIsPublic={ownProfile?.is_public} />

      {(syncError || isSyncing) && (
        <div className={`sync-banner${syncError ? ' is-error' : ''}`} role={syncError ? 'alert' : 'status'}>
          <span>{syncError ?? 'Syncing your watchlist…'}</span>
          {syncError && <button type="button" onClick={retrySync}>Retry sync</button>}
        </div>
      )}

      <main id="main-content" className="app-content">
        <motion.div key={location.pathname} {...pageMotion} transition={softSpring}>
        <Suspense fallback={<RouteLoadingState />}>
        <Routes location={location}>
          <Route path="/" element={<HomePage items={items} onCreate={requestCreate} isLoading={isAuthLoading || (isSyncing && items.length === 0)} isSignedIn={Boolean(user)} />} />
          <Route path="/discover" element={<DiscoverPage items={items} onCreate={requestCreate} />} />
          <Route path="/library" element={<LibraryPage items={items} />} />
          <Route path="/statistics" element={<StatisticsPage items={items} onUpdate={handleUpdateItem} userId={user?.id} />} />
          <Route path="/settings" element={<Navigate to="/settings/account" replace />} />
          <Route path="/settings/:section" element={<SettingsPage items={items} ownProfile={ownProfile} onProfileSaved={refreshProfile} />} />
          <Route path="/settings/*" element={<Navigate to="/settings/account" replace />} />
          <Route path="/movie/:id/:slug" element={<MediaDetailsPage routeKind="movie" items={items} onCreate={requestCreate} onRemove={handleRemoveItem} onUpdate={handleUpdateItem} />} />
          <Route path="/movie/:id" element={<MediaDetailsPage routeKind="movie" items={items} onCreate={requestCreate} onRemove={handleRemoveItem} onUpdate={handleUpdateItem} />} />
          <Route path="/tv/:id/:slug" element={<MediaDetailsPage routeKind="tv" items={items} onCreate={requestCreate} onRemove={handleRemoveItem} onUpdate={handleUpdateItem} />} />
          <Route path="/tv/:id" element={<MediaDetailsPage routeKind="tv" items={items} onCreate={requestCreate} onRemove={handleRemoveItem} onUpdate={handleUpdateItem} />} />
          <Route path="/anime/:id/:slug" element={<MediaDetailsPage routeKind="anime" items={items} onCreate={requestCreate} onRemove={handleRemoveItem} onUpdate={handleUpdateItem} />} />
          <Route path="/anime/:id" element={<MediaDetailsPage routeKind="anime" items={items} onCreate={requestCreate} onRemove={handleRemoveItem} onUpdate={handleUpdateItem} />} />
          <Route path="/details/:source/:externalId" element={<LegacyMediaDetailsRoute />} />
          <Route path="/anime" element={<LibraryPage initialType="Anime" items={items} />} />
          <Route path="/movies" element={<LibraryPage initialType="Movie" items={items} />} />
          <Route path="/series" element={<LibraryPage initialType="TV Series" items={items} />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/user/:username" element={<PublicProfilePage mode="overview" />} />
          <Route path="/user/:username/library" element={<PublicProfilePage mode="library" />} />
          <Route path="/user/:username/lists/:listSlug" element={<PublicProfilePage mode="list" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
        </motion.div>
      </main>

      <DeferredFooter />
      {possibleDuplicate && (
        <div className="duplicate-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPossibleDuplicate(null) }}>
          <section className="duplicate-dialog glass-panel" role="dialog" aria-modal="true" aria-labelledby="duplicate-title">
            <p className="eyebrow">Possible duplicate</p>
            <h2 id="duplicate-title">Is this the same title?</h2>
            <p><strong>{possibleDuplicate.item.title}</strong> ({possibleDuplicate.item.year}) looks like <strong>{possibleDuplicate.existing.title}</strong> already in your library.</p>
            {duplicateError && <p role="alert" className="details-api-error">{duplicateError}</p>}
            <div className="duplicate-actions">
              <button type="button" className="primary-action" autoFocus disabled={duplicateBusy} onClick={() => void decideDuplicate('confirm')}>Open existing</button>
              <button type="button" className="secondary-action" disabled={duplicateBusy} onClick={() => void decideDuplicate('reject')}>Keep separate</button>
              <button type="button" className="duplicate-cancel" disabled={duplicateBusy} onClick={() => setPossibleDuplicate(null)}>Cancel</button>
            </div>
          </section>
        </div>
      )}
      <DeferredAnalytics />
    </div>
    </MotionConfig>
  )
}

export default App
