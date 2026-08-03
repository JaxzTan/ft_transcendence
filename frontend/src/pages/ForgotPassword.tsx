import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthLayout } from '../components/AuthLayout'
import { navigate } from '../router'
import { btnGold, goldText, input, label } from '../theme'
import { useApp } from '../store'

/**
 * Step one of password reset: collect an email and ask the backend to send a
 * link. The confirmation screen is shown unconditionally — the backend never
 * reveals whether the address was registered, and neither do we.
 */
export function ForgotPassword() {
  const { forgotPassword } = useApp()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const err = await forgotPassword(email.trim())
    setSubmitting(false)
    if (err) setError(err)
    else setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout tag="CHECK YOUR INBOX">
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
            Check your inbox
          </div>
          <div style={{ color: '#a99a83', fontSize: '14.5px', lineHeight: 1.5 }}>
            If <b style={{ color: '#f0e2c4' }}>{email}</b> belongs to an account, we've sent a
            password reset link. It expires in 1 hour and can be used once.
          </div>
          <div style={{ color: '#a99a83', fontSize: 14 }}>
            Remembered it?{' '}
            <a onClick={() => navigate('/login')} style={{ cursor: 'pointer', fontWeight: 700 }}>
              Back to sign in
            </a>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout tag="FORGOT YOUR PASSWORD?">
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
            Reset your password
          </div>
          <div style={{ color: '#a99a83', fontSize: '14.5px', marginTop: 8 }}>
            Enter your email and we'll send you a link to choose a new one.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={label}>Email</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@parlor.gg"
            autoComplete="email"
            required
            autoFocus
            style={input}
          />
        </div>
        {error && (
          <div style={{ color: '#e4574d', fontSize: '13.5px', lineHeight: 1.4 }}>{error}</div>
        )}
        <button type="submit" disabled={submitting} style={{ ...btnGold, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
        <div style={{ textAlign: 'center', color: '#a99a83', fontSize: 14 }}>
          Remembered it?{' '}
          <a onClick={() => navigate('/login')} style={{ cursor: 'pointer', fontWeight: 700 }}>
            Back to sign in
          </a>
        </div>
      </form>
    </AuthLayout>
  )
}
