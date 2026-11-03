import { Link } from 'react-router-dom'
import { motion } from 'motion/react'

type LegalPageProps = { type: 'privacy' | 'terms' | 'imprint' | 'credits' }
const titles = { privacy: 'Privacy Policy', terms: 'Terms of Use', imprint: 'Imprint / Operator', credits: 'About & Credits' }
const sections: Record<LegalPageProps['type'], [string, string][]> = {
  privacy: [
    ['Information processed', 'Guests store watchlists in their browser. Accounts process email, account identifiers, authentication credentials and sessions, titles, ratings, private notes, viewing and episode progress, history, custom lists and memberships, profile names/bios/avatars, visibility settings and integration-token metadata. Do not enter sensitive personal information in notes or profiles. Profiles and lists start private; explicitly publishing them makes selected fields visible to anyone, including search engines. Private notes are excluded from public projections. Uploaded avatars can be publicly retrievable by URL.'],
    ['Purposes and proposed legal bases', 'Requested login, sync, progress, list management, export and deletion are intended to rely on GDPR Article 6(1)(b), where necessary to provide the agreed service. Hosting, abuse prevention and security logging are intended to rely on Article 6(1)(f), the legitimate interest in operating a secure service, subject to an operator assessment and your right to object. Optional public sharing needs a basis assessment for the actual service and audience before launch. Any processing actually based on consent requires Article 6(1)(a) and withdrawal. These are proposed mappings, not verified operator decisions: capacity, child-user requirements and actual purposes must be confirmed before public release. No advertising or optional traffic analytics is integrated in this review version.'],
    ['Browser storage and offline use', 'Vercel Web Analytics has been removed. Storage is not limited to cookies: localStorage holds guest lists and legacy recency markers (afterlist_items and afterlist_items_unknown_recency), requested display preferences (afterlist_preferences), Supabase auth sessions (sb-…-auth-token), and owner-specific pending edits (afterlist_queue:USER_ID), potentially including private notes. Successful sync removes pending edits. Sign-out does not erase unsynced queues. Account deletion clears this browser’s deleted-owner queue and local session, not other users’ data. Clear site data on shared devices, understanding that unsynced edits will be lost. The production service worker caches same-origin app-shell/static responses, not API or cross-origin image responses. Necessary storage for an expressly requested service needs a separate assessment from optional terminal access under applicable law, including TDDDG section 25 where relevant; cookie-free does not automatically mean consent-free.'],
    ['Providers, direct artwork requests and transfers', 'Vercel hosts the app and server routes and can receive IP addresses, request URLs and technical/security logs. Supabase handles authentication, database and avatar storage; configured authentication email delivery can involve Resend as SMTP provider. If you choose Google sign-in, Google also processes the sign-in request and provides account identity information to Supabase. TMDB supplies search and title metadata through server routes. Browsers request artwork directly from image.tmdb.org and stored artwork hosts for existing provider-backed items; those hosts receive IP addresses and browser/request information. AniList upstream requests are disabled by default pending documented permission, without deleting saved items. Provider roles, agreements, subprocessors, locations and international-transfer safeguards have not been verified for this review. Before release the operator must document applicable Article 28 agreements and Chapter V safeguards, such as an applicable adequacy decision or standard contractual clauses with necessary assessments. An EU database region alone does not establish that all processing stays in the EU.'],
    ['Retention and erasure limits', 'Guest lists and preferences persist until removed or site storage is cleared. Account records persist while needed for the requested service; removing a title can leave history or a sync tombstone. Reauthenticated account deletion removes owned live records and storage through the configured backend and database migrations. Other devices’ unsynced storage needs clearing on those devices. No verified time limits for history, tombstones, security/mail logs or backup expiry are available yet. Provider logs and backups can outlast live deletion; actual schedules, lawful exceptions and restoration/deletion procedures must be established before release. Immediate erasure from every backup or third-party cache is not promised.'],
    ['Your rights and private requests', 'Where GDPR applies, you have rights of access, correction, erasure, restriction, portability where applicable, and objection to legitimate-interest processing. You may complain to a supervisory authority, particularly in your habitual residence, place of work or place of the alleged infringement. If processing relies on consent, you can withdraw it without affecting earlier lawful processing. Account settings offer a structured export and reauthenticated deletion; export does not cover provider logs, backups or uploaded image bytes. Use the private controller contact below for additional requests or assistance, not public GitHub issues. Identity checks must be proportionate; never send passwords or tokens. A functioning private contact remains a release prerequisite.'],
    ['Security and changes', 'Owner access is protected by authentication and database row-level security; public sharing uses restricted projections. No internet service guarantees absolute security. Material processing changes require updated notices and any legally required consent or other arrangements before they take effect.'],
  ],
  imprint: [
    ['Operator information pending', 'Public release is blocked until the actual operator and lawful private contact arrangements are confirmed. No personal details are inferred or published automatically. Establishment, jurisdiction, legal form, representation, registration/tax information where applicable, revenue model, operator capacity and applicable DDG/MStV duties need human assessment. Educational purpose alone does not establish an exemption. Supply additional legally required details through the public operator information configuration before release.'],
  ],
  credits: [
    ['The Movie Database (TMDB)', 'This product uses the TMDB API but is not endorsed or certified by TMDB. TMDB provides title metadata and artwork. Free API use is subject to attribution and non-commercial use; a commercial licence may be required depending on the actual business model, which has not been established. TMDB does not claim ownership of every image or data item. Attribution does not settle all third-party rights.'],
    ['Other provider-backed records', 'Saved libraries may contain AniList-backed records. AniList upstream access is disabled by default pending documented permission for this tracker; educational use does not waive its competing-tracker restriction. If enabled after permission, AniList supplies the corresponding metadata and imagery. No watch-provider availability integration is currently used.'],
  ],
  terms: [
    ['Review status', 'These are proposed terms for review, not a declaration that this service is legally ready for public release. Actual operator, jurisdiction, audience and commercial model remain unresolved. Mandatory legal rights are not waived by this notice.'],
    ['Use and accounts', 'AfterList tracks anime, movies and television. Protect your credentials and do not store unlawful or sensitive content, interfere with the service, bypass security or access another person’s data. Use the configured private operator contact for account security concerns.'],
    ['Media and providers', 'Media metadata and artwork are subject to provider terms and third-party rights. See About & Credits for TMDB attribution and provider restrictions. An educational label does not grant a general licence.'],
    ['Availability, termination and liability', 'Development can change availability. Keep an independent copy of data you cannot afford to lose. Account settings provide export and deletion. Suspension and any limitation of liability must comply with applicable mandatory law. Specific liability, termination and consumer-law provisions require qualified operator-specific review before release; this notice does not exclude statutory liability.'],
    ['Updates', 'Changes must follow applicable notice and agreement requirements. Continued use alone is not treated here as a waiver of mandatory rights.'],
  ],
}

