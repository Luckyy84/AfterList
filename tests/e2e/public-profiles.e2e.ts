import { expect, test, type Page, type Route } from '@playwright/test'

const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

const publicItem = {
  id: 'public-item',
  externalId: 'movie:101',
  source: 'tmdb',
  title: 'Public Favorite',
  type: 'Movie',
  status: 'Watched',
  poster: transparentPixel,
  backdrop: transparentPixel,
  progress: 'Watched',
  rating: '8.0',
  description: '',
  year: '2024',
  currentEpisode: 0,
  personalRating: 9,
  isFavorite: true,
}

const publicProfile = {
  username: 'lucky',
  displayName: 'Lucky Viewer',
  bio: 'A public profile with deliberate privacy controls.',
  avatarUrl: transparentPixel,
  externalLinks: [{ label: 'Website', url: 'https://example.test/lucky' }],
  stats: { total: 1, planned: 0, watching: 0, paused: 0, watched: 1, dropped: 0 },
  favorites: [publicItem],
  lists: [{ name: 'Public Picks', slug: 'public-picks' }],
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

async function mockPublicProfiles(page: Page) {
  await page.route('**/api/public/profile?**', async (route) => {
    const username = new URL(route.request().url()).searchParams.get('username')
    if (username === 'old_name') return json(route, { redirectUsername: 'lucky' })
    if (username === 'lucky') return json(route, publicProfile)
    return json(route, { error: 'Profile not found or private.' }, 404)
  })

  await page.route('**/api/public/library?**', async (route) => {
    const username = new URL(route.request().url()).searchParams.get('username')
    if (username === 'old_name') return json(route, { redirectUsername: 'lucky' })
    if (username === 'lucky') return json(route, { username: 'lucky', displayName: 'Lucky Viewer', items: [publicItem] })
    return json(route, { error: 'Profile not found or private.' }, 404)
  })

  await page.route('**/api/public/list?**', async (route) => {
    const params = new URL(route.request().url()).searchParams
    const username = params.get('username')
    const slug = params.get('slug')
    if (username === 'old_name') return json(route, { redirectUsername: 'lucky' })
    if (username === 'lucky' && slug === 'public-picks') {
      return json(route, { username: 'lucky', displayName: 'Lucky Viewer', name: 'Public Picks', slug, items: [publicItem] })
    }
    return json(route, { error: 'Profile not found or private.' }, 404)
  })
}

test.beforeEach(async ({ page }) => {
  await mockPublicProfiles(page)
})

test('signed-out visitors can open and refresh a curated public profile', async ({ page }) => {
  await page.goto('/user/lucky')

  await expect(page.getByRole('heading', { level: 1, name: 'Lucky Viewer' })).toBeVisible()
  await expect(page.getByText('A public profile with deliberate privacy controls.')).toBeVisible()
  await expect(page.getByText('Public Favorite')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Public Picks' })).toHaveAttribute('href', '/user/lucky/lists/public-picks')
  await expect(page.getByRole('button', { name: /Save profile|Edit profile/i })).toHaveCount(0)
  await expect(page.getByText(/secret note|private draft|profile-a@example/i)).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Lucky Viewer' })).toBeVisible()
})

test('public library and list deep links survive direct refresh', async ({ page }) => {
  await page.goto('/user/lucky/library')
  await expect(page.getByRole('heading', { level: 1, name: 'Lucky Viewer' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Public library' })).toBeVisible()
  await expect(page.getByText('Public Favorite')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Public Favorite')).toBeVisible()

  await page.goto('/user/lucky/lists/public-picks')
  await expect(page.getByRole('heading', { level: 1, name: 'Public Picks' })).toBeVisible()
  await expect(page.getByText('Public Favorite')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Public Picks' })).toBeVisible()
})

test('old usernames replace the route while preserving the public subpage', async ({ page }) => {
  await page.goto('/user/old_name')
  await expect(page).toHaveURL(/\/user\/lucky\/?$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Lucky Viewer' })).toBeVisible()

  await page.goto('/user/old_name/library')
  await expect(page).toHaveURL(/\/user\/lucky\/library\/?$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Public library' })).toBeVisible()

  await page.goto('/user/old_name/lists/public-picks')
  await expect(page).toHaveURL(/\/user\/lucky\/lists\/public-picks\/?$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Public Picks' })).toBeVisible()
})

test('private and missing profiles render the same signed-out unavailable state', async ({ page }) => {
  await page.goto('/user/private_user')
  await expect(page.getByRole('heading', { level: 1, name: 'Profile unavailable' })).toBeVisible()
  await expect(page.getByText('This profile is private or does not exist.')).toBeVisible()

  await page.goto('/user/missing_user')
  await expect(page.getByRole('heading', { level: 1, name: 'Profile unavailable' })).toBeVisible()
  await expect(page.getByText('This profile is private or does not exist.')).toBeVisible()

  await page.goto('/user/lucky/lists/private-drafts')
  await expect(page.getByRole('heading', { level: 1, name: 'Profile unavailable' })).toBeVisible()
  await expect(page.getByText('This profile is private or does not exist.')).toBeVisible()
})

test('public profiles have a usable keyboard path', async ({ page }) => {
  await page.goto('/user/lucky')
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#main-content$/)
  await expect(page.locator('#main-content')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Profile sections' })).toBeVisible()
})

test.describe('320px public profile', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('keeps profile, library, and public-list content in the viewport', async ({ page }) => {
    await page.goto('/user/lucky')
    await expect(page.getByRole('heading', { level: 1, name: 'Lucky Viewer' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

    await page.getByRole('navigation', { name: 'Profile sections' }).getByRole('link', { name: 'Library', exact: true }).click()
    await expect(page).toHaveURL(/\/user\/lucky\/library\/?$/)
    await expect(page.getByText('Public Favorite')).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
})
