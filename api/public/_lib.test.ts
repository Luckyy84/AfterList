import { afterEach, describe, expect, it, vi } from 'vitest'
import { boundedInteger, publicJson, publicProfilesEnabled, rateLimit, validListSlug, validUsername } from './_lib'

afterEach(() => vi.unstubAllEnvs())

describe('public profile API helpers', () => {
  it('fails closed unless public profiles are explicitly enabled', () => {
    const original = process.env.PUBLIC_PROFILES_ENABLED
    delete process.env.PUBLIC_PROFILES_ENABLED
    expect(publicProfilesEnabled()).toBe(false)
    if (original === undefined) delete process.env.PUBLIC_PROFILES_ENABLED
    else process.env.PUBLIC_PROFILES_ENABLED = original
    vi.stubEnv('PUBLIC_PROFILES_ENABLED', '')
    expect(publicProfilesEnabled()).toBe(false)
    vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'false')
    expect(publicProfilesEnabled()).toBe(false)
    vi.stubEnv('PUBLIC_PROFILES_ENABLED', ' TRUE ')
    expect(publicProfilesEnabled()).toBe(true)
  })

  it('validates public identifiers and pagination bounds', () => {
    expect(validUsername('luckyyyyyyuyyyuy')).toBe(true)
    expect(validUsername('Bad-Name')).toBe(false)
    expect(validListSlug('summer-favorites')).toBe(true)
    expect(validListSlug('../private')).toBe(false)
    expect(boundedInteger('100', 50, 1, 100)).toBe(100)
    expect(boundedInteger('101', 50, 1, 100)).toBeNull()
    expect(boundedInteger(null, 50, 1, 100)).toBe(50)
  })

  it('never caches privacy-controlled responses', () => {
    expect(publicJson({ ok: true }).headers.get('cache-control')).toBe('no-store')
    expect(publicJson({ error: 'no' }, 404).headers.get('cache-control')).toBe('no-store')
  })

  it('applies a best-effort per-route and IP rate limit', () => {
    const request = new Request('http://localhost', { headers: { 'x-forwarded-for': '203.0.113.42' } })
    for (let index = 0; index < 60; index += 1) expect(rateLimit(request, 'helper-test')).toBeNull()
    expect(rateLimit(request, 'helper-test')).toBeGreaterThan(0)
  })
})
