import { expect, test } from '@playwright/test'

const snapshot = {
  item: { externalId: 'tv:100', source: 'tmdb', title: 'Catalog Series', type: 'TV Series', year: '2026', poster: '', backdrop: '', rating: '8', description: 'Shared provider metadata.' },
  details: { genres: [], countries: [] },
  catalog: { status: 'fresh', refreshedAt: '2026-10-30T00:00:00Z' },
}

test('shared catalog search opens canonical cached details and survives refresh', async ({ page }) => {
  await page.route('**/api/catalog?**', async (route) => {
    const search = new URL(route.request().url()).searchParams.has('q')
    await route.fulfill({ json: search ? { results: [{ provider: 'tmdb', external_id: 'tv:100', title: snapshot.item.title, refreshed_at: snapshot.catalog.refreshedAt, payload: snapshot }] } : snapshot })
  })
  await page.goto('/library')
  await page.getByText('Search shared metadata catalog', { exact: true }).click()
  await page.getByLabel('Search shared catalog', { exact: true }).fill('Catalog')
  await page.getByRole('button', { name: 'Search catalog', exact: true }).click()
  await page.getByRole('link', { name: 'Catalog Series', exact: true }).click()
  await expect(page).toHaveURL(/\/tv\/100\/catalog-series$/)
  await expect(page.getByRole('heading', { name: 'Catalog Series', exact: true })).toBeVisible()
  await expect(page.getByText(/Shared metadata refreshed/)).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Catalog Series', exact: true })).toBeVisible()
})

test('public page navigation respects server continuation and survives refresh', async ({ page }) => {
  await page.route('**/api/public/library?**', async (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset'))
    await route.fulfill({ json: { username: 'reader', displayName: 'Reader', items: [], hasMore: offset === 0, nextOffset: offset === 0 ? 50 : null } })
  })
  await page.goto('/user/reader/library')
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page).toHaveURL(/\?page=2$/)
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeEnabled()
  await page.getByRole('button', { name: 'Previous page' }).click()
  await expect(page).toHaveURL(/\?page=1$/)
})
