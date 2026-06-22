import { NavLink } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <h2 className="logo">AfterList</h2>
        <p>A personal tracker for anime, movies, and TV series.</p>
      </div>

      <nav className="footer-links" aria-label="Footer navigation">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/anime">Anime</NavLink>
        <NavLink to="/movies">Movies</NavLink>
        <NavLink to="/series">TV Series</NavLink>
      </nav>

      <div className="footer-meta">
        <span>&copy; 2026 AfterList</span>
        <span aria-hidden="true">/</span>
        <a href="https://github.com/Luckyy84/AfterList" target="_blank" rel="noreferrer">
          Built by Luckyy
        </a>
      </div>
    </footer>
  )
}
