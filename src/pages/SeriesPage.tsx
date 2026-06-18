import CategoryPage from '../components/CategoryPage'
import type { MediaItem, MediaStatus } from '../types/media'
type SeriesPageProps = {
  items: MediaItem[]
  onRemove: (id: string) => void
  onStatusChange: (id: string, status: MediaStatus) => void
}
function SeriesPage({ items, onRemove, onStatusChange }: SeriesPageProps) {
  return (
    <CategoryPage
      title="TV Series"
      subtitle="Track the TV series you are watching, planning, and finishing."
      type="TV Series"
      items={items}
      onRemove={onRemove}
      onStatusChange={onStatusChange}
    />
  )
}
export default SeriesPage
