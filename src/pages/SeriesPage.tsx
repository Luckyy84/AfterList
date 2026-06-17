import CategoryPage from '../components/CategoryPage'
import type { MediaItem } from '../types/media'
type SeriesPageProps = {
  items: MediaItem[]
  onRemove: (id: string) => void
}
function SeriesPage({ items, onRemove }: SeriesPageProps) {
  return (
    <CategoryPage
      title="TV Series"
      subtitle="Track the TV series you are watching, planning, and finishing."
      type="TV Series"
      items={items}
      onRemove={onRemove}
    />
  )
}
export default SeriesPage