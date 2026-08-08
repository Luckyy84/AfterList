import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './anilist'

const media = {
  id: 101280,
  idMal: 37430,
  title: { english: 'That Time I Got Reincarnated as a Slime', romaji: 'Tensei Shitara Slime Datta Ken', native: '転生したらスライムだった件' },
  synonyms: ['TenSura'],
  format: 'TV',
  status: 'FINISHED',
  episodes: 24,
  duration: 24,
  startDate: { year: 2018 },
  description: '<b>Rimuru</b><br>begins &amp; grows.',
  averageScore: 79,
  genres: ['Adventure', 'Fantasy'],
  countryOfOrigin: 'JP',
  siteUrl: 'https://anilist.co/anime/101280',
  coverImage: { extraLarge: 'https://img.test/poster.jpg' },
  bannerImage: 'https://img.test/banner.jpg',
  studios: { nodes: [{ id: 441, name: '8bit', siteUrl: 'https://anilist.co/studio/441' }] },
  trailer: { id: 'abc', site: 'youtube', thumbnail: 'https://img.test/trailer.jpg' },
  relations: { edges: [] },
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AniList proxy', () => {
  it('searches with a fixed adult-filtered GraphQL document and normalizes results', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { Page: { pageInfo: { hasNextPage: false }, media: [media] } } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(new Request('http://localhost/api/anilist?operation=search&q=slime&page=2'))
    const body = await response.json()
    const upstream = JSON.parse(fetchMock.mock.calls[0][1].body)

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('s-maxage=300')
    expect(upstream.variables).toEqual({ page: 2, search: 'slime' })
    expect(upstream.query).toContain('isAdult:false')
    expect(upstream.query).not.toContain('slime')
    expect(body.results[0]).toEqual({
      externalId: '101280', source: 'anilist', title: 'That Time I Got Reincarnated as a Slime', type: 'Anime',
      year: '2018', poster: 'https://img.test/poster.jpg', backdrop: 'https://img.test/banner.jpg', rating: '7.9',
      description: 'Rimuru\nbegins & grows.',
    })
  })

  it('returns normalized details with rich optional metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { Media: media } }), { status: 200 })))

    const response = await GET(new Request('http://localhost/api/anilist?operation=details&id=101280'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600')
    expect(body.item).toMatchObject({ externalId: '101280', source: 'anilist', type: 'Anime' })
    expect(body.details).toMatchObject({
      runtimeMinutes: 24, totalEpisodes: 24, malId: 37430, format: 'TV', countries: ['JP'],
      alternativeTitles: expect.arrayContaining(['TenSura', '転生したらスライムだった件']),
      studios: [{ id: 441, name: '8bit', siteUrl: 'https://anilist.co/studio/441' }],
    })
  })

  it('discovers anime without accepting client-controlled GraphQL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { Page: { media: [] } } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(new Request('http://localhost/api/anilist?operation=discover&page=3'))
    const upstream = JSON.parse(fetchMock.mock.calls[0][1].body)

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('s-maxage=900')
    expect(upstream.variables).toEqual({ page: 3 })
    expect(upstream.query).toContain('TRENDING_DESC')
  })

  it.each([
    ['http://localhost/api/anilist', 'operation'],
    ['http://localhost/api/anilist?operation=search&q=', 'query'],
    [`http://localhost/api/anilist?operation=search&q=${'x'.repeat(121)}`, 'query'],
    ['http://localhost/api/anilist?operation=details&id=0', 'id'],
    ['http://localhost/api/anilist?operation=details&id=01', 'id'],
    ['http://localhost/api/anilist?operation=discover&page=10001', 'page'],
  ])('rejects invalid %s input before fetching', async (url) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const response = await GET(new Request(url))
    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats GraphQL errors in HTTP 200 as failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: null, errors: [{ message: 'bad' }] }), { status: 200 })))
    const response = await GET(new Request('http://localhost/api/anilist?operation=details&id=101280'))
    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('normalizes null detail data to 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { Media: null } }), { status: 200 })))
    const response = await GET(new Request('http://localhost/api/anilist?operation=details&id=101280'))
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('preserves Retry-After on upstream 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'retry-after': '30' } })))
    const response = await GET(new Request('http://localhost/api/anilist?operation=discover'))
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('30')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('rejects malformed successful payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { Page: {} } }), { status: 200 })))
    const response = await GET(new Request('http://localhost/api/anilist?operation=discover'))
    expect(response.status).toBe(502)
  })

  it('maps timeouts to 504', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('timeout'), { name: 'TimeoutError' })))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = await GET(new Request('http://localhost/api/anilist?operation=discover'))
    expect(response.status).toBe(504)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
