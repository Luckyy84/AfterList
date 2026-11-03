import { test, expect } from '@playwright/test'
for (const [path, heading] of [['privacy', 'Privacy Policy'], ['imprint', 'Imprint / Operator'], ['credits', 'About & Credits'], ['terms', 'Terms of Use']]) {
 test(`${path} is accessible without optional analytics`, async ({ page }) => {
  const requests: string[] = []
  page.on('request', r => requests.push(r.url()))
  await page.goto(`/${path}`)
  await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible()
  if (path !== 'credits') await expect(page.getByText(/Controller information is not configured/)).toBeVisible()
  if (path === 'credits') {
   const image = page.getByRole('img', { name: 'TMDB — The Movie Database' })
   await expect(image).toBeVisible()
   expect(await image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBeTruthy()
  }
  await page.getByRole('contentinfo').scrollIntoViewIfNeeded()
  await expect(page.getByRole('contentinfo').getByRole('link', { name: /Imprint/ })).toBeVisible()
  await expect(page.getByRole('contentinfo').getByRole('link', { name: /About/ })).toBeVisible()
  expect(requests.filter(url => /_vercel\/insights|vitals|analytics|api\/anilist/.test(url))).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
 })
}
