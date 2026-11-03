import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Human facts cannot be self-certified by toggling an environment variable.
export function checkRelease(env) {
  const blockers = []
  for (const key of ['VITE_LEGAL_OPERATOR_NAME', 'VITE_LEGAL_OPERATOR_ADDRESS', 'VITE_LEGAL_CONTACT_EMAIL']) {
    const value = env[key]?.trim()
    if (!value) blockers.push(`Missing ${key}`)
    else if (/placeholder|todo|example\.|your[ _-]|unset/i.test(value)) blockers.push(`Placeholder ${key}`)
  }
  if (env.VITE_LEGAL_CONTACT_EMAIL && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(env.VITE_LEGAL_CONTACT_EMAIL.trim())) blockers.push('Invalid private contact email')
  if (env.ANILIST_ENABLED === 'true' || env.VITE_ANILIST_ENABLED === 'true') {
    if (env.ANILIST_ENABLED !== 'true' || env.VITE_ANILIST_ENABLED !== 'true' || !env.ANILIST_PERMISSION_REFERENCE?.trim()) blockers.push('AniList opt-in requires both gates and documented permission')
    blockers.push('AniList permission scope, attribution and storage terms require human verification before enabling')
  }
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  if (/Analytics|@vercel\/analytics/.test(app) || pkg.dependencies?.['@vercel/analytics']) blockers.push('Unsafe optional analytics integration')
  blockers.push('Unresolved operator establishment, jurisdiction, revenue and contractual capacity/child-user assessment')
  blockers.push('Unverified processor agreements, subprocessors and international-transfer safeguards')
  blockers.push('Unverified retention schedules for history, tombstones, backups and security/mail logs')
  blockers.push('Operator-specific legal review of purpose/basis, imprint, liability and update clauses required')
  return { ready: false, status: 'BLOCKED', blockers, note: 'Software verification is not legal clearance. Resolve evidence in docs/COMPLIANCE_REVIEW.md and review this gate; no environment-only override.' }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(checkRelease(process.env), null, 2))
  process.exitCode = 1
}
