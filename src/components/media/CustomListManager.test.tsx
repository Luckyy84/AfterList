import { act, cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { fetchOwnProfile } from '../../services/profiles'
afterEach(() => { cleanup(); vi.clearAllMocks(); auth.user = { id: 'owner' } })
import CustomListManager from './CustomListManager'
const api = vi.hoisted(() => ({ fetchCustomLists: vi.fn(), fetchCustomListItems: vi.fn(), saveCustomListItems: vi.fn(), reorderCustomLists: vi.fn(), createCustomList: vi.fn(), libraryError: (e: Error) => e.message }))
vi.mock('../../services/mediaLibrary', () => api)
vi.mock('../../services/profiles', () => ({ fetchOwnProfile: vi.fn(async () => null), setCustomListPublic: vi.fn() }))
const auth = vi.hoisted(() => ({ user: { id: 'owner' } as { id: string } | null }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }))
it('bulk selects titles and saves their explicit ordering', async () => {
  api.fetchCustomLists.mockResolvedValue([{ id: 'list', name: 'Weekend', slug: 'weekend', is_public: false }])
  api.fetchCustomListItems.mockResolvedValue([])
  api.saveCustomListItems.mockResolvedValue(['one'])
  render(<CustomListManager items={[{ id: 'one', title: 'One', type: 'Movie', status: 'Planned', poster: '', backdrop: '', progress: '', rating: '', description: '' }]} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Weekend' }))
  fireEvent.click(await screen.findByLabelText('Include One'))
  fireEvent.click(screen.getByText('Save ordered selection'))
  await waitFor(() => expect(api.saveCustomListItems).toHaveBeenCalledWith('list', ['one']))
  expect(await screen.findByText('List saved.')).toBeTruthy()
})

it.each(['switch', 'signout'] as const)('isolates private editor state on %s, including late A callbacks and failed B loading', async (transition) => {
  const privateList = { id: 'a-list', name: 'A private name', slug: 'private', is_public: true }
  api.fetchCustomLists.mockImplementation(async (owner: string) => {
    if (owner === 'owner') return [privateList]
    throw new Error('B load failed')
  })
  vi.mocked(fetchOwnProfile).mockResolvedValue({ is_public: true, username: 'a-profile' } as Awaited<ReturnType<typeof fetchOwnProfile>>)
  api.fetchCustomListItems.mockResolvedValue(['secret'])
  let finishCreate!: (value: typeof privateList) => void
  api.createCustomList.mockReturnValue(new Promise((resolve) => { finishCreate = resolve }))
  const view = () => <MemoryRouter><CustomListManager items={[]} /></MemoryRouter>
  const { rerender } = render(view())
  fireEvent.click(await screen.findByRole('button', { name: 'Edit A private name' }))
  expect(await screen.findByRole('region', { name: 'Edit A private name' })).toBeTruthy()
  expect(screen.getByRole('link').getAttribute('href')).toContain('a-profile')
  fireEvent.change(screen.getByLabelText('New list name'), { target: { value: 'A pending draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create list' }))
  auth.user = transition === 'switch' ? { id: 'b' } : null
  rerender(view())
  expect(screen.queryAllByText('A private name')).toHaveLength(0)
  expect(screen.queryByRole('region', { name: 'Edit A private name' })).toBeNull()
  if (transition === 'signout') {
    expect(screen.queryByText('Manage custom lists')).toBeNull()
    auth.user = { id: 'b' }
    rerender(view())
  }
  await screen.findByText('B load failed')
  await act(async () => { finishCreate({ ...privateList, id: 'late', name: 'A late private name' }) })
  expect(screen.queryByText('A late private name')).toBeNull()
  expect(screen.queryByRole('link')).toBeNull()
  expect((screen.getByLabelText('New list name') as HTMLInputElement).value).toBe('')
  expect(screen.queryByText('Title not loaded (retained)')).toBeNull()
  expect((screen.getByRole('button', { name: 'Create list' }) as HTMLButtonElement).disabled).toBe(false)
})
