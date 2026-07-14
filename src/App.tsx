import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { MotionConfig, motion } from 'motion/react'
import { Analytics } from '@vercel/analytics/react'
import HomePage from './pages/HomePage'
import AuthPage from './pages/AuthPage'
import LegalPage from './pages/LegalPage'
import DiscoverPage from './pages/DiscoverPage'
import LibraryPage from './pages/LibraryPage'
import StatisticsPage from './pages/StatisticsPage'
import SettingsPage from './pages/SettingsPage'
import MediaDetailsPage from './pages/MediaDetailsPage'
import AppNav from './components/layout/AppNav'
import Footer from './components/layout/Footer'
import { useWatchlist } from './hooks/useWatchlist'
import './styles/index.css'
import { pageMotion, softSpring } from './motion'

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const { items, handleAddItem, handleRemoveItem, handleUpdateItem, isSyncing, retrySync, syncError } = useWatchlist()

  const openSavedItem = (id: string) => {
    const item = items.find((candidate) => candidate.id === id)
    if (item) navigate(`/details/${item.source}/${encodeURIComponent(item.externalId ?? item.id)}`, { state: { item } })
  }

  return (
    <MotionConfig reducedMotion="user" transition={softSpring}>
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <AppNav items={items} onCreate={handleAddItem} onOpenExisting={openSavedItem} />

      {(syncError || isSyncing) && (
        <div className={`sync-banner${syncError ? ' is-error' : ''}`} role={syncError ? 'alert' : 'status'}>
          <span>{syncError ?? 'Syncing your watchlist…'}</span>
          {syncError && <button type="button" onClick={retrySync}>Retry sync</button>}
        </div>
      )}

      <main id="main-content" className="app-content">
        <motion.div key={location.pathname} {...pageMotion} transition={softSpring}>
        <Routes location={location}>
          <Route path="/" element={<HomePage items={items} onCreate={handleAddItem} />} />
          <Route path="/discover" element={<DiscoverPage items={items} onCreate={handleAddItem} />} />
          <Route path="/library" element={<LibraryPage items={items} />} />
          <Route path="/statistics" element={<StatisticsPage items={items} />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/details/:source/:externalId" element={<MediaDetailsPage items={items} onCreate={handleAddItem} onRemove={handleRemoveItem} onUpdate={handleUpdateItem} />} />
          <Route path="/anime" element={<LibraryPage initialType="Anime" items={items} />} />
          <Route path="/movies" element={<LibraryPage initialType="Movie" items={items} />} />
          <Route path="/series" element={<LibraryPage initialType="TV Series" items={items} />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
        </Routes>
        </motion.div>
      </main>

      <Footer />
      <Analytics />
    </div>
    </MotionConfig>
  )
}

export default App
