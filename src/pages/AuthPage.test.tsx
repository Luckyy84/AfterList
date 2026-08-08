import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('requests a reset link without revealing whether the account exists', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AuthPage mode="login" /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Forgot your password?' }))
    await user.type(screen.getByLabelText('Email'), 'viewer@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(auth.requestPasswordReset).toHaveBeenCalledWith('viewer@example.com')
    expect(screen.getByText('If an account exists for that email, a password reset link is on its way.')).not.toBeNull()
  })
})
