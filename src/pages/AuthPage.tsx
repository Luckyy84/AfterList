import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'

type AuthPageProps = {
  mode: 'login' | 'signup'
}

const authEase = [0.22, 1, 0.36, 1] as const

export default function AuthPage({ mode }: AuthPageProps) {
  const [notice, setNotice] = useState('')
  const isSignup = mode === 'signup'

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice('Auth UI is ready. Supabase wiring comes next.')
  }

  return (
    <motion.section
      className="auth-page"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: authEase }}
    >
      <div className="auth-copy glass-panel">
        <p className="eyebrow">AfterList account</p>
        <h1>{isSignup ? 'Create your sync vault' : 'Welcome back'}</h1>
        <p>
          {isSignup
            ? 'Make your watchlist portable across desktop, phone, and every late-night search session.'
            : 'Sign in to keep your anime, movies, and TV series synced across devices.'}
        </p>

        <div className="auth-feature-grid" aria-label="Account features">
          <span>Cloud watchlist</span>
          <span>Saved status</span>
          <span>Cross-device sync</span>
        </div>
      </div>

      <div className="auth-panel glass-panel">
        <div className="auth-panel-head">
          <p className="eyebrow">{isSignup ? 'Sign up' : 'Sign in'}</p>
          <h2>{isSignup ? 'Start tracking everywhere.' : 'Continue your list.'}</h2>
          <p>{isSignup ? 'Use email and password for the first auth version.' : 'Use the account you will connect with Supabase.'}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <label className="auth-field">
              <span>Display name</span>
              <input name="displayName" type="text" placeholder="Luckyy" autoComplete="nickname" />
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </label>

          {isSignup && (
            <label className="auth-field">
              <span>Confirm password</span>
              <input name="confirmPassword" type="password" placeholder="••••••••" autoComplete="new-password" minLength={6} required />
            </label>
          )}

          <button className="auth-submit" type="submit">
            {isSignup ? 'Create account' : 'Sign in'}
          </button>

          {notice && <p className="auth-notice">{notice}</p>}
        </form>

        <p className="auth-switch">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Create one'}</Link>
        </p>
      </div>
    </motion.section>
  )
}
