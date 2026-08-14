import { cleanup, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import RouteMetadata from './RouteMetadata'

afterEach(() => {
  cleanup()
  document.head.innerHTML = ''
  document.title = ''
})

describe('RouteMetadata', () => {
  it('indexes the public discovery route with a stable canonical URL', async () => {
    render(<MemoryRouter initialEntries={['/discover']}><RouteMetadata /></MemoryRouter>)
    await waitFor(() => expect(document.title).toBe('Discover Anime, Movies & TV | AfterList'))
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('index, follow')
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe('https://afterlist.luckako.uk/discover')
  })

  it('marks personal settings routes noindex', async () => {
    render(<MemoryRouter initialEntries={['/settings/privacy']}><RouteMetadata /></MemoryRouter>)
    await waitFor(() => expect(document.title).toBe('Privacy settings | AfterList'))
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex, nofollow')
  })
})
