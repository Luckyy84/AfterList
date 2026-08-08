/* eslint-disable react-refresh/only-export-components -- provider and its typed hook form one public preferences API */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type LibrarySort = 'recent' | 'title' | 'rating'
export type LibraryStatus = 'All' | 'Planned' | 'Watching' | 'Paused' | 'Watched' | 'Dropped'
export type CardDensity = 'comfortable' | 'compact'
export type MotionPreference = 'system' | 'reduced' | 'full'

export type Preferences = {
  librarySort: LibrarySort
  libraryStatus: LibraryStatus
  favoritesOnly: boolean
  cardDensity: CardDensity
  motion: MotionPreference
}

const STORAGE_KEY = 'afterlist_preferences'
const defaults: Preferences = {
  librarySort: 'recent',
  libraryStatus: 'All',
  favoritesOnly: false,
  cardDensity: 'comfortable',
  motion: 'system',
}

function readPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Preferences>
    return { ...defaults, ...stored }
  } catch {
    return defaults
  }
}

type PreferencesContextValue = {
  preferences: Preferences
  updatePreference: <Key extends keyof Preferences>(key: Key, value: Preferences[Key]) => void
  resetPreferences: () => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(readPreferences)

  const value = useMemo<PreferencesContextValue>(() => ({
    preferences,
    updatePreference: (key, nextValue) => {
      setPreferences((current) => {
        const next = { ...current, [key]: nextValue }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return next
      })
    },
    resetPreferences: () => {
      localStorage.removeItem(STORAGE_KEY)
      setPreferences(defaults)
    },
  }), [preferences])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider.')
  return value
}