export default function LegalPage({ type }: LegalPageProps) {
  const operator = import.meta.env.VITE_LEGAL_OPERATOR_NAME?.trim()
  const email = import.meta.env.VITE_LEGAL_CONTACT_EMAIL?.trim()
  const address = import.meta.env.VITE_LEGAL_OPERATOR_ADDRESS?.trim()
  const details = import.meta.env.VITE_LEGAL_OPERATOR_DETAILS?.trim()
  const validEmail = email && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)
  return (
    <motion.section className="legal-page glass-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
      <p className="eyebrow">AfterList information</p>
      <h1>{titles[type]}</h1>
      <p className="legal-updated">Review version: November 3, 2026 — public release not cleared</p>
      {type === 'credits' && <a href="https://www.themoviedb.org/"><img src="/tmdb-logo.svg" alt="TMDB — The Movie Database" width="140" height="60" style={{ objectFit: 'contain' }} /></a>}
      <div className="legal-sections">
        {sections[type].map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}
      </div>
      {type !== 'credits' && <section className="legal-note" aria-label="Controller and private contact">
        <h2>Controller and private contact</h2>
        {operator ? <p>{operator}</p> : <p>Controller information is not configured. This preview is not ready for public release.</p>}
        {address ? <p style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{address}</p> : <p>Operator postal information is not configured.</p>}
        {validEmail ? <a style={{ overflowWrap: 'anywhere' }} href={`mailto:${email}`}>{email}</a> : <p>Private contact is not configured. Do not send personal data through public issues.</p>}
        {details && <p style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{details}</p>}
        <p>Operational and legal verification is still required. This review notice does not waive law or certify compliance.</p>
      </section>}
      <Link className="legal-back-link" to="/">Back to AfterList</Link>
    </motion.section>
  )
}
