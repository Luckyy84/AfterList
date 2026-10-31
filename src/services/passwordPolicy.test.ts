import { expect, it } from 'vitest'
import { validateNewPassword } from './passwordPolicy'
it('accepts long passphrases and rejects short or oversized passwords', () => {
  expect(() => validateNewPassword('short')).toThrow(/12/)
  expect(() => validateNewPassword('x'.repeat(1025))).toThrow(/1024/)
  expect(() => validateNewPassword('a long unique passphrase')).not.toThrow()
})
