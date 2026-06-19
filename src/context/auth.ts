import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthContextValue = {
  isConfigured: boolean
  isLoading: boolean
  session: Session | null
  user: User | null
  signIn: (email: string, password: string) => Promise<Session | null>
  signUp: (email: string, password: string, displayName?: string) => Promise<Session | null>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
