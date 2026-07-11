import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-col brand-col">
          <h2 className="logo">AfterList</h2>
          <p>Your personal tracker for anime, movies, and TV series.</p>
          <div className="social-icons">
            <a href="https://github.com/Luckyy84/AfterList" target="_blank" rel="noreferrer" aria-label="AfterList source on GitHub">
              GitHub
            </a>
          </div>
        </div>

        <div className="footer-col">
          <h3>PAGES</h3>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/discover">Discover</Link></li>
            <li><Link to="/library">Library</Link></li>
            <li><Link to="/statistics">Statistics</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h3>RESOURCES</h3>
          <ul>
            <li><a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a></li>
            <li><a href="https://github.com/Luckyy84/AfterList" target="_blank" rel="noreferrer">GitHub</a></li>
          </ul>
        </div>

        <div className="footer-col legal-col">
          <h3>LEGAL</h3>
          <ul>
            <li><Link to="/privacy">Privacy &amp; Cookies</Link></li>
            <li><Link to="/terms">Terms of Use</Link></li>
          </ul>
          <p>AfterList uses third-party services to fetch anime, movie, and series info.</p>
          <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        </div>

        <div className="footer-col meta-col">
          <div className="copyright">
            <span>&copy; 2026 AfterList</span>
            <span className="dot">/</span>
            <span>For educational purposes only</span>
          </div>
          <div className="badge">Made by Luckyy</div>
        </div>
      </div>
    </footer>
  )
}
