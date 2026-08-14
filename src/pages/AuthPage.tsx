import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'

type AuthPageProps = {
  mode: 'login' | 'signup'
}

const authEase = [0.22, 1, 0.36, 1] as const
type Notice = { kind: 'error' | 'success'; text: string }

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

export default function AuthPage({ mode }: AuthPageProps) {
  const { isConfigured, isLoading, requestPasswordReset, signIn, signUp, signInWithGoogle, user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [notice, setNotice] = useState<Notice | null>(location.state?.passwordUpdated ? { kind: 'success', text: 'Password updated. Sign in with your new password.' } : null)
  const [invalidField, setInvalidField] = useState<'confirmPassword' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const noticeRef = useRef<HTMLParagraphElement | null>(null)
  const confirmPasswordRef = useRef<HTMLInputElement | null>(null)
  const isSignup = mode === 'signup'

  const showError = (text: string) => {
    setNotice({ kind: 'error', text })
    queueMicrotask(() => noticeRef.current?.focus())
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice(null)
    setInvalidField(null)

    if (!isConfigured) {
      showError('Supabase is not configured yet. Add your VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY values first.')
      return
    }

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')
    const displayName = String(formData.get('displayName') ?? '').trim()
    const confirmPassword = String(formData.get('confirmPassword') ?? '')

    if (isSignup && password !== confirmPassword) {
      setInvalidField('confirmPassword')
      setNotice({ kind: 'error', text: 'Passwords do not match.' })
      queueMicrotask(() => confirmPasswordRef.current?.focus())
      return
    }

    setIsSubmitting(true)

    try {
      if (isResettingPassword) {
        await requestPasswordReset(email)
        setNotice({ kind: 'success', text: 'If an account exists for that email, a password reset link is on its way.' })
      } else if (isSignup) {
        const session = await signUp(email, password, displayName)

        if (session) {
          navigate('/')
        } else {
          setNotice({ kind: 'success', text: 'Account created. Check your email to confirm your signup, then sign in.' })
        }
      } else {
        await signIn(email, password)
        navigate('/')
      }
    } catch (error) {
      showError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleAuth = async () => {
    setNotice(null)

    if (!isConfigured) {
      showError('Supabase is not configured yet. Add your VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY values first.')
      return
    }

    setIsSubmitting(true)

    try {
      await signInWithGoogle()
    } catch (error) {
      showError(getErrorMessage(error))
      setIsSubmitting(false)
    }
  }

  if (!isLoading && user) {
    return <Navigate to="/" replace />
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
        <h1>{isSignup ? 'Protect the list you built.' : isResettingPassword ? 'Find your way back.' : 'Welcome back'}</h1>
        <p>
          {isSignup
            ? 'An account keeps your watchlist backed up and synced across your devices. You can keep using AfterList as a guest, too.'
            : isResettingPassword
              ? 'Enter your account email and we will send you a secure link to choose a new password.'
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
          <p className="eyebrow">{isSignup ? 'Sign up' : isResettingPassword ? 'Reset password' : 'Sign in'}</p>
          <h2>{isSignup ? 'Start tracking everywhere.' : isResettingPassword ? 'Check your inbox next.' : 'Continue your list.'}</h2>
          <p>{isSignup ? 'Use Google or email and password to create your AfterList account.' : isResettingPassword ? 'We will email a one-time recovery link if the account exists.' : 'Use Google or your email and password to continue.'}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} aria-busy={isSubmitting}>
          {!isResettingPassword && <button className="auth-google" type="button" onClick={handleGoogleAuth} disabled={isSubmitting}>
            <span className="auth-google-icon" aria-hidden="true">G</span>
            Continue with Google
          </button>}

          {!isResettingPassword && <div className="auth-divider" role="separator">
            <span>or continue with email</span>
          </div>}

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

          {!isResettingPassword && <label className="auth-field">
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
          </label>}

          {isSignup && (
            <label className="auth-field">
              <span>Confirm password</span>
              <input ref={confirmPasswordRef} name="confirmPassword" type="password" placeholder="••••••••" autoComplete="new-password" minLength={6} required disabled={isSubmitting} aria-invalid={invalidField === 'confirmPassword'} aria-describedby={invalidField === 'confirmPassword' ? 'auth-notice' : undefined} onChange={() => setInvalidField(null)} />
            </label>
          )}

          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Working...' : isSignup ? 'Create account' : isResettingPassword ? 'Send reset link' : 'Sign in'}
          </button>

          {notice && <p id="auth-notice" ref={noticeRef} tabIndex={notice.kind === 'error' ? -1 : undefined} className={`auth-notice is-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
        </form>

        {!isSignup && (
          <button className="auth-text-action" type="button" onClick={() => { setIsResettingPassword((current) => !current); setNotice(null); setInvalidField(null) }} disabled={isSubmitting}>
            {isResettingPassword ? 'Back to sign in' : 'Forgot your password?'}
          </button>
        )}

        {!isResettingPassword && <p className="auth-switch">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Create one'}</Link>
        </p>}

        {isSignup && (
          <p className="auth-legal">
            By creating an account, you agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
          </p>
        )}
      </div>
    </motion.section>
  )
}
