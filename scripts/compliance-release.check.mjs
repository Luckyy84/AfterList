import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkRelease } from './compliance-release.mjs'
test('unset preview fails closed', () => {
 const result = checkRelease({})
 assert.equal(result.ready, false)
 assert.ok(result.blockers.includes('Missing VITE_LEGAL_OPERATOR_NAME'))
})
test('public details do not waive outstanding legal review', () => {
 const result = checkRelease({ VITE_LEGAL_OPERATOR_NAME: 'Test Operator', VITE_LEGAL_OPERATOR_ADDRESS: 'Test Address', VITE_LEGAL_CONTACT_EMAIL: 'test@example.test' })
 assert.equal(result.ready, false)
 assert.ok(result.blockers.some(x => x.includes('retention')))
})
test('AniList opt-in needs matching gates and permission', () => {
 const result = checkRelease({ VITE_ANILIST_ENABLED: 'true' })
 assert.ok(result.blockers.some(x => x.includes('AniList')))
})
