import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { claimUsername } from '../services/profiles'
import { ProfileSettings } from './SettingsPage'

vi.mock('motion/react', () => ({ motion: { section: 'section' } }))
vi.mock('../services/profiles', () => ({ claimUsername: vi.fn(), saveOwnProfile: vi.fn(), setCustomListPublic: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
describe('ProfileSettings', () => {
  it('blocks invalid usernames before calling the claim RPC', async () => {
    render(<ProfileSettings userId="u1" profile={null} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Username' }), 'no spaces')
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText(/Username must be/)).not.toBeNull()
    expect(claimUsername).not.toHaveBeenCalled()
  })
  it('surfaces duplicate or reserved username failures', async () => {
    vi.mocked(claimUsername).mockRejectedValue(new Error('Username is unavailable'))
    render(<ProfileSettings userId="u1" profile={null} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Username' }), 'taken_name')
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText('Username is unavailable')).not.toBeNull()
  })
})
