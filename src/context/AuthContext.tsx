import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../services/supabase'
import { AuthContext } from './auth'
import type { AuthContextValue } from './auth'

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setSession(data.session)
      setIsLoading(false)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    return {
      isConfigured: isSupabaseConfigured,
      isLoading,
      session,
      user: session?.user ?? null,
      async signIn(email, password) {
        if (!supabase) throw new Error('Supabase is not configured yet.')

        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        setSession(data.session)
        return data.session
      },
      async signUp(email, password, displayName) {
        if (!supabase) throw new Error('Supabase is not configured yet.')

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: displayName ? { display_name: displayName } : undefined,
          },
        })

        if (error) throw error

        setSession(data.session)
        return data.session
      },
      async signInWithGoogle() {
        if (!supabase) throw new Error('Supabase is not configured yet.')

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        })

        if (error) throw error
      },
      async signOut() {
        if (!supabase) return

        const { error } = await supabase.auth.signOut()
        if (error) throw error

        setSession(null)
      },
    }
  }, [isLoading, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
