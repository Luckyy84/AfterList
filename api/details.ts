const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3'

type TmdbMediaKind = 'movie' | 'tv'

type TmdbGenre = {
  id: number
  name: string
}

type TmdbProductionCountry = {
  iso_3166_1: string
  name: string
}

type TmdbMovieDetails = {
  genres?: TmdbGenre[]
  homepage?: string | null
  imdb_id?: string | null
  original_language?: string
  production_countries?: TmdbProductionCountry[]
  release_date?: string
  runtime?: number | null
  status?: string
  tagline?: string | null
  vote_count?: number
}

type TmdbTvDetails = {
  episode_run_time?: number[]
  first_air_date?: string
  genres?: TmdbGenre[]
  homepage?: string | null
  in_production?: boolean
  number_of_episodes?: number
  number_of_seasons?: number
  origin_country?: string[]
  original_language?: string
  production_countries?: TmdbProductionCountry[]
  status?: string
  tagline?: string | null
  last_episode_to_air?: { runtime?: number | null } | null
  vote_count?: number
}

type DetailsResponse = {
  details: {
    genres: string[]
    runtimeLabel?: string
    runtimeMinutes?: number
    seasonsLabel?: string
    episodesLabel?: string
    totalEpisodes?: number
    status?: string
    tagline?: string
    homepage?: string
    tmdbUrl: string
    originalLanguage?: string
    countries: string[]
    voteCount?: number
  }
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  const status = init?.status ?? 200
  const cacheControl = status >= 400 ? 'no-store' : 'public, max-age=300, s-maxage=1800, stale-while-revalidate=3600'

  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
      ...init?.headers,
    },
  })
}

function getTmdbApiKey() {
  return process.env.TMDB_API_KEY?.trim()
}

function getTmdbAccessToken() {
  return process.env.TMDB_ACCESS_TOKEN?.trim()
}

function parseExternalId(externalId: string) {
  const [kind, rawId] = externalId.split(':')
  const numericId = Number(rawId)

  if ((kind !== 'movie' && kind !== 'tv') || !Number.isInteger(numericId) || numericId <= 0) {
    return null
  }

  return { kind: kind as TmdbMediaKind, id: numericId }
}

function formatRuntime(minutes?: number | null) {
  if (!minutes || minutes <= 0) return undefined

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (!hours) return `${remainingMinutes}m`
  if (!remainingMinutes) return `${hours}h`
  return `${hours}h ${remainingMinutes}m`
}

function formatCount(value: number | undefined, singular: string, plural: string) {
  if (!value || value <= 0) return undefined
  return `${value} ${value === 1 ? singular : plural}`
}

function getCountryNames(countries?: TmdbProductionCountry[]) {
  return (countries ?? [])
    .map((country) => country.name?.trim())
    .filter((name): name is string => Boolean(name))
    .slice(0, 3)
}

function mapMovieDetails(data: TmdbMovieDetails, id: number): DetailsResponse {
  const runtimeMinutes = data.runtime && data.runtime > 0 ? data.runtime : undefined

  return {
    details: {
      genres: (data.genres ?? []).map((genre) => genre.name).filter(Boolean).slice(0, 5),
      runtimeLabel: formatRuntime(runtimeMinutes),
      runtimeMinutes,
      status: data.status,
      tagline: data.tagline?.trim() || undefined,
      homepage: data.homepage?.trim() || undefined,
      tmdbUrl: `https://www.themoviedb.org/movie/${id}`,
      originalLanguage: data.original_language?.toUpperCase(),
      countries: getCountryNames(data.production_countries),
      voteCount: data.vote_count,
    },
  }
}

function mapTvDetails(data: TmdbTvDetails, id: number): DetailsResponse {
  const runtimeMinutes = data.episode_run_time?.find((runtime) => runtime > 0)
    ?? (data.last_episode_to_air?.runtime && data.last_episode_to_air.runtime > 0 ? data.last_episode_to_air.runtime : undefined)

  return {
    details: {
      genres: (data.genres ?? []).map((genre) => genre.name).filter(Boolean).slice(0, 5),
      runtimeLabel: formatRuntime(runtimeMinutes),
      runtimeMinutes,
      seasonsLabel: formatCount(data.number_of_seasons, 'season', 'seasons'),
      episodesLabel: formatCount(data.number_of_episodes, 'episode', 'episodes'),
      totalEpisodes: data.number_of_episodes,
      status: data.status ?? (data.in_production ? 'In Production' : undefined),
      tagline: data.tagline?.trim() || undefined,
      homepage: data.homepage?.trim() || undefined,
      tmdbUrl: `https://www.themoviedb.org/tv/${id}`,
      originalLanguage: data.original_language?.toUpperCase(),
      countries: getCountryNames(data.production_countries),
      voteCount: data.vote_count,
    },
  }
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const externalId = requestUrl.searchParams.get('externalId')?.trim() ?? ''
    const parsedId = parseExternalId(externalId)
    const apiKey = getTmdbApiKey()
    const accessToken = getTmdbAccessToken()

    if (!parsedId) {
      return jsonResponse({ error: 'A valid TMDB externalId is required.' }, { status: 400 })
    }

    if (!apiKey && !accessToken) {
      return jsonResponse({ error: 'TMDB is not configured on the server.' }, { status: 503 })
    }

    const params = new URLSearchParams({ language: 'en-US' })

    if (!accessToken && apiKey) {
      params.set('api_key', apiKey)
    }

    const response = await fetch(`${TMDB_API_BASE_URL}/${parsedId.kind}/${parsedId.id}?${params.toString()}`, {
      headers: {
        accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    })

    if (!response.ok) {
      return jsonResponse({ error: `TMDB details failed with status ${response.status}.` }, { status: response.status })
    }

    const data = (await response.json()) as TmdbMovieDetails | TmdbTvDetails
    const details = parsedId.kind === 'movie'
      ? mapMovieDetails(data as TmdbMovieDetails, parsedId.id)
      : mapTvDetails(data as TmdbTvDetails, parsedId.id)

    return jsonResponse(details)
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: 'TMDB details proxy failed. Try again in a moment.' }, { status: 500 })
  }
}
