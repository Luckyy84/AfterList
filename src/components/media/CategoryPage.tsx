import type { CSSProperties } from 'react'
import { useState } from 'react'
import { motion } from 'motion/react'
import MediaCard from './MediaCard'
import MediaDetailsModal from './MediaDetailsModal'
import type { MediaItem, MediaStatus, MediaType } from '../../types/media'

type CategoryPageProps = {
  title: string
  subtitle: string
  type: MediaType
  items: MediaItem[]
  onRemove: (id: string) => void
  onStatusChange: (id: string, status: MediaStatus) => void
}

function CategoryPage({ title, subtitle, type, items, onRemove, onStatusChange }: CategoryPageProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const filteredItems = items.filter((item) => item.type === type)
  const hero = filteredItems[0]
  const selectedItem = selectedItemId ? filteredItems.find((item) => item.id === selectedItemId) ?? null : null

  const handleStatusChange = (id: string, status: MediaStatus) => {
    onStatusChange(id, status)
  }

  return (
    <>
      <motion.section
        className="hero-card category-hero glass-panel"
        style={{ '--hero-image': `url(${hero?.backdrop ?? ''})` } as CSSProperties}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="hero-content">
          <p className="eyebrow">AfterList category</p>
          <h1>{title}</h1>
          <p className="hero-description">{subtitle}</p>
        </div>
      </motion.section>

      <section className="library-section">
        <div className="section-head library-head">
          <div>
            <p className="eyebrow">Library</p>
            <h2>{title} list</h2>
          </div>
          <p className="section-copy">{filteredItems.length} saved {title.toLowerCase()} in your current list.</p>
        </div>

        <motion.div layout className="media-grid">
          {filteredItems.map((item) => (
            <MediaCard key={item.id} item={item} onSelect={(selected) => setSelectedItemId(selected.id)} />
          ))}
        </motion.div>
      </section>

      {selectedItem && (
        <MediaDetailsModal
          item={selectedItem}
          onClose={() => setSelectedItemId(null)}
          onRemove={(id) => {
            onRemove(id)
            setSelectedItemId(null)
          }}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  )
}

export default CategoryPage
