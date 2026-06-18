import CategoryPage from '../components/CategoryPage'
import type { MediaItem, MediaStatus } from '../types/media'
type AnimePageProps = {
  items: MediaItem[]
  onRemove: (id: string) => void
  onStatusChange: (id: string, status: MediaStatus) => void
}
function AnimePage({ items, onRemove, onStatusChange }: AnimePageProps) {
  return (
    <CategoryPage
      title="Anime"
      subtitle="Track the anime you are watching, planning, and finishing."
      type="Anime"
      items={items}
      onRemove={onRemove}
      onStatusChange={onStatusChange}
    />
  )
}
export default AnimePage
