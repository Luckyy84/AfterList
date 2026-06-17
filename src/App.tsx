import { NavLink, Route, Routes } from 'react-router-dom'
import { motion } from 'motion/react'
import HomePage from './pages/HomePage'
import AnimePage from './pages/AnimePage'
import MoviesPage from './pages/MoviesPage'
import SeriesPage from './pages/SeriesPage'
import './App.css'
import './glassy-fixes.css'
import './hover-polish.css'
import './background-polish.css'
import Footer from './components/Footer'
import { useWatchlist } from './hooks/useWatchlist'
function App() {
  const { items, handleRemoveItem } = useWatchlist()
  return (
    <main className="app">
      <nav className="nav">
        <NavLink className="brand" to="/" end>
          AfterList
        </NavLink>
        <div className="nav-links">
          {/* Link 1: All */}
          <NavLink to="/" end style={{ position: 'relative' }}>
            {({ isActive }) => (
              <>
                <span style={{ position: 'relative', zIndex: 2 }}>All</span>
                {isActive && (
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
                )}
              </>
            )}
          </NavLink>
          {/* Link 2: Anime */}
          <NavLink to="/anime" style={{ position: 'relative' }}>
            {({ isActive }) => (
              <>
                <span style={{ position: 'relative', zIndex: 2 }}>Anime</span>
                {isActive && (
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
                )}
              </>
            )}
          </NavLink>
          {/* Link 3: Movies */}
          <NavLink to="/movies" style={{ position: 'relative' }}>
            {({ isActive }) => (
              <>
                <span style={{ position: 'relative', zIndex: 2 }}>Movies</span>
                {isActive && (
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
                )}
              </>
            )}
          </NavLink>
          {/* Link 4: TV Series */}
          <NavLink to="/series" style={{ position: 'relative' }}>
            {({ isActive }) => (
              <>
                <span style={{ position: 'relative', zIndex: 2 }}>TV Series</span>
                {isActive && (
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
                )}
              </>
            )}
          </NavLink>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage items={items} onRemove={handleRemoveItem} />} />
        <Route path="/anime" element={<AnimePage items={items} onRemove={handleRemoveItem} />} />
        <Route path="/movies" element={<MoviesPage items={items} onRemove={handleRemoveItem} />} />
        <Route path="/series" element={<SeriesPage items={items} onRemove={handleRemoveItem} />} />
      </Routes>
      <Footer />
    </main>
  )
}
export default App
