import { afterEach, describe, expect, it } from 'vitest'
import { loadDefaultStatus, loadReducedMotion, saveDefaultStatus, saveReducedMotion } from './preferences'

afterEach(() => localStorage.clear())

describe('preferences', () => {
  it('uses safe defaults and persists valid choices', () => {
    localStorage.setItem('afterlist-default-status', 'invalid')
    expect(loadDefaultStatus()).toBe('Planned')
    saveDefaultStatus('Watching')
    saveReducedMotion(true)
    expect(loadDefaultStatus()).toBe('Watching')
    expect(loadReducedMotion()).toBe(true)
  })
})
