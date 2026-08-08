export type MediaType = 'Anime' | 'Movie' | 'TV Series'

export type MediaStatus = 'Planned' | 'Watching' | 'Paused' | 'Watched' | 'Dropped'

export type MediaSource = 'tmdb' | 'anilist'

export type MediaAlias = { source: MediaSource; externalId: string }
export type MediaRelation = { relationType: string; item: { externalId: string; source: MediaSource; title: string; type: MediaType; year: string; poster: string; backdrop: string; rating: string; description: string }; format?: string }
export type MediaStudio = { id?: number; name?: string; siteUrl?: string }
export type MediaTrailer = { id: string; site?: string; thumbnail?: string; url?: string }

export type MediaDetails = {
  genres: string[]
  poster?: string
  backdrop?: string
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
  alternativeTitles?: string[]
  format?: string
  airingStatus?: string
  episodeDuration?: number
  relations?: MediaRelation[]
  studios?: MediaStudio[]
  trailer?: MediaTrailer
  malId?: number
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
  canonicalId?: string
  aliases?: MediaAlias[]
  alternativeTitles?: string[]
  format?: string
  airingStatus?: string
  episodeDuration?: number
  relations?: MediaRelation[]
  studios?: MediaStudio[]
  trailer?: MediaTrailer
  isRewatching?: boolean
  rewatchCount?: number
  startedAt?: string | null
  completedAt?: string | null
  privateNotes?: string
}

export type MediaUpdate = Partial<
  Pick<MediaItem, 'status' | 'poster' | 'backdrop' | 'currentEpisode' | 'totalEpisodes' | 'runtimeMinutes' | 'personalRating' | 'isFavorite' | 'isRewatching' | 'rewatchCount' | 'startedAt' | 'completedAt' | 'privateNotes'>
>
