import type { CSSProperties } from 'react'
import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import MediaCard from './MediaCard'
import MediaDetailsModal from './MediaDetailsModal'
import type { MediaItem, MediaStatus, MediaType } from '../../types/media'
import { controlSpring, panelSpring, reducedTransition } from '../../utils/motion'

type CategoryPageProps = {
  title: string
  subtitle: string
  type: MediaType
  items: MediaItem[]
  onRemove: (id: string) => void
  onStatusChange: (id: string, status: MediaStatus) => void
}

type StatusFilter = 'All' | MediaStatus

const statusFilters: StatusFilter[] = ['All', 'Watching', 'Planned', 'Watched', 'Dropped']

function CategoryPage({ title, subtitle, type, items, onRemove, onStatusChange }: CategoryPageProps) {
  const shouldReduceMotion = useReducedMotion()
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const categoryItems = items.filter((item) => item.type === type)
  const filteredItems = categoryItems.filter((item) => statusFilter === 'All' || item.status === statusFilter)
  const hero = categoryItems[0]

  const handleStatusChange = (id: string, status: MediaStatus) => {
    onStatusChange(id, status)
    setSelectedItem((current) => (current?.id === id ? { ...current, status } : current))
  }

  return (
    <>
      <motion.section
        className="hero-card category-hero glass-panel"
        style={{ '--hero-image': `url(${hero?.backdrop ?? ''})` } as CSSProperties}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={shouldReduceMotion ? reducedTransition : panelSpring}
      >
        <div className="hero-content">
          <p className="eyebrow">AfterList collection</p>
          <h1>{title}</h1>
          <p className="hero-description">{subtitle}</p>
          <div className="category-count">
            <strong>{categoryItems.length}</strong>
            <span>{categoryItems.length === 1 ? 'saved title' : 'saved titles'}</span>
          </div>
        </div>
      </motion.section>

      <section className="library-section category-library">
        <div className="section-head library-head">
          <div>
            <p className="eyebrow">Browse</p>
            <h2>{title} library</h2>
          </div>
          <div className="filter-chips" aria-label={`Filter ${title} by status`}>
            {statusFilters.map((filter) => (
              <motion.button
                key={filter}
                type="button"
                className={statusFilter === filter ? 'is-active' : ''}
                aria-pressed={statusFilter === filter}
                onClick={() => setStatusFilter(filter)}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                transition={controlSpring}
              >
                {filter}
              </motion.button>
            ))}
          </div>
        </div>

        {filteredItems.length > 0 ? (
          <motion.div layout className="media-grid">
            {filteredItems.map((item) => (
              <MediaCard key={item.id} item={item} onSelect={setSelectedItem} />
            ))}
          </motion.div>
        ) : (
          <div className="category-empty glass-panel">
            <p className="eyebrow">Nothing here yet</p>
            <h3>{statusFilter === 'All' ? `Your ${title.toLowerCase()} list is empty.` : `No ${statusFilter.toLowerCase()} titles.`}</h3>
            <p>Use search in the navigation to add something new.</p>
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
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  )
}

export default CategoryPage
