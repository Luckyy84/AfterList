import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import AccountDeletion from './AccountDeletion'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('requires confirmation and password and surfaces migration errors without signing out', async () => {
  const signOut = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Apply systems_foundation migration.' }, { status: 503 })))
  render(<AccountDeletion accessToken="session" onDeleted={signOut} />)
  expect(screen.getByRole('button', { name: 'Delete my account permanently' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } })
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'correct' } })
  fireEvent.click(screen.getByRole('button', { name: 'Delete my account permanently' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Apply systems_foundation'))
  expect(signOut).not.toHaveBeenCalled()
})
