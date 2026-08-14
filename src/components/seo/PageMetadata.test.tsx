import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import PageMetadata from './PageMetadata'
import { SITE_ORIGIN } from './metadata'

afterEach(() => {
  cleanup()
  document.head.innerHTML = ''
  document.title = ''
})

describe('PageMetadata', () => {
  it('sets canonical, indexing, social, and structured metadata', async () => {
    render(<PageMetadata config={{
      title: 'Fight Club (1999) | AfterList',
      description: '  A movie   description. ',
      canonicalPath: '/movie/550/fight-club',
      index: true,
      jsonLd: { '@context': 'https://schema.org', '@type': 'Movie', name: 'Fight Club' },
    }} />)

    await waitFor(() => expect(document.title).toBe('Fight Club (1999) | AfterList'))
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(`${SITE_ORIGIN}/movie/550/fight-club`)
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('index, follow')
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe('A movie description.')
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content).toBe(`${SITE_ORIGIN}/movie/550/fight-club`)
    expect(document.querySelector('#afterlist-page-jsonld')?.textContent).toContain('Fight Club')
  })

  it('marks private pages noindex and restores prior metadata after unmount', async () => {
    document.title = 'AfterList'
    const { unmount } = render(<PageMetadata config={{ title: 'Settings | AfterList', description: 'Private settings.', canonicalPath: '/settings', index: false }} />)
    await waitFor(() => expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex, nofollow'))
    unmount()
    expect(document.title).toBe('AfterList')
    expect(document.querySelector('meta[name="robots"]')).toBeNull()
  })
})
