import MediaCard from '../components/MediaCard'
import { demoItems } from '../data/demoItems'
import type { MediaType } from '../types/media'

type CategoryPageProps = {
  title: string
  subtitle: string
  type: MediaType
}

function CategoryPage({ title, subtitle, type }: CategoryPageProps) {
  const filteredItems = demoItems.filter((item) => item.type === type)

  return (
    <>
      <section className="hero">
        <p className="eyebrow">AfterList</p>
        <h1>{title}</h1>
        <p className="hero-copy">{subtitle}</p>
      </section>

      <section>
        <div className="media-grid">
          {filteredItems.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </>
  )
}

export default CategoryPage
