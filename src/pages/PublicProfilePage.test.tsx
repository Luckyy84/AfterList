import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPublicProfile } from '../services/profiles'
import PublicProfilePage from './PublicProfilePage'

vi.mock('../services/profiles', () => ({ fetchPublicProfile: vi.fn(), fetchPublicLibrary: vi.fn(), fetchPublicList: vi.fn() }))
vi.mock('motion/react', () => ({ motion: { article: 'article' } }))
function Path() { return <output>{useLocation().pathname}</output> }
afterEach(() => { cleanup(); vi.clearAllMocks() })
describe('PublicProfilePage', () => {
  it('renders only the curated signed-out projection', async () => {
    vi.mocked(fetchPublicProfile).mockResolvedValue({ username: 'lucky', displayName: 'Lucky', bio: 'Hello', favorites: [], stats: { watched: 4 } })
    render(<MemoryRouter initialEntries={['/user/lucky']}><Routes><Route path="/user/:username" element={<PublicProfilePage mode="overview" />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Lucky' })).not.toBeNull()
    expect(screen.getByText('4')).not.toBeNull()
    expect(screen.queryByText(/email|private|token/i)).toBeNull()
  })
  it('replaces old username routes with the canonical username', async () => {
    vi.mocked(fetchPublicProfile).mockResolvedValue({ username: 'lucky', displayName: 'Lucky', redirectUsername: 'lucky' })
    render(<MemoryRouter initialEntries={['/user/OLD']}><Routes><Route path="/user/:username" element={<PublicProfilePage mode="overview" />} /></Routes><Path /></MemoryRouter>)
    expect(await screen.findByText('/user/lucky')).not.toBeNull()
  })
  it('uses the same unavailable state for private and missing profiles', async () => {
    const error = Object.assign(new Error('Profile not found or private.'), { status: 404 }); vi.mocked(fetchPublicProfile).mockRejectedValue(error)
    render(<MemoryRouter initialEntries={['/user/hidden']}><Routes><Route path="/user/:username" element={<PublicProfilePage mode="overview" />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Profile unavailable' })).not.toBeNull()
    expect(screen.getByText('Profile not found or private.')).not.toBeNull()
  })
})
