import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchOwnProfile } from '../services/profiles'
import type { OwnProfile } from '../types/profile'

export function useOwnProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<OwnProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const refresh = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try { setProfile(await fetchOwnProfile(user.id)) } finally { setIsLoading(false) }
  }, [user])
  useEffect(() => { if (user) void Promise.resolve().then(refresh) }, [refresh, user])
  return { profile: user ? profile : null, isLoading, refresh, setProfile }
}
