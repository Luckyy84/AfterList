import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppNav from './AppNav'

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ isLoading: false, signOut: vi.fn(), user: { email: 'lucky@example.com', user_metadata: { display_name: 'Lucky' } } }) }))
vi.mock('../search/SearchAddModal', () => ({ default: () => null }))
vi.mock('motion/react', async () => import('../../test/motionMock'))
afterEach(cleanup)

describe('AppNav profile destination', () => {
  it('sends private profile owners to settings', async () => {
    render(<MemoryRouter><AppNav items={[]} onCreate={vi.fn()} onOpenExisting={vi.fn()} profileUsername="lucky" profileIsPublic={false} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /Open account menu/ }))
    expect(screen.getByRole('menuitem', { name: 'Profile settings' }).getAttribute('href')).toBe('/settings/profile')
  })

  it('links published owners to their public profile', async () => {
    render(<MemoryRouter><AppNav items={[]} onCreate={vi.fn()} onOpenExisting={vi.fn()} profileUsername="lucky" profileIsPublic /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /Open account menu/ }))
    expect(screen.getByRole('menuitem', { name: 'Profile' }).getAttribute('href')).toBe('/user/lucky')
  })
})
