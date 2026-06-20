import type { CSSProperties } from 'react'
import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
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

const statusFilters = ['All', 'Planned', 'Watching', 'Watched', 'Dropped'] as const
type StatusFilter = (typeof statusFilters)[number]

function CategoryPage({ title, subtitle, type, items, onRemove, onStatusChange }: CategoryPageProps) {
  const shouldReduceMotion = useReducedMotion()
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const categoryItems = items.filter((item) => item.type === type)
  const visibleItems = statusFilter === 'All' ? categoryItems : categoryItems.filter((item) => item.status === statusFilter)
  const hero = categoryItems[0]
  const selectedItem = selectedItemId ? categoryItems.find((item) => item.id === selectedItemId) ?? null : null

  const handleStatusChange = (id: string, status: MediaStatus) => {
    onStatusChange(id, status)
  }

  return (
    <>
      <motion.section
        className="hero-card category-hero glass-panel"
        style={{ '--hero-image': `url(${hero?.backdrop ?? ''})` } as CSSProperties}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
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
          <p className="section-copy">{categoryItems.length} saved {title.toLowerCase()} in your current list.</p>
        </div>

        <div className="status-filter-bar" aria-label={`Filter ${title} by status`}>
          {statusFilters.map((status) => (
            <button
              key={status}
              className={`status-filter-chip${statusFilter === status ? ' is-active' : ''}`}
              type="button"
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
            >
              {status}
              <span aria-hidden="true">
                {status === 'All' ? categoryItems.length : categoryItems.filter((item) => item.status === status).length}
              </span>
            </button>
          ))}
        </div>

        {visibleItems.length > 0 ? (
          <motion.div layout={!shouldReduceMotion} className="media-grid">
            {visibleItems.map((item) => (
              <MediaCard key={item.id} item={item} onSelect={(selected) => setSelectedItemId(selected.id)} />
            ))}
          </motion.div>
        ) : (
          <div className="category-empty-state" role="status">
            <p className="eyebrow">Nothing here yet</p>
            <h3>{statusFilter === 'All' ? `No saved ${title.toLowerCase()}` : `No ${statusFilter.toLowerCase()} ${title.toLowerCase()}`}</h3>
            <p>Choose another status or use search to add something new.</p>
          </div>
        )}
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
