export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        
        <div className="footer-col brand-col">
          <h2 className="logo">AfterList</h2>
          <p>Your Personal tracker for anime, movies, and series</p>
          <div className="social-icons">
            <a href="https://github.com/Luckyy84/AfterList" target="_blank" rel="noreferrer">🐙</a>
          </div>
        </div>

        <div className="footer-col">
          <h3>PAGES</h3>
          <ul>
            <li><a href="/">Homepage</a></li>
            <li><a href="/anime">Anime</a></li>
            <li><a href="/movies">Movies</a></li>
            <li><a href="/series">Tv Series</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h3>RESOURCES</h3>
          <ul>
            <li><a href="#">Placeholder 1</a></li>
            <li><a href="#">Placeholder 2</a></li>
            <li><a href="#">Placeholder 3</a></li>
          </ul>
        </div>

        <div className="footer-col legal-col">
          <h3>LEGAL</h3>
          <p>AfterList uses third-party services to fetch anime, movie, and series info.</p>
        </div>

        <div className="footer-col meta-col">
          <div className="copyright">
            <span>&copy; 2026 AfterList</span>
            <span className="dot">•</span>
            <span>For educational purposes only</span>
          </div>
          <div className="badge">
            ❤️ Made with passion by Luckyy
          </div>
        </div>

      </div>
    </footer>
  );
}