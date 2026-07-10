import type { CSSProperties } from 'react'
import { useState } from 'react'
import { motion } from 'motion/react'
import MediaCard from './MediaCard'
import MediaDetailsModal from './MediaDetailsModal'
import type { MediaItem, MediaType, MediaUpdate } from '../../types/media'

type CategoryPageProps = {
  title: string
  subtitle: string
  type: MediaType
  items: MediaItem[]
  onRemove: (id: string) => void
  onUpdate: (id: string, updates: MediaUpdate) => void
}

function CategoryPage({ title, subtitle, type, items, onRemove, onUpdate }: CategoryPageProps) {
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const filteredItems = items.filter((item) => item.type === type)
  const hero = filteredItems[0]

  const handleUpdate = (id: string, updates: MediaUpdate) => {
    onUpdate(id, updates)
    setSelectedItem((current) => (current && current.id === id ? { ...current, ...updates } : current))
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
            <MediaCard key={item.id} item={item} onSelect={setSelectedItem} />
          ))}
        </motion.div>

        {filteredItems.length === 0 && (
          <div className="empty-state">
            <h3>No {title.toLowerCase()} saved yet</h3>
            <p>Use search in the navigation to add a title, then track it here.</p>
          </div>
        )}
      </section>

      {selectedItem && (
        <MediaDetailsModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onRemove={(id) => {
            onRemove(id)
            setSelectedItem(null)
          }}
          onUpdate={handleUpdate}
        />
      )}
    </>
  )
}

export default CategoryPage
