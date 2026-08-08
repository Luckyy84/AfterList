const ANILIST_URL = 'https://graphql.anilist.co'
const TIMEOUT_MS = 10_000
const MAX_QUERY = 120

const MEDIA_FIELDS = `
  id idMal title { romaji english native } synonyms format status episodes duration
  startDate { year } description(asHtml: false) averageScore genres countryOfOrigin siteUrl
  coverImage { extraLarge large } bannerImage
  trailer { id site thumbnail }
  studios(isMain: true) { nodes { id name siteUrl } }
  relations { edges { relationType node { id title { romaji english } format coverImage { large } } } }
`

const SEARCH_QUERY = `query AfterListAnimeSearch($page:Int!,$search:String!){Page(page:$page,perPage:20){pageInfo{currentPage hasNextPage}media(type:ANIME,isAdult:false,search:$search,sort:[SEARCH_MATCH,POPULARITY_DESC]){${MEDIA_FIELDS}}}}`
const DISCOVER_QUERY = `query AfterListAnimeDiscover($page:Int!){Page(page:$page,perPage:20){pageInfo{currentPage hasNextPage}media(type:ANIME,isAdult:false,sort:[TRENDING_DESC,POPULARITY_DESC]){${MEDIA_FIELDS}}}}`
const DETAILS_QUERY = `query AfterListAnimeDetails($id:Int!){Media(id:$id,type:ANIME){${MEDIA_FIELDS}}}`

type AniMedia = {
  id?: number
  idMal?: number | null
  title?: { romaji?: string | null; english?: string | null; native?: string | null }
  synonyms?: string[]
  format?: string | null
  status?: string | null
  episodes?: number | null
  duration?: number | null
  startDate?: { year?: number | null }
  description?: string | null
  averageScore?: number | null
  genres?: string[]
  countryOfOrigin?: string | null
  siteUrl?: string | null
  coverImage?: { extraLarge?: string | null; large?: string | null }
  bannerImage?: string | null
  trailer?: { id?: string | null; site?: string | null; thumbnail?: string | null } | null
  studios?: { nodes?: Array<{ id?: number; name?: string; siteUrl?: string | null }> }
  relations?: { edges?: Array<{ relationType?: string; node?: { id?: number; title?: { romaji?: string | null; english?: string | null }; format?: string | null; coverImage?: { large?: string | null } } }> }
}

