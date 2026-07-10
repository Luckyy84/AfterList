import CategoryPage from '../components/media/CategoryPage'
import type { MediaItem, MediaUpdate } from '../types/media'
type AnimePageProps = {
  items: MediaItem[]
  onRemove: (id: string) => void
  onUpdate: (id: string, updates: MediaUpdate) => void
}
function AnimePage({ items, onRemove, onUpdate }: AnimePageProps) {
  return (
    <CategoryPage
      title="Anime"
      subtitle="Track the anime you are watching, planning, and finishing."
      type="Anime"
      items={items}
      onRemove={onRemove}
      onUpdate={onUpdate}
    />
  )
}
export default AnimePage
