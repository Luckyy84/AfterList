import CategoryPage from '../components/media/CategoryPage'
import type { MediaItem, MediaUpdate } from '../types/media'
type SeriesPageProps = {
  items: MediaItem[]
  onRemove: (id: string) => void
  onUpdate: (id: string, updates: MediaUpdate) => void
}
function SeriesPage({ items, onRemove, onUpdate }: SeriesPageProps) {
  return (
    <CategoryPage
      title="TV Series"
      subtitle="Track the TV series you are watching, planning, and finishing."
      type="TV Series"
      items={items}
      onRemove={onRemove}
      onUpdate={onUpdate}
    />
  )
}
export default SeriesPage
