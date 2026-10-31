import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import SettingsPage from './SettingsPage'
import { PreferencesProvider } from '../context/PreferencesContext'
vi.mock('motion/react', async () => import('../test/motionMock'))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoading: false, signOut: vi.fn(), user: { id: 'owner' }, session: { access_token: 'session' } }) }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('lets owners explicitly grant write access rather than silently issuing it', async () => {
  const fetcher = vi.fn(async () => Response.json({ tokens: [], token: 'once', integration: { id: 'new', name: 'Reader' } }))
  vi.stubGlobal('fetch', fetcher)
  render(<MemoryRouter initialEntries={['/settings/integrations']}><PreferencesProvider><Routes><Route path="/settings/:section" element={<SettingsPage />} /></Routes></PreferencesProvider></MemoryRouter>)
  expect((screen.getByLabelText('Token access') as HTMLSelectElement).value).toBe('read')
  fireEvent.change(screen.getByLabelText('Token access'), { target: { value: 'write' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create token' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/v1/tokens', expect.objectContaining({ body: JSON.stringify({ name: 'Personal client', scopes: ['watchlist:read', 'watchlist:write'] }) })))
})
