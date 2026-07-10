import CategoryPage from '../components/media/CategoryPage'
import type { MediaItem, MediaUpdate } from '../types/media'
type MoviesPageProps = {
  items: MediaItem[]
  onRemove: (id: string) => void
  onUpdate: (id: string, updates: MediaUpdate) => void
}
function MoviesPage({ items, onRemove, onUpdate }: MoviesPageProps) {
  return (
    <CategoryPage
      title="Movies"
      subtitle="Track the movies you are watching, planning, and finishing."
      type="Movie"
      items={items}
      onRemove={onRemove}
      onUpdate={onUpdate}
    />
  )
}
export default MoviesPage
