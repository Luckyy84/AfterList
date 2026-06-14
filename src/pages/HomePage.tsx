import MediaCard from '../components/MediaCard'
import { demoItems } from '../data/demoItems'

function HomePage() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">AfterList</p>
        <h1>Your watchlist, cleaned up.</h1>
        <p className="hero-copy">Track anime, movies, and TV series in one simple place.</p>
      </section>

      <section>
        <h2 className="section-title">Your list</h2>

        <div className="media-grid">
          {demoItems.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </>
  )
}

export default HomePage
