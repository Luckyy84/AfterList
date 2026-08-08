import { describe, expect, it } from 'vitest'
import { getMediaPath, parsePositiveMediaId, parseTmdbExternalId, slugifyTitle } from './mediaRoutes'

describe('media routes', () => {
  it('creates readable stable slugs', () => {
    expect(slugifyTitle("That Time I Got Reincarnated as a Slime!"))
      .toBe('that-time-i-got-reincarnated-as-a-slime')
    expect(slugifyTitle('  Amélie: L’étrange  ')).toBe('amelie-letrange')
    expect(slugifyTitle('---')).toBe('untitled')
  })

  it('uses the TMDB provider kind, including TMDB anime stored as TV', () => {
    expect(getMediaPath({ source: 'tmdb', externalId: 'movie:550', title: 'Fight Club' }))
      .toBe('/movie/550/fight-club')
    expect(getMediaPath({ source: 'tmdb', externalId: 'tv:101280', title: 'Slime' }))
      .toBe('/tv/101280/slime')
  })

  it('reserves anime paths for AniList identities', () => {
    expect(getMediaPath({ source: 'anilist', externalId: '101280', title: 'Slime' }))
      .toBe('/anime/101280/slime')
  })

  it('rejects malformed identities', () => {
    expect(parseTmdbExternalId('tv:0')).toBeNull()
    expect(parseTmdbExternalId('anime:1')).toBeNull()
    expect(parsePositiveMediaId('01')).toBeNull()
    expect(getMediaPath({ source: 'tmdb', externalId: 'bad', title: 'Missing' })).toBe('/discover')
  })
})
