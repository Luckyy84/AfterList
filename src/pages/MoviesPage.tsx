import MediaCard from '../components/MediaCard'
import { demoItems } from '../data/demoItems'

function MoviesPage() {
  const movieItems = demoItems.filter((item) => item.type === 'Movie')

  return (
    <section>
      <h1>Movies</h1>

      <div className="media-grid">
        {movieItems.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

export default MoviesPage
