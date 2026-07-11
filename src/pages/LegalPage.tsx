import { Link } from 'react-router-dom'
import { motion } from 'motion/react'

type LegalPageProps = {
  type: 'privacy' | 'terms'
}

const legalCopy = {
  privacy: {
    eyebrow: 'Privacy policy',
    title: 'Privacy Policy',
    updated: 'Last updated: July 9, 2026',
    intro:
      'AfterList is a learning-focused watchlist app. This policy explains what the app stores and how third-party services are used.',
    sections: [
      {
        title: 'Information AfterList stores',
        body:
          'Guests store watchlist items in this browser only through localStorage. Signed-in users store account details and watchlist items through Supabase so the list can sync across devices.',
      },
      {
        title: 'Third-party services',
        body:
          'AfterList uses Supabase for authentication and cloud sync, TMDB for media search and details, and Vercel for hosting and analytics. TMDB credentials stay on server-side API routes.',
      },
      {
        title: 'Your choices',
        body:
          'You can remove watchlist items in the app. You can also clear guest data by clearing this site browser storage. Signed-in account data depends on the configured Supabase project.',
      },
      {
        title: 'No sensitive data',
        body:
          'Do not add private notes, credentials, or sensitive personal information to watchlist fields. AfterList is intended for media tracking only.',
      },
    ],
  },
  terms: {
    eyebrow: 'Terms of use',
    title: 'Terms of Use',
    updated: 'Last updated: July 9, 2026',
    intro:
      'By using AfterList, you agree to use it as a personal media watchlist and learning project.',
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
        title: 'Availability',
        body:
          'The app may change, break, or be unavailable while it is being developed. No guarantee is made that data sync or third-party services will always work.',
      },
      {
        title: 'Acceptable use',
        body:
          'Do not misuse the app, attempt to access another user account, or use the service to store unlawful, harmful, or sensitive content.',
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
