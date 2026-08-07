import { describe, expect, it } from 'vitest'
import { cumulativeEpisode } from './watchlist'

describe('Jellyfin episode progress', () => {
  it('maps a season episode to its show-wide episode number and ignores specials', () => {
    expect(cumulativeEpisode([
      { season_number: 0, episode_count: 5 },
      { season_number: 1, episode_count: 24 },
      { season_number: 2, episode_count: 24 },
      { season_number: 3, episode_count: 24 },
      { season_number: 4, episode_count: 24 },
    ], 4, 2)).toBe(74)
  })
})
