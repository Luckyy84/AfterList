import { describe, expect, it } from 'vitest'
import { integrationTokenExpiresAt } from './tokens'

describe('integration token expiry', () => {
  it('sets a deterministic 90-day lifetime', () => {
    const issuedAt = Date.UTC(2026, 7, 7, 12)

    expect(integrationTokenExpiresAt(issuedAt)).toBe('2026-11-05T12:00:00.000Z')
  })
})
