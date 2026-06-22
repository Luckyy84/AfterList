import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { useAuth } from '../context/AuthContext'
import { panelSpring, reducedTransition } from '../utils/motion'

type AuthPageProps = {
  mode: 'login' | 'signup'
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

export default function AuthPage({ mode }: AuthPageProps) {
  const shouldReduceMotion = useReducedMotion()
  const { isConfigured, isLoading, signIn, signUp, signInWithGoogle, user } = useAuth()
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSignup = mode === 'signup'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice('')

    if (!isConfigured) {
      setNotice('Supabase is not configured yet. Add your VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY values first.')
      return
    }

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')
    const displayName = String(formData.get('displayName') ?? '').trim()
    const confirmPassword = String(formData.get('confirmPassword') ?? '')

    if (isSignup && password !== confirmPassword) {
      setNotice('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      if (isSignup) {
        const session = await signUp(email, password, displayName)

        if (session) {
          navigate('/')
        } else {
          setNotice('Account created. Check your email to confirm your signup, then sign in.')
        }
      } else {
        await signIn(email, password)
        navigate('/')
      }
    } catch (error) {
      setNotice(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleAuth = async () => {
    setNotice('')

    if (!isConfigured) {
      setNotice('Supabase is not configured yet. Add your VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY values first.')
      return
    }

    setIsSubmitting(true)

    try {
      await signInWithGoogle()
    } catch (error) {
      setNotice(getErrorMessage(error))
      setIsSubmitting(false)
    }
  }

  if (!isLoading && user) {
    return <Navigate to="/" replace />
  }

  return (
    <motion.section
      className="auth-page"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 22, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={shouldReduceMotion ? reducedTransition : panelSpring}
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
          <p>{isSignup ? 'Use Google or email and password to create your AfterList account.' : 'Use Google or your email and password to continue.'}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <button className="auth-google" type="button" onClick={handleGoogleAuth} disabled={isSubmitting}>
            <span className="auth-google-icon" aria-hidden="true">G</span>
            Continue with Google
          </button>

          <div className="auth-divider" role="separator">
            <span>or continue with email</span>
          </div>

          {isSignup && (
            <label className="auth-field">
              <span>Display name</span>
              <input name="displayName" type="text" placeholder="Luckyy" autoComplete="nickname" disabled={isSubmitting} />
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input name="email" type="email" placeholder="you@example.com" autoComplete="email" required disabled={isSubmitting} />
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
              disabled={isSubmitting}
            />
          </label>

          {isSignup && (
            <label className="auth-field">
              <span>Confirm password</span>
              <input name="confirmPassword" type="password" placeholder="••••••••" autoComplete="new-password" minLength={6} required disabled={isSubmitting} />
            </label>
          )}

          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Working...' : isSignup ? 'Create account' : 'Sign in'}
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
