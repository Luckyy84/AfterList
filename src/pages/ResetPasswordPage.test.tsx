import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResetPasswordPage from './ResetPasswordPage'

const auth = vi.hoisted(() => ({ updatePassword: vi.fn() }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isConfigured: true,
    isLoading: false,
    session: { access_token: 'recovery-session' },
    ...auth,
  }),
}))

describe('ResetPasswordPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates matching passwords from a recovery session', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>)

    await user.type(screen.getByLabelText('New password'), 'new-password-123')
    await user.type(screen.getByLabelText('Confirm new password'), 'new-password-123')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(auth.updatePassword).toHaveBeenCalledWith('new-password-123')
  })
})
