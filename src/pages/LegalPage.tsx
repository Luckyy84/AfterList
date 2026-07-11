import { Link } from 'react-router-dom'
import { motion } from 'motion/react'

type LegalPageProps = {
  type: 'privacy' | 'terms'
}

const legalCopy = {
  privacy: {
    eyebrow: 'Privacy policy',
    title: 'Privacy Policy',
    updated: 'Last updated: July 11, 2026',
    intro:
      'This policy explains what AfterList stores, why it is used, which services receive it, and the choices available to you.',
    sections: [
      {
        title: 'Information we process',
        body:
          'Guests store watchlist items in this browser through localStorage. If you create an account, Supabase processes your email, account identifier, authentication session, and saved watchlist data so your list can sync across devices. AfterList does not ask for your legal name, address, payment details, or private notes.',
      },
      {
        title: 'How the information is used',
        body:
          'Account and watchlist data is used to provide login, cloud sync, favorites, ratings, and viewing progress. Technical information may be used to keep the service reliable, prevent misuse, and understand anonymous traffic. AfterList does not sell personal information or use it for targeted advertising.',
      },
      {
        title: 'Cookies and browser storage',
        body:
          'AfterList does not use advertising cookies or third-party tracking cookies. Vercel Web Analytics is configured as cookie-free, aggregated analytics. Essential browser storage is used for guest watchlists and signed-in authentication sessions; without it, those requested features cannot work. Because no optional cookies are currently used, AfterList does not show a cookie-consent banner.',
      },
      {
        title: 'Service providers',
        body:
          'Supabase provides authentication and cloud database services. Vercel hosts the app and provides anonymous web analytics. TMDB supplies media search results, artwork, ratings, and title details through AfterList server routes. These providers may process technical data under their own privacy terms.',
      },
      {
        title: 'Retention and deletion',
        body:
          'Guest watchlists remain in your browser until you remove them or clear site storage. Signed-in watchlist data remains until you remove it or request account deletion. Service providers may retain limited security and operational logs under their own retention schedules.',
      },
      {
        title: 'Security',
        body:
          'Cloud watchlist rows are protected by database row-level security so signed-in users can access only their own rows. Private TMDB credentials remain on server-side routes, and the browser receives only a Supabase publishable key. No internet service can guarantee absolute security, so do not submit credentials or sensitive personal information as watchlist content.',
      },
      {
        title: 'Your privacy choices and rights',
        body:
          'You can edit or remove watchlist items in the app and clear guest data through your browser settings. Depending on where you live, you may also request access, correction, export, restriction, objection, or deletion of account data by contacting the project maintainer through the AfterList GitHub repository. Do not post passwords or sensitive information in a public issue.',
      },
      {
        title: 'Policy changes',
        body:
          'This policy may change when AfterList adds or removes features or service providers. Material changes will be reflected here with a new last-updated date.',
      },
    ],
  },
  terms: {
    eyebrow: 'Terms of use',
    title: 'Terms of Use',
    updated: 'Last updated: July 11, 2026',
    intro:
      'These terms govern your use of AfterList, a learning-focused personal media watchlist.',
    sections: [
      {
        title: 'Use of the app',
        body:
          'AfterList is provided for educational and personal tracking purposes. You are responsible for the titles you add and the account credentials you use.',
      },
      {
        title: 'Media data',
        body:
          'Media search, posters, ratings, and details come from TMDB. AfterList uses the TMDB API but is not endorsed or certified by TMDB.',
      },
      {
        title: 'Accounts and security',
        body:
          'You are responsible for providing accurate account information, protecting your login credentials, and activity performed through your account. Notify the project maintainer if you believe your account has been compromised.',
      },
      {
        title: 'Acceptable use',
        body:
          'Do not interfere with the app, probe or bypass its security, access another person’s account or data, automate abusive traffic, or use the service to store unlawful, harmful, or sensitive content.',
      },
      {
        title: 'Availability and changes',
        body:
          'The app and its features may change, be suspended, or become unavailable while they are being developed. You should keep any information you cannot afford to lose somewhere else.',
      },
      {
        title: 'Suspension and termination',
        body:
          'Access may be limited or terminated when reasonably necessary to protect AfterList, its users, or its service providers, or when these terms are materially violated. You may stop using AfterList at any time and request deletion of your account data.',
      },
      {
        title: 'No warranties',
        body:
          'AfterList is provided “as is” and “as available.” To the extent permitted by law, no warranty is made that the app will be uninterrupted, error-free, secure, or that synced data will never be lost. Nothing in these terms limits rights that cannot legally be excluded.',
      },
      {
        title: 'Limitation of liability',
        body:
          'To the extent permitted by law, the project maintainer is not liable for indirect or consequential loss arising from use of the app, loss of watchlist data, or third-party services. This does not exclude liability that applicable law does not allow to be excluded.',
      },
      {
        title: 'Changes to these terms',
        body:
          'These terms may be updated as AfterList changes. The last-updated date identifies the current version. Continuing to use the app after an update means the updated terms apply from that point forward.',
      },
    ],
  },
} as const

export default function LegalPage({ type }: LegalPageProps) {
  const copy = legalCopy[type]

  return (
    <motion.section
      className="legal-page glass-panel"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p className="legal-updated">{copy.updated}</p>
      <p className="legal-intro">{copy.intro}</p>

      <div className="legal-sections">
        {copy.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>

      <p className="legal-note">
        This page is a simple project policy, not legal advice. For questions, use the project links in the footer.
      </p>

      <Link className="legal-back-link" to="/">
        Back to AfterList
      </Link>
    </motion.section>
  )
}
