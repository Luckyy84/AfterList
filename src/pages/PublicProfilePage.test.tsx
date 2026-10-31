import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPublicProfile, fetchPublicLibrary } from '../services/profiles'
import PublicProfilePage from './PublicProfilePage'

vi.mock('../services/profiles', () => ({ fetchPublicProfile: vi.fn(), fetchPublicLibrary: vi.fn(), fetchPublicList: vi.fn() }))
vi.mock('motion/react', async () => import('../test/motionMock'))
function SearchPath() { const location = useLocation(); return <output>{location.pathname}{location.search}</output> }
function Path() { return <output>{useLocation().pathname}</output> }
afterEach(() => { cleanup(); vi.clearAllMocks() })
describe('PublicProfilePage', () => {
  it('loads the URL-selected public page with previous navigation', async () => {
    vi.mocked(fetchPublicLibrary).mockResolvedValue({ username: 'lucky', displayName: 'Lucky', items: [] })
    render(<MemoryRouter initialEntries={['/user/lucky/library?page=2']}><Routes><Route path="/user/:username/library" element={<PublicProfilePage mode="library" />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole('button', { name: 'Previous page' })).not.toBeNull()
    expect(fetchPublicLibrary).toHaveBeenCalledWith('lucky', expect.any(AbortSignal), 50)
  })
  it('does not offer a phantom next page when the server says the full page is final', async () => {
    const items = Array.from({ length: 50 }, (_, index) => ({ id: String(index), title: `Title ${index}`, type: 'Movie' as const, status: 'Planned' as const, poster: '', backdrop: '', progress: '', rating: '', description: '' }))
    vi.mocked(fetchPublicLibrary).mockResolvedValue({ username: 'lucky', displayName: 'Lucky', items, ...{ hasMore: false, nextOffset: null } })
    render(<MemoryRouter initialEntries={['/user/lucky/library']}><Routes><Route path="/user/:username/library" element={<PublicProfilePage mode="library" />} /></Routes></MemoryRouter>)
    expect((await screen.findByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('keeps pagination when redirecting an old username', async () => {
    vi.mocked(fetchPublicLibrary).mockResolvedValue({ username: 'lucky', displayName: 'Lucky', redirectUsername: 'lucky', items: [] })
    render(<MemoryRouter initialEntries={['/user/old/library?page=2']}><Routes><Route path="/user/:username/library" element={<PublicProfilePage mode="library" />} /></Routes><SearchPath /></MemoryRouter>)
    expect(await screen.findByText('/user/lucky/library?page=2')).not.toBeNull()
  })
  it('renders only the curated signed-out projection', async () => {
    vi.mocked(fetchPublicProfile).mockResolvedValue({ username: 'lucky', displayName: 'Lucky', bio: 'Hello', favorites: [], stats: { watched: 4 } })
    render(<MemoryRouter initialEntries={['/user/lucky']}><Routes><Route path="/user/:username" element={<PublicProfilePage mode="overview" />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Lucky' })).not.toBeNull()
    expect(screen.getByText('4')).not.toBeNull()
    expect(screen.queryByText(/email|private|token/i)).toBeNull()
    await waitFor(() => expect(document.title).toBe('Lucky (@lucky) | AfterList'))
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('index, follow')
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
    expect(screen.getByText('This profile is private or does not exist.')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Browse AfterList' }).getAttribute('href')).toBe('/discover')
    await waitFor(() => expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex, nofollow'))
  })
  it('keeps retry available for temporary failures', async () => {
    const error = Object.assign(new Error('Temporarily unavailable.'), { status: 503 }); vi.mocked(fetchPublicProfile).mockRejectedValue(error)
    render(<MemoryRouter initialEntries={['/user/lucky']}><Routes><Route path="/user/:username" element={<PublicProfilePage mode="overview" />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole('button', { name: 'Try again' })).not.toBeNull()
  })
})
