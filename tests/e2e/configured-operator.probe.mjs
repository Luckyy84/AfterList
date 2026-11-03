import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser = await chromium.launch()
let checks = 0
try {
 for (const width of [1440, 320]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  for (const path of ['/privacy', '/imprint']) {
   await page.goto(`http://127.0.0.1:4188${path}`)
   await page.getByRole('heading', { level: 1 }).waitFor()
   assert.equal(await page.getByText('Test-only operator', { exact: true }).count(), 1)
   assert.equal(await page.getByRole('link', { name: 'test@example.invalid' }).getAttribute('href'), 'mailto:test@example.invalid')
   assert.equal(await page.getByText(/Controller information is not configured/).count(), 0)
   assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
   checks++
  }
  await page.close()
 }
 console.log(`Configured test-only operator: ${checks} page/viewport checks passed (no messages sent).`)
} finally { await browser.close() }
