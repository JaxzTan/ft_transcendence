import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthLayout, GoldCheck } from '../components/AuthLayout'
import { OAuthButtons, OrDivider } from '../components/OAuthButtons'
import { navigate } from '../router'
import { btnGold, goldText, input, label } from '../theme'
import { useApp } from '../store'

export function Signup() {
  const { register } = useApp()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    setError(null)
    const err = await register(username, password, email.trim() || undefined)
    setSubmitting(false)
    if (err) setError(err)
    else navigate('/home')
  }

  return (
    <AuthLayout tag="JOIN 2.4M PLAYERS WORLDWIDE">
      <form
        onSubmit={onSubmit}
        style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 }}
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
            Create your seat
          </div>
          <div style={{ color: '#a99a83', fontSize: '14.5px', marginTop: 8 }}>
            Claim your name at the table. It's free to play.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={label}>Username</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. NightRook (3+ characters)"
            autoComplete="username"
            style={input}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={label}>Email (optional)</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@parlor.gg"
            autoComplete="email"
            style={input}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={label}>Password</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters"
              autoComplete="new-password"
              style={input}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={label}>Confirm</div>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              style={input}
            />
          </div>
        </div>
        {error && (
          <div style={{ color: '#e4574d', fontSize: '13.5px', lineHeight: 1.4 }}>{error}</div>
        )}
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 9,
            cursor: 'pointer',
            color: '#a99a83',
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          <GoldCheck offsetTop />
          I agree to the House Rules and Privacy terms.
        </label>
        <button type="submit" disabled={submitting} style={{ ...btnGold, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Creating…' : 'Create account & play'}
        </button>
        <OrDivider text="OR SIGN UP WITH" />
        <OAuthButtons />
        <div style={{ textAlign: 'center', color: '#a99a83', fontSize: 14 }}>
          Already have a seat?{' '}
          <a onClick={() => navigate('/login')} style={{ cursor: 'pointer', fontWeight: 700 }}>
            Sign in
          </a>
        </div>
      </form>
    </AuthLayout>
  )
}
