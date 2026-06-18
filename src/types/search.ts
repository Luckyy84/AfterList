import type { MediaSource, MediaType } from './media'

export type SearchResultItem = {
  externalId: string
  source: MediaSource
  title: string
  type: MediaType
  year: string
  poster: string
  backdrop: string
  rating: string
  description: string
}
