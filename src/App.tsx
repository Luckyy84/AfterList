import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import HomePage from './pages/HomePage'
import AnimePage from './pages/AnimePage'
import MoviesPage from './pages/MoviesPage'
import SeriesPage from './pages/SeriesPage'
import AuthPage from './pages/AuthPage'
import AppNav from './components/layout/AppNav'
import Footer from './components/layout/Footer'
import MediaDetailsModal from './components/media/MediaDetailsModal'
import { useWatchlist } from './hooks/useWatchlist'
import './styles/index.css'

function App() {
  const { items, handleAddItem, handleRemoveItem, handleUpdateStatus } = useWatchlist()
  const [searchOpenedItemId, setSearchOpenedItemId] = useState<string | null>(null)
  const searchOpenedItem = searchOpenedItemId ? items.find((item) => item.id === searchOpenedItemId) : null

  const handleSearchDetailsRemove = (id: string) => {
    handleRemoveItem(id)
    setSearchOpenedItemId((currentId) => (currentId === id ? null : currentId))
  }

  return (
    <main className="app">
      <AppNav items={items} onCreate={handleAddItem} onOpenExisting={setSearchOpenedItemId} />

      <Routes>
        <Route path="/" element={<HomePage items={items} onRemove={handleRemoveItem} onStatusChange={handleUpdateStatus} />} />
        <Route path="/anime" element={<AnimePage items={items} onRemove={handleRemoveItem} onStatusChange={handleUpdateStatus} />} />
        <Route path="/movies" element={<MoviesPage items={items} onRemove={handleRemoveItem} onStatusChange={handleUpdateStatus} />} />
        <Route path="/series" element={<SeriesPage items={items} onRemove={handleRemoveItem} onStatusChange={handleUpdateStatus} />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
      </Routes>

      {searchOpenedItem && (
        <MediaDetailsModal
          item={searchOpenedItem}
          onClose={() => setSearchOpenedItemId(null)}
          onRemove={handleSearchDetailsRemove}
          onStatusChange={handleUpdateStatus}
        />
      )}

      <Footer />
      <Analytics />
    </main>
  )
}

export default App
