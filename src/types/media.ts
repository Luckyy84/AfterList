export type MediaType = 'Anime' | 'Movie' | 'TV Series'

export type MediaStatus = 'Planned' | 'Watching' | 'Watched' | 'Dropped'

export type MediaSource = 'tmdb' | 'anilist'

export type MediaDetails = {
  genres: string[]
  runtimeLabel?: string
  runtimeMinutes?: number
  seasonsLabel?: string
  episodesLabel?: string
  totalEpisodes?: number
  status?: string
  tagline?: string
  homepage?: string
  tmdbUrl?: string
  originalLanguage?: string
  countries: string[]
  voteCount?: number
}

export type MediaItem = {
  id: string
  title: string
  type: MediaType
  status: MediaStatus
  poster: string
  backdrop: string
  progress: string
  rating: string
  description: string
  year?: string
  source?: MediaSource
  externalId?: string
  currentEpisode?: number
  totalEpisodes?: number
  runtimeMinutes?: number
  personalRating?: number | null
  isFavorite?: boolean
  updatedAt?: string
}

export type MediaUpdate = Partial<
  Pick<MediaItem, 'status' | 'currentEpisode' | 'totalEpisodes' | 'runtimeMinutes' | 'personalRating' | 'isFavorite'>
>
