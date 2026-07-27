import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthLayout, GoldCheck } from '../components/AuthLayout'
import { OAuthButtons, OrDivider } from '../components/OAuthButtons'
import { navigate } from '../router'
import { btnGold, goldText, input, label } from '../theme'
import { useApp } from '../store'

export function Login() {
  const { login } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const err = await login(username, password)
    setSubmitting(false)
    if (err) setError(err)
    else navigate('/home')
  }

  return (
    <AuthLayout tag="EST. 1896 · TABLETOP CLASSICS">
      <form
        onSubmit={onSubmit}
        style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Cinzel',serif",
              fontWeight: 700,
              letterSpacing: 2,
              fontSize: 38,
              lineHeight: 1,
              ...goldText,
            }}
          >
            LUDO ROYALE
          </div>
          <div style={{ color: '#a99a83', fontSize: 15, marginTop: 8 }}>
            Roll. Race. Reign. Welcome back to the parlor.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={label}>Username</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="NightRook"
            autoComplete="username"
            style={input}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={label}>Password</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            style={input}
          />
        </div>
        {error && (
          <div style={{ color: '#e4574d', fontSize: '13.5px', lineHeight: 1.4 }}>{error}</div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13.5px',
            color: '#a99a83',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <GoldCheck />
            Remember me
          </label>
          <a href="#">Forgot password?</a>
        </div>
        <button type="submit" disabled={submitting} style={{ ...btnGold, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Entering…' : 'Enter the parlor'}
        </button>
        <OrDivider text="OR CONTINUE WITH" />
        <OAuthButtons />
        <div style={{ textAlign: 'center', color: '#a99a83', fontSize: 14 }}>
          New to the table?{' '}
          <a onClick={() => navigate('/signup')} style={{ cursor: 'pointer', fontWeight: 700 }}>
            Create an account
          </a>
        </div>
      </form>
    </AuthLayout>
  )
}
