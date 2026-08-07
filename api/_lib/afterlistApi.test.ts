import { describe, expect, it } from 'vitest'
import { generateToken, hashToken } from './afterlistApi'

describe('integration tokens', () => {
  it('generates high-entropy tokens and stores a stable SHA-256 hash', () => {
    const first = generateToken()
    const second = generateToken()
    expect(first).toMatch(/^aft_[A-Za-z0-9_-]{43}$/)
    expect(second).not.toBe(first)
    expect(hashToken(first)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashToken(first)).toBe(hashToken(first))
  })
})
