import MediaCard from '../components/MediaCard'
import { demoItems } from '../data/demoItems'

function SeriesPage() {
  const seriesItems = demoItems.filter((item) => item.type === 'TV Series')

  return (
    <section>
      <h1>TV Series</h1>

      <div className="media-grid">
        {seriesItems.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

export default SeriesPage
