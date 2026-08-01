import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthLayout } from '../components/AuthLayout'
import { navigate, useRoute } from '../router'
import { btnGold, goldText, input, label } from '../theme'
import { useApp } from '../store'
import { passwordError } from '../validatePassword'

/**
 * Step two of password reset. Reached from the emailed link, which carries
 * ?token=<resetToken>. Collects a new password (validated against the same
 * policy as signup) and, on success, sends the user to /login.
 */
export function ResetPassword() {
  const { resetPassword } = useApp()
  const { query } = useRoute()
  const token = query.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // A link with no token is unusable — send them to request a fresh one.
  if (!token) {
    return (
      <AuthLayout tag="LINK PROBLEM">
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              fontFamily: "'Cinzel',serif",
              fontWeight: 700,
              letterSpacing: 1.5,
              fontSize: 30,
              lineHeight: 1,
              ...goldText,
            }}
          >
            Invalid reset link
          </div>
          <div style={{ color: '#a99a83', fontSize: '14.5px', lineHeight: 1.5 }}>
            This link is missing its token. Request a new one and try again.
          </div>
          <div style={{ color: '#a99a83', fontSize: 14 }}>
            <a onClick={() => navigate('/forgot-password')} style={{ cursor: 'pointer', fontWeight: 700 }}>
              Request a new link
            </a>
          </div>
        </div>
      </AuthLayout>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const pwError = passwordError(password)
    if (pwError) {
      setError(pwError)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    setError(null)
    const err = await resetPassword(token, password)
    setSubmitting(false)
    if (err) setError(err)
    else navigate('/login?reset=1')
  }

  return (
    <AuthLayout tag="CHOOSE A NEW PASSWORD">
      <form
        onSubmit={onSubmit}
        style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Cinzel',serif",
              fontWeight: 700,
              letterSpacing: 1.5,
              fontSize: 30,
              lineHeight: 1,
              ...goldText,
            }}
          >
            Set a new password
          </div>
          <div style={{ color: '#a99a83', fontSize: '14.5px', marginTop: 8 }}>
            Pick something you haven't used here before.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={label}>New password</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="12+ chars, upper, lower, number, symbol"
            autoComplete="new-password"
            autoFocus
            style={input}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={label}>Confirm password</div>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            style={input}
          />
        </div>
        {error && (
          <div style={{ color: '#e4574d', fontSize: '13.5px', lineHeight: 1.4 }}>{error}</div>
        )}
        <button type="submit" disabled={submitting} style={{ ...btnGold, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  )
}
