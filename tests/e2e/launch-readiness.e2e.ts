import { expect, test } from '@playwright/test'

test('renders the in-app not-found recovery state with noindex metadata', async ({ page }) => {
  await page.goto('/this-route-does-not-exist')
  await expect(page).toHaveTitle('Page not found | AfterList')
  await expect(page.getByRole('heading', { name: 'This story isn’t on the list.' })).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await expect(page.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
  const discoverLink = page.getByRole('link', { name: 'Discover titles' })
  await expect(discoverLink).toHaveAttribute('href', '/discover')
  await discoverLink.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/discover')
  await expect(page.getByRole('heading', { name: 'Find your next story.' })).toBeVisible()
})

test('publishes stable public metadata and a GitHub contact path', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page).toHaveTitle('Privacy Policy | AfterList')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://afterlist.luckako.uk/privacy')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
  await expect(page.getByRole('link', { name: 'contact the project on GitHub' })).toHaveAttribute('href', 'https://github.com/Luckyy84/AfterList/issues')
})

test('serves launch metadata assets with the expected content', async ({ request }) => {
  const [robots, sitemap, notFound, socialImage] = await Promise.all([
    request.get('/robots.txt'),
    request.get('/sitemap.xml'),
    request.get('/404.html'),
    request.get('/og-afterlist.png'),
  ])
  expect(await robots.text()).toContain('Sitemap: https://afterlist.luckako.uk/sitemap.xml')
  expect((await sitemap.text()).match(/<url>/g)).toHaveLength(4)
  expect(await notFound.text()).toContain('This story isn&rsquo;t on the list.')
  expect(socialImage.headers()['content-type']).toContain('image/png')
  expect((await socialImage.body()).byteLength).toBeLessThanOrEqual(500_000)
})
