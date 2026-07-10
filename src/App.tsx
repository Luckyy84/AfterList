import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import HomePage from './pages/HomePage'
import AuthPage from './pages/AuthPage'
import LegalPage from './pages/LegalPage'
import DiscoverPage from './pages/DiscoverPage'
import LibraryPage from './pages/LibraryPage'
import StatisticsPage from './pages/StatisticsPage'
import AppNav from './components/layout/AppNav'
import Footer from './components/layout/Footer'
import MediaDetailsModal from './components/media/MediaDetailsModal'
import { useWatchlist } from './hooks/useWatchlist'
import './styles/index.css'

function App() {
  const { items, handleAddItem, handleRemoveItem, handleUpdateItem, isSyncing, retrySync, syncError } = useWatchlist()
  const [searchOpenedItemId, setSearchOpenedItemId] = useState<string | null>(null)
  const searchOpenedItem = searchOpenedItemId ? items.find((item) => item.id === searchOpenedItemId) : null

  const handleSearchDetailsRemove = (id: string) => {
    handleRemoveItem(id)
    setSearchOpenedItemId((currentId) => (currentId === id ? null : currentId))
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <AppNav items={items} onCreate={handleAddItem} onOpenExisting={setSearchOpenedItemId} />

      {(syncError || isSyncing) && (
        <div className={`sync-banner${syncError ? ' is-error' : ''}`} role={syncError ? 'alert' : 'status'}>
          <span>{syncError ?? 'Syncing your watchlist…'}</span>
          {syncError && <button type="button" onClick={retrySync}>Retry sync</button>}
        </div>
      )}

      <main id="main-content" className="app-content">
        <Routes>
          <Route path="/" element={<HomePage items={items} onCreate={handleAddItem} onRemove={handleRemoveItem} onUpdate={handleUpdateItem} />} />
          <Route path="/discover" element={<DiscoverPage items={items} onCreate={handleAddItem} onRemove={handleRemoveItem} onUpdate={handleUpdateItem} />} />
          <Route path="/library" element={<LibraryPage items={items} onRemove={handleRemoveItem} onUpdate={handleUpdateItem} />} />
          <Route path="/statistics" element={<StatisticsPage items={items} />} />
          <Route path="/anime" element={<LibraryPage initialType="Anime" items={items} onRemove={handleRemoveItem} onUpdate={handleUpdateItem} />} />
          <Route path="/movies" element={<LibraryPage initialType="Movie" items={items} onRemove={handleRemoveItem} onUpdate={handleUpdateItem} />} />
          <Route path="/series" element={<LibraryPage initialType="TV Series" items={items} onRemove={handleRemoveItem} onUpdate={handleUpdateItem} />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
        </Routes>
      </main>

      {searchOpenedItem && (
        <MediaDetailsModal
          item={searchOpenedItem}
          onClose={() => setSearchOpenedItemId(null)}
          onRemove={handleSearchDetailsRemove}
          onUpdate={handleUpdateItem}
        />
      )}

      <Footer />
      <Analytics />
    </div>
  )
}

export default App
