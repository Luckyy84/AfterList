import { Link, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AnimePage from './pages/AnimePage'
import MoviesPage from './pages/MoviesPage'
import SeriesPage from './pages/SeriesPage'
import './App.css'

function App() {
  return (
    <main className="app">
      <nav className="nav">
        <Link to="/">AfterList</Link>
        <Link to="/anime">Anime</Link>
        <Link to="/movies">Movies</Link>
        <Link to="/series">TV Series</Link>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/anime" element={<AnimePage />} />
        <Route path="/movies" element={<MoviesPage />} />
        <Route path="/series" element={<SeriesPage />} />
      </Routes>
    </main>
  )
}

export default App
