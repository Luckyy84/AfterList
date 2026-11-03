import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser = await chromium.launch()
const user = { id: 'd0000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', created_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {} }
try {
 for (const width of [1440, 320]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, acceptDownloads: true })
  let deletionCalls = 0
  await page.route('**/*', async route => {
   const url = new URL(route.request().url())
   if (url.hostname === 'account-fixture.invalid') {
    return route.fulfill({ json: url.pathname.endsWith('/user') ? user : [] })
   }
   if (url.pathname === '/api/account/export') return route.fulfill({ json: { version: 2, account: { id: user.id }, records: { profiles: [{ user_id: user.id, is_public: false }] } } })
   if (url.pathname === '/api/account/delete') { deletionCalls++; return route.fulfill({ status: 204, body: '' }) }
   if (url.hostname !== '127.0.0.1') return route.abort()
   return route.continue()
  })
  await page.addInitScript(({ user }) => {
   const session = { access_token: 'fixture-token-not-a-credential', refresh_token: 'fixture-refresh-not-a-credential', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, user }
   localStorage.setItem('sb-account-fixture-auth-token', JSON.stringify(session))
   localStorage.setItem('afterlist_queue:other-owner', 'other owner data')
  }, { user })
  await page.goto('http://127.0.0.1:4190/settings/account')
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export account JSON' }).click()
  const download = await downloadEvent
  assert.match(download.suggestedFilename(), /^afterlist-account-.*\.json$/)
  await page.evaluate(id => localStorage.setItem(`afterlist_queue:${id}`, 'deleted-owner-data'), user.id)
  await page.getByLabel('Type DELETE to confirm').fill('DELETE')
  await page.getByLabel('Current password', { exact: true }).fill('test-fixture-only')
  await page.getByRole('button', { name: 'Delete my account permanently' }).click()
  await page.waitForURL('**/login')
  assert.equal(deletionCalls, 1)
  assert.equal(await page.evaluate(id => localStorage.getItem(`afterlist_queue:${id}`), user.id), null)
  assert.equal(await page.evaluate(() => localStorage.getItem('afterlist_queue:other-owner')), 'other owner data')
  assert.equal(await page.evaluate(() => localStorage.getItem('sb-account-fixture-auth-token')), null)
  await page.close()
 }
 console.log('Account UI: 2 viewport export/download + deletion/local-session isolation checks passed. All account/provider responses intercepted; no hosted claims.')
} finally { await browser.close() }
