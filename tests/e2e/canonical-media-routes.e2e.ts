import { expect, test, type Page } from '@playwright/test'

const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

const mediaFixtures = {
  'movie:550': {
    item: {
      externalId: 'movie:550',
      source: 'tmdb',
      title: 'Fight Club',
      type: 'Movie',
      poster: transparentPixel,
      backdrop: transparentPixel,
      year: '1999',
      rating: '8.4',
      description: 'An insomniac encounters an unconventional support group.',
    },
    details: {
      genres: ['Drama'],
      countries: ['United States of America'],
      runtimeLabel: '2h 19m',
      runtimeMinutes: 139,
    },
  },
  'tv:1399': {
    item: {
      externalId: 'tv:1399',
      source: 'tmdb',
      title: 'Game of Thrones',
      type: 'TV Series',
      poster: transparentPixel,
      backdrop: transparentPixel,
      year: '2011',
      rating: '8.5',
      description: 'Noble families struggle for control of the realm.',
    },
    details: {
      genres: ['Drama', 'Fantasy'],
      countries: ['United States of America'],
      seasonsLabel: '8 seasons',
      episodesLabel: '73 episodes',
      totalEpisodes: 73,
      runtimeMinutes: 57,
    },
  },
} as const

async function mockMediaDetails(page: Page) {
  await page.route('**/api/details?**', async (route) => {
    const externalId = new URL(route.request().url()).searchParams.get('externalId')
    const fixture = externalId && mediaFixtures[externalId as keyof typeof mediaFixtures]

    if (!fixture) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Title not found.' }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    })
  })
}

test.beforeEach(async ({ page }) => {
  await mockMediaDetails(page)
})

test('opens and refreshes a movie canonical deep link', async ({ page }) => {
  await page.goto('/movie/550/fight-club')

  await expect(page).toHaveURL(/\/movie\/550\/fight-club\/?$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Fight Club' })).toBeVisible()
  await expect(page.getByText('An insomniac encounters an unconventional support group.')).toBeVisible()

  await page.reload()

  await expect(page.getByRole('heading', { level: 1, name: 'Fight Club' })).toBeVisible()
  await expect(page).toHaveURL(/\/movie\/550\/fight-club\/?$/)
})

test('opens and refreshes a TV canonical deep link', async ({ page }) => {
  await page.goto('/tv/1399/game-of-thrones')

  await expect(page).toHaveURL(/\/tv\/1399\/game-of-thrones\/?$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Game of Thrones' })).toBeVisible()
  await expect(page.getByText('Noble families struggle for control of the realm.')).toBeVisible()

  await page.reload()

  await expect(page.getByRole('heading', { level: 1, name: 'Game of Thrones' })).toBeVisible()
  await expect(page).toHaveURL(/\/tv\/1399\/game-of-thrones\/?$/)
})

test('keeps canonical details usable with keyboard and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/movie/550/fight-club')

  await expect(page.getByRole('heading', { level: 1, name: 'Fight Club' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)

  await page.locator('body').click({ position: { x: 1, y: 1 } })
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toBeVisible()
})
