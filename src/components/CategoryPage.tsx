import type { CSSProperties } from 'react'
import { useState } from 'react'
import MediaCard from '../components/MediaCard'
import MediaDetailsModal from '../components/MediaDetailsModal'
import type { MediaItem, MediaType } from '../types/media'
type CategoryPageProps = {
  title: string
  subtitle: string
  type: MediaType
  items: MediaItem[]
  onRemove: (id: string) => void
}
function CategoryPage({ title, subtitle, type, items, onRemove }: CategoryPageProps) {
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)

  // Filter the globally-provided items dynamically by type
  const filteredItems = items.filter((item) => item.type === type)
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
      {/* Call the onRemove prop (defined in App.tsx) and close the modal on delete */}
      {selectedItem && (
        <MediaDetailsModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onRemove={(id) => {
            onRemove(id)
            setSelectedItem(null)
          }}
        />
      )}
    </>
  )
}
export default CategoryPage