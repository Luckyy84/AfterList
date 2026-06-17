import CategoryPage from '../components/CategoryPage'
import type { MediaItem } from '../types/media'
type MoviesPageProps = {
  items: MediaItem[]
  onRemove: (id: string) => void
}
function MoviesPage({ items, onRemove }: MoviesPageProps) {
  return (
    <CategoryPage
      title="Movies"
      subtitle="Track the movies you are watching, planning, and finishing."
      type="Movie" 
      items={items}
      onRemove={onRemove}
    />
  )
}
export default MoviesPage