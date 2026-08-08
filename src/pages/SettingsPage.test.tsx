import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SettingsPage from './SettingsPage'
import { PreferencesProvider } from '../context/PreferencesContext'

vi.mock('motion/react', () => ({ motion: { section: 'section' } }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isLoading: false, signOut: vi.fn(), user: null }),
}))

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('SettingsPage', () => {
  it('gives guests a real settings destination without requiring an account', () => {
    render(<MemoryRouter initialEntries={['/settings/account']}><PreferencesProvider><Routes><Route path="/settings/:section" element={<SettingsPage />} /></Routes></PreferencesProvider></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Settings' })).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Account' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Sign in for cloud sync' })).not.toBeNull()
    expect(screen.getByText('Saved in this browser')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Library' }).getAttribute('href')).toBe('/settings/library')
    expect(screen.getByRole('link', { name: 'Integrations' }).getAttribute('href')).toBe('/settings/integrations')
  })

  it('persists library and appearance preferences', () => {
    render(<MemoryRouter initialEntries={['/settings/library']}><PreferencesProvider><Routes><Route path="/settings/:section" element={<SettingsPage />} /></Routes></PreferencesProvider></MemoryRouter>)

    fireEvent.change(screen.getByRole('combobox', { name: 'Default library sorting' }), { target: { value: 'title' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Favorites only by default' }))
    fireEvent.click(screen.getByRole('link', { name: 'Appearance' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Card density' }), { target: { value: 'compact' } })

    expect(JSON.parse(localStorage.getItem('afterlist_preferences') ?? '{}')).toMatchObject({
      librarySort: 'title',
      cardDensity: 'compact',
      favoritesOnly: true,
    })
  })

  it('exports a complete JSON library backup', () => {
    const createObjectURL = vi.fn(() => 'blob:export')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    render(<MemoryRouter initialEntries={['/settings/library']}><PreferencesProvider><Routes><Route path="/settings/:section" element={<SettingsPage items={[{ id: '1', title: 'Private', type: 'Movie', status: 'Paused', poster: '', backdrop: '', progress: '', rating: '', description: '', privateNotes: 'owner only' }]} />} /></Routes></PreferencesProvider></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }))
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export')
  })
})
