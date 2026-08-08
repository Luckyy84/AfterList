import { expect, test, type Page } from '@playwright/test'

const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

const animeFixture = {
  item: {
    externalId: '101280',
    source: 'anilist',
    title: 'That Time I Got Reincarnated as a Slime',
    type: 'Anime',
    poster: transparentPixel,
    backdrop: transparentPixel,
    year: '2018',
    rating: '8.0',
    description: 'A former office worker begins a new life in another world.',
  },
  details: {
    genres: ['Adventure', 'Fantasy'],
    countries: ['Japan'],
    episodesLabel: '24 episodes',
    totalEpisodes: 24,
    runtimeMinutes: 24,
    status: 'Finished',
  },
}

async function mockAniListDetails(page: Page) {
  await page.route('**/api/anilist?**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const id = requestUrl.searchParams.get('id') ?? requestUrl.searchParams.get('externalId')

    if (id !== '101280' && id !== 'anilist:101280') {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Anime not found.' }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(animeFixture),
    })
  })
}

test.beforeEach(async ({ page }) => {
  await mockAniListDetails(page)
})

test('opens, adds, and refreshes an AniList canonical deep link', async ({ page }) => {
  await page.goto('/anime/101280/that-time-i-got-reincarnated-as-a-slime')

  const unavailable = page.getByRole('heading', { name: 'Anime details are coming soon' })
  test.skip(await unavailable.isVisible(), 'Native AniList details are reserved but not implemented yet.')

  const heading = page.getByRole('heading', { level: 1, name: animeFixture.item.title })
  await expect(heading).toBeVisible()
  await expect(page).toHaveURL(/\/anime\/101280\/that-time-i-got-reincarnated-as-a-slime\/?$/)

  await page.getByRole('button', { name: 'Add to watchlist' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Track this title' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem('afterlist_items') ?? '[]') as Array<{ source?: string; externalId?: string }>
    return items.filter((item) => item.source === 'anilist' && item.externalId === '101280').length
  })).toBe(1)

  await page.reload()

  await expect(heading).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Track this title' })).toBeVisible()
})

test('does not write a probable cross-provider duplicate before confirmation', async ({ page }) => {
  await page.addInitScript(({ poster }) => {
    localStorage.setItem('afterlist_items', JSON.stringify([{
      id: 'legacy-tmdb-anime',
      externalId: 'tv:999',
      source: 'tmdb',
      title: 'That Time I Got Reincarnated as a Slime',
      type: 'Anime',
      status: 'Planned',
      poster,
      backdrop: poster,
      progress: '2018',
      rating: '8.0',
      description: 'Legacy TMDB anime entry.',
      year: '2018',
      updatedAt: '2026-08-08T00:00:00.000Z',
    }]))
  }, { poster: transparentPixel })

  await page.goto('/anime/101280/that-time-i-got-reincarnated-as-a-slime')
  await page.getByRole('button', { name: 'Add to watchlist' }).click()

  const duplicateDialog = page.getByRole('dialog', { name: 'Is this the same title?' })
  await expect(duplicateDialog).toBeVisible()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('afterlist_items') ?? '[]').length)).toBe(1)

  await duplicateDialog.getByRole('button', { name: 'Open existing' }).click()

  await expect(page).toHaveURL(/\/tv\/999\/that-time-i-got-reincarnated-as-a-slime\/?$/)
  await expect.poll(() => page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem('afterlist_items') ?? '[]') as Array<{ source?: string }>
    return { total: items.length, aniList: items.filter((item) => item.source === 'anilist').length }
  })).toEqual({ total: 1, aniList: 0 })
})
