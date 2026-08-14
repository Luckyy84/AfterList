import { useEffect } from 'react'
import { SITE_ORIGIN, type PageMetadataConfig } from './metadata'

function normalizedDescription(value: string) {
  const description = value.replace(/\s+/g, ' ').trim()
  return description.length > 160 ? `${description.slice(0, 157).trimEnd()}...` : description
}

function canonicalUrl(path: string) {
  return new URL(path.startsWith('/') ? path : `/${path}`, SITE_ORIGIN).href
}

function ensureMeta(attribute: 'name' | 'property', value: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${value}"]`)
  const created = !element
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, value)
    document.head.append(element)
  }
  return { element, created, previousContent: element.content }
}

function ensureCanonical() {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  const created = !element
  if (!element) {
    element = document.createElement('link')
    element.rel = 'canonical'
    document.head.append(element)
  }
  return { element, created, previousHref: element.href }
}

function usePageMetadata(config: PageMetadataConfig | null) {
  const title = config?.title ?? ''
  const rawDescription = config?.description ?? ''
  const canonicalPath = config?.canonicalPath ?? '/'
  const indexable = config?.index ?? false
  const hasConfig = Boolean(config)
  const serializedJsonLd = config?.jsonLd
    ? JSON.stringify(config.jsonLd).replace(/</g, '\\u003c')
    : ''

  useEffect(() => {
    if (!hasConfig) return undefined

    const description = normalizedDescription(rawDescription)
    const url = canonicalUrl(canonicalPath)
    const previousTitle = document.title
    const canonical = ensureCanonical()
    const managedMeta = [
      { ...ensureMeta('name', 'description'), content: description },
      { ...ensureMeta('name', 'robots'), content: indexable ? 'index, follow' : 'noindex, nofollow' },
      { ...ensureMeta('property', 'og:title'), content: title },
      { ...ensureMeta('property', 'og:description'), content: description },
      { ...ensureMeta('property', 'og:url'), content: url },
      { ...ensureMeta('name', 'twitter:title'), content: title },
      { ...ensureMeta('name', 'twitter:description'), content: description },
    ]

    document.title = title
    canonical.element.href = url
    managedMeta.forEach(({ element, content }) => { element.content = content })

    let jsonLd: HTMLScriptElement | null = null
    if (serializedJsonLd) {
      jsonLd = document.createElement('script')
      jsonLd.id = 'afterlist-page-jsonld'
      jsonLd.type = 'application/ld+json'
      jsonLd.text = serializedJsonLd
      document.head.append(jsonLd)
    }

    return () => {
      document.title = previousTitle
      if (canonical.created) canonical.element.remove()
      else canonical.element.href = canonical.previousHref
      managedMeta.forEach(({ element, created, previousContent }) => {
        if (created) element.remove()
        else element.content = previousContent
      })
      jsonLd?.remove()
    }
  }, [canonicalPath, hasConfig, indexable, rawDescription, serializedJsonLd, title])
}

export default function PageMetadata({ config }: { config: PageMetadataConfig | null }) {
  usePageMetadata(config)
  return null
}
