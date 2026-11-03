import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ signOut: vi.fn(async () => ({ error: null })), getSession: vi.fn(async () => { throw new Error('offline') }), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) }))
vi.mock('../services/supabase', () => ({ isSupabaseConfigured: true, supabase: { auth } }))
import { AuthProvider, useAuth } from './AuthContext'
function State() { const { isLoading } = useAuth(); return <p>{isLoading ? 'loading' : 'ready'}</p> }
afterEach(cleanup)
it('allows deletion cleanup to discard only the local session after server deletion', async () => {
 function Deleted() { const { signOut } = useAuth(); return <button onClick={() => void signOut('local')}>Deleted</button> }
 render(<AuthProvider><Deleted /></AuthProvider>)
 fireEvent.click(screen.getByText('Deleted'))
 await waitFor(() => expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' }))
})
it('exits loading when initial session lookup rejects', async () => {
  render(<AuthProvider><State /></AuthProvider>)
  await waitFor(() => expect(screen.getByText('ready')).not.toBeNull())
})
