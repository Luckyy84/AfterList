import CategoryPage from '../components/CategoryPage'
import type { MediaItem } from '../types/media'
type AnimePageProps = {
  items: MediaItem[]
  onRemove: (id: string) => void
}
function AnimePage({ items, onRemove }: AnimePageProps) {
  return (
    <CategoryPage
      title="Anime"
      subtitle="Track the anime you are watching, planning, and finishing."
      type="Anime"
      items={items}
      onRemove={onRemove}
    />
  )
}
export default AnimePage