import type { CSSProperties } from 'react'
import { useState } from 'react'
import MediaCard from '../components/MediaCard'
import MediaDetailsModal from '../components/MediaDetailsModal'
import { demoItems } from '../data/demoItems'
import type { MediaItem, MediaType } from '../types/media'

type CategoryPageProps = {
  title: string
  subtitle: string
  type: MediaType
}

function CategoryPage({ title, subtitle, type }: CategoryPageProps) {
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const filteredItems = demoItems.filter((item) => item.type === type)
  const hero = filteredItems[0]

  return (
    <>
      <section
        className="hero-card category-hero"
        style={{ '--hero-image': `url(${hero?.backdrop ?? ''})` } as CSSProperties}
      >
        <div className="hero-content">
          <p className="eyebrow">AfterList category</p>
          <h1>{title}</h1>
          <p className="hero-description">{subtitle}</p>
        </div>
      </section>

      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">Library</p>
            <h2>{title} list</h2>
          </div>
        </div>

        <div className="media-grid">
          {filteredItems.map((item) => (
            <MediaCard key={item.id} item={item} onSelect={setSelectedItem} />
          ))}
        </div>
      </section>

      {selectedItem && (
        <MediaDetailsModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </>
  )
}

export default CategoryPage
