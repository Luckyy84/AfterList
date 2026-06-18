import { useEffect, useState } from 'react'

function getMediaQueryMatches(query: string) {
  if (typeof window === 'undefined') return false

  return window.matchMedia(query).matches
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => getMediaQueryMatches(query))

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mediaQueryList = window.matchMedia(query)
    const handleChange = () => setMatches(mediaQueryList.matches)

    handleChange()
    mediaQueryList.addEventListener('change', handleChange)

    return () => mediaQueryList.removeEventListener('change', handleChange)
  }, [query])

  return matches
}

export function useIsMobile() {
  return useMediaQuery('(max-width: 700px), (hover: none) and (pointer: coarse)')
}
