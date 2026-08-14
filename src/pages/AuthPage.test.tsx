import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AuthPage from './AuthPage'

const auth = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signInWithGoogle: vi.fn(),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isConfigured: true,
    isLoading: false,
    user: null,
    ...auth,
  }),
}))

describe('AuthPage password recovery', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('requests a reset link without revealing whether the account exists', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AuthPage mode="login" /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Forgot your password?' }))
    await user.type(screen.getByLabelText('Email'), 'viewer@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(auth.requestPasswordReset).toHaveBeenCalledWith('viewer@example.com')
    expect(screen.getByRole('status').textContent).toContain('If an account exists for that email')
  })

  it('associates password mismatch errors with the invalid field and focuses it', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AuthPage mode="signup" /></MemoryRouter>)
    await user.type(screen.getByLabelText('Email'), 'viewer@example.com')
    await user.type(screen.getByLabelText('Password'), 'password-one')
    const confirmation = screen.getByLabelText('Confirm password')
    await user.type(confirmation, 'password-two')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByRole('alert').textContent).toBe('Passwords do not match.')
    expect(confirmation.getAttribute('aria-invalid')).toBe('true')
    expect(confirmation.getAttribute('aria-describedby')).toBe('auth-notice')
    expect(confirmation).toBe(document.activeElement)
  })
})
