import CategoryPage from '../components/media/CategoryPage'
import type { MediaItem, MediaStatus } from '../types/media'
type MoviesPageProps = {
  items: MediaItem[]
  onRemove: (id: string) => void
  onStatusChange: (id: string, status: MediaStatus) => void
}
function MoviesPage({ items, onRemove, onStatusChange }: MoviesPageProps) {
  return (
    <CategoryPage
      title="Movies"
      subtitle="Track the movies you are watching, planning, and finishing."
      type="Movie"
      items={items}
      onRemove={onRemove}
      onStatusChange={onStatusChange}
    />
  )
}
export default MoviesPage