function json(body: unknown, status = 200, headers?: HeadersInit, maxAge = 300) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status >= 400 ? 'no-store' : `public, max-age=60, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
      ...headers,
    },
  })
}

function stripHtml(value?: string | null) {
  return (value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim()
}

function placeholder(title: string) {
  const safe = title.replace(/[<>&'"]/g, '').slice(0, 42)
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1350"><rect width="100%" height="100%" fill="#11131a"/><text x="70" y="650" fill="white" font-size="48">${safe || 'Anime'}</text></svg>`)}`
}

function normalizedItem(media: AniMedia) {
  if (!Number.isSafeInteger(media.id) || Number(media.id) <= 0) return null
  const title = (media.title?.english || media.title?.romaji)?.trim()
  if (!title) return null
  const poster = media.coverImage?.extraLarge || media.coverImage?.large || placeholder(title)
  const description = stripHtml(media.description) || 'No anime description is available from AniList yet.'
  return {
    externalId: String(media.id),
    source: 'anilist' as const,
    title,
    type: 'Anime' as const,
    year: media.startDate?.year ? String(media.startDate.year) : 'Unknown',
    poster,
    backdrop: media.bannerImage || poster,
    rating: typeof media.averageScore === 'number' && media.averageScore > 0 ? (media.averageScore / 10).toFixed(1) : 'N/A',
    description,
  }
}

function normalizedDetails(media: AniMedia) {
  return {
    genres: (media.genres ?? []).filter(Boolean).slice(0, 8),
    poster: media.coverImage?.extraLarge || media.coverImage?.large || undefined,
    backdrop: media.bannerImage || undefined,
    runtimeLabel: media.duration && media.duration > 0 ? `${media.duration}m per episode` : undefined,
    runtimeMinutes: media.duration && media.duration > 0 ? media.duration : undefined,
    episodesLabel: media.episodes && media.episodes > 0 ? `${media.episodes} ${media.episodes === 1 ? 'episode' : 'episodes'}` : undefined,
    totalEpisodes: media.episodes && media.episodes > 0 ? media.episodes : undefined,
    status: media.status || undefined,
    homepage: media.siteUrl || undefined,
    originalLanguage: media.countryOfOrigin || undefined,
    countries: media.countryOfOrigin ? [media.countryOfOrigin] : [],
    format: media.format || undefined,
    malId: media.idMal ?? undefined,
    alternativeTitles: [...new Set([media.title?.romaji, media.title?.english, media.title?.native, ...(media.synonyms ?? [])].filter((value): value is string => Boolean(value)))],
    studios: (media.studios?.nodes ?? []).filter((studio) => studio.name).map((studio) => ({ id: studio.id, name: studio.name, siteUrl: studio.siteUrl || undefined })),
    trailer: media.trailer?.id ? { id: media.trailer.id, site: media.trailer.site || undefined, thumbnail: media.trailer.thumbnail || undefined } : undefined,
    relations: (media.relations?.edges ?? []).flatMap((edge) => {
      const item = edge.node ? normalizedItem(edge.node as AniMedia) : null
      return item ? [{ relationType: edge.relationType || 'OTHER', item, format: edge.node?.format || undefined }] : []
    }),
  }
}

function positiveInteger(value: string | null, fallback?: number, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === null && fallback !== undefined) return fallback
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number <= maximum ? number : null
}

async function requestAniList(query: string, variables: Record<string, unknown>) {
  return fetch(ANILIST_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const operation = params.get('operation')
    if (!['search', 'details', 'discover'].includes(operation ?? '')) return json({ error: 'A valid AniList operation is required.' }, 400)

    const page = positiveInteger(params.get('page'), 1, 10_000)
    if (!page) return json({ error: 'Page must be an integer from 1 to 10000.' }, 400)

    let query = DISCOVER_QUERY
    let variables: Record<string, unknown> = { page }
    if (operation === 'search') {
      const q = params.get('q')?.trim() ?? ''
      if (!q || q.length > MAX_QUERY) return json({ error: `Search query must be between 1 and ${MAX_QUERY} characters.` }, 400)
      query = SEARCH_QUERY
      variables = { page, search: q }
    } else if (operation === 'details') {
      const id = positiveInteger(params.get('id'))
      if (!id) return json({ error: 'A valid AniList id is required.' }, 400)
      query = DETAILS_QUERY
      variables = { id }
    }

    const response = await requestAniList(query, variables)
    if (!response.ok) {
      if (response.status === 404) return json({ error: 'AniList title not found.' }, 404)
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after')
        return json({ error: 'AniList rate limit exceeded. Try again shortly.' }, 429, retryAfter ? { 'retry-after': retryAfter } : undefined)
      }
      return json({ error: 'AniList is temporarily unavailable.' }, 502)
    }

    const payload = await response.json().catch(() => null) as { data?: { Page?: { media?: AniMedia[]; pageInfo?: unknown }; Media?: AniMedia | null }; errors?: Array<{ status?: number }> } | null
    if (!payload || typeof payload !== 'object') return json({ error: 'AniList returned an invalid response.' }, 502)
    if (payload.errors?.length) {
      const status = payload.errors.some((error) => error.status === 404) ? 404 : payload.errors.some((error) => error.status === 429) ? 429 : 502
      const retryAfter = status === 429 ? response.headers.get('retry-after') : null
      return json(
        { error: status === 404 ? 'AniList title not found.' : status === 429 ? 'AniList rate limit exceeded. Try again shortly.' : 'AniList returned an error.' },
        status,
        retryAfter ? { 'retry-after': retryAfter } : undefined,
      )
    }

    if (operation === 'details') {
      const media = payload.data?.Media
      const item = media ? normalizedItem(media) : null
      if (!media || !item) return json({ error: media === null ? 'AniList title not found.' : 'AniList returned an invalid response.' }, media === null ? 404 : 502)
      return json({ item, details: normalizedDetails(media) }, 200, undefined, 3600)
    }

    const media = payload.data?.Page?.media
    if (!Array.isArray(media)) return json({ error: 'AniList returned an invalid response.' }, 502)
    const results = media.map(normalizedItem).filter((item): item is NonNullable<typeof item> => Boolean(item))
    return json({ results, pageInfo: payload.data?.Page?.pageInfo ?? null }, 200, undefined, operation === 'discover' ? 900 : 300)
  } catch (error) {
    console.error('AniList proxy failed:', error instanceof Error ? error.name : 'UnknownError')
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) return json({ error: 'AniList request timed out.' }, 504)
    return json({ error: 'AniList proxy failed. Try again in a moment.' }, 502)
  }
}
