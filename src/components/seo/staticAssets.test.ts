/// <reference types="node" />

import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('launch metadata assets', () => {
  it('publishes robots and the intended public sitemap URLs', () => {
    const robots = readFileSync(join(root, 'public', 'robots.txt'), 'utf8')
    const sitemap = readFileSync(join(root, 'public', 'sitemap.xml'), 'utf8')
    expect(robots).toContain('Disallow: /api/')
    expect(robots).toContain('https://afterlist.luckako.uk/sitemap.xml')
    expect(sitemap.match(/<url>/g)).toHaveLength(4)
    expect(sitemap).not.toContain('/settings')
    expect(sitemap).not.toContain('/library')
  })

  it('ships complete generic social and structured metadata', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    const jsonLd = html.match(/<script id="afterlist-structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]
    expect(html).toContain('property="og:image" content="https://afterlist.luckako.uk/og-afterlist.png"')
    expect(html).toContain('name="twitter:card" content="summary_large_image"')
    expect(() => JSON.parse(jsonLd ?? '')).not.toThrow()
  })

  it('keeps the production social image within the agreed size budget', () => {
    const path = join(root, 'public', 'og-afterlist.png')
    const image = statSync(path)
    const png = readFileSync(path)
    expect(image.size).toBeLessThanOrEqual(500_000)
    expect(png.readUInt32BE(16)).toBe(1200)
    expect(png.readUInt32BE(20)).toBe(630)
  })

  it('uses explicit SPA rewrites and leaves unmatched paths to the static 404', () => {
    const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as { rewrites: Array<{ source: string; destination: string }> }
    const notFound = readFileSync(join(root, 'public', '404.html'), 'utf8')
    expect(config.rewrites.some((rewrite) => rewrite.source.includes('(.*)'))).toBe(false)
    expect(config.rewrites).toContainEqual({ source: '/movie/:id/:slug', destination: '/index.html' })
    expect(config.rewrites).toContainEqual({ source: '/user/:username/lists/:listSlug', destination: '/index.html' })
    expect(notFound).toContain('<meta name="robots" content="noindex, nofollow"')
    expect(notFound).toContain('This story isn&rsquo;t on the list.')
  })
})
