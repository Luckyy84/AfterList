import MediaCard from '../components/MediaCard'
import { demoItems } from '../data/demoItems'

function AnimePage() {
  const animeItems = demoItems.filter((item) => item.type === 'Anime')

  return (
    <section>
      <h1>Anime</h1>

      <div className="media-grid">
        {animeItems.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

export default AnimePage
 