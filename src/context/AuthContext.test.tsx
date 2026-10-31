import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ getSession: vi.fn(async () => { throw new Error('offline') }), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) }))
vi.mock('../services/supabase', () => ({ isSupabaseConfigured: true, supabase: { auth } }))
import { AuthProvider, useAuth } from './AuthContext'
function State() { const { isLoading } = useAuth(); return <p>{isLoading ? 'loading' : 'ready'}</p> }
afterEach(cleanup)
it('exits loading when initial session lookup rejects', async () => {
  render(<AuthProvider><State /></AuthProvider>)
  await waitFor(() => expect(screen.getByText('ready')).not.toBeNull())
})
