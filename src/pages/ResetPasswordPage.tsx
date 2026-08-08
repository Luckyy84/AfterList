import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'

const authEase = [0.22, 1, 0.36, 1] as const

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Could not update your password. Request a new reset link and try again.'
}

export default function ResetPasswordPage() {
  const { isConfigured, isLoading, session, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice('')

    const formData = new FormData(event.currentTarget)
    const password = String(formData.get('password') ?? '')
    const confirmPassword = String(formData.get('confirmPassword') ?? '')

    if (password !== confirmPassword) {
      setNotice('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      await updatePassword(password)
      navigate('/login', { replace: true, state: { passwordUpdated: true } })
    } catch (error) {
      setNotice(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const canReset = isConfigured && !isLoading && Boolean(session)

  return (
    <motion.section className="auth-page" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: authEase }}>
      <div className="auth-copy glass-panel">
        <p className="eyebrow">Account recovery</p>
        <h1>Choose a new password.</h1>
        <p>Use a password you do not reuse anywhere else. Your watchlist and account data stay exactly where you left them.</p>
      </div>

      <div className="auth-panel glass-panel">
        <div className="auth-panel-head">
          <p className="eyebrow">Reset password</p>
          <h2>Secure your account.</h2>
          <p>{canReset ? 'Enter and confirm your new password.' : 'Open this page using the latest password reset link from your email.'}</p>
        </div>

        {canReset ? <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>New password</span>
            <input name="password" type="password" autoComplete="new-password" minLength={8} required disabled={isSubmitting} />
          </label>
          <label className="auth-field">
            <span>Confirm new password</span>
            <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required disabled={isSubmitting} />
          </label>
          <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update password'}</button>
          {notice && <p className="auth-notice" role="alert">{notice}</p>}
        </form> : <p className="auth-notice" role="alert">This reset link is missing, invalid, or expired. <Link to="/login">Request a new link</Link>.</p>}
      </div>
    </motion.section>
  )
}
