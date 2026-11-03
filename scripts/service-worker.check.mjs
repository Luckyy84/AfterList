import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
test('service worker does not retain account URLs or authentication query strings', () => {
 const handlers = {}
 const context = { self: { location: { origin: 'https://local.test' }, addEventListener: (event, handler) => { handlers[event] = handler } }, URL, fetch: async () => ({ ok: false }) }
 vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), context)
 for (const path of ['/reset-password?code=secret', '/?code=secret', '/settings/account', '/user/private-name', '/api/account/export']) {
  let intercepted = false
  handlers.fetch({ request: { method: 'GET', url: `https://local.test${path}`, mode: 'navigate' }, respondWith: () => { intercepted = true } })
  assert.equal(intercepted, false, path)
 }
})
