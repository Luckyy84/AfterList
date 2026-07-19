import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SettingsPage from './SettingsPage'

vi.mock('motion/react', () => ({ motion: { section: 'section' } }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isLoading: false, signOut: vi.fn(), user: null }),
}))

afterEach(cleanup)

describe('SettingsPage', () => {
  it('gives guests a real settings destination without requiring an account', () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Settings' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Sign in for cloud sync' })).not.toBeNull()
    expect(screen.getByText('Saved in this browser')).not.toBeNull()
    expect(screen.getByText('Follows reduced-motion settings')).not.toBeNull()
  })
})
