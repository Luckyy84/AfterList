export const SITE_ORIGIN = 'https://afterlist.luckako.uk'

export type JsonLdValue = string | number | boolean | null | JsonLdValue[] | { [key: string]: JsonLdValue }

export type PageMetadataConfig = {
  title: string
  description: string
  canonicalPath: string
  index: boolean
  jsonLd?: JsonLdValue
}
