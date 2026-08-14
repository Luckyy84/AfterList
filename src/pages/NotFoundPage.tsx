import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import PageMetadata from '../components/seo/PageMetadata'

export default function NotFoundPage() {
  return (
    <>
      <PageMetadata config={{
        title: 'Page not found | AfterList',
        description: 'The page you requested could not be found on AfterList.',
        canonicalPath: window.location.pathname,
        index: false,
      }} />
      <motion.section className="not-found-page glass-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
        <span className="not-found-code" aria-hidden="true">404</span>
        <div className="not-found-copy">
          <h1>This story isn’t on the list.</h1>
          <p>The page may have moved, or the link may no longer be available.</p>
          <div className="not-found-actions">
            <Link className="primary-action" to="/">Go home</Link>
            <Link className="secondary-action" to="/discover">Discover titles</Link>
          </div>
        </div>
      </motion.section>
    </>
  )
}
