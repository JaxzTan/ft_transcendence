import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthLayout, GoldCheck } from '../components/AuthLayout'
import { OAuthButtons, OrDivider } from '../components/OAuthButtons'
import { navigate, useRoute } from '../router'
import { btnGold, goldText, input, label } from '../theme'
import { useApp } from '../store'

// Human-readable text for ?error= codes the backend redirects here with.
const QUERY_ERRORS: Record<string, string> = {
  'no-verified-email': 'That provider account has no verified email, so we cannot send login codes.',
  'invalid-verification-link': 'That verification link is invalid or expired. Sign up again to get a new one.',
}

export function Login() {
  const { login } = useApp()
  const { query } = useRoute()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // One-shot notices arriving via redirect (email verified / password reset / OAuth errors).
  const queryError = QUERY_ERRORS[query.get('error') ?? '']
  const justVerified = query.get('verified') === '1'
  const justReset = query.get('reset') === '1'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const result = await login(identifier, password)
    setSubmitting(false)
    if (result.error) setError(result.error)
    else if (result.pendingToken) navigate(`/2fa?token=${result.pendingToken}`)
    else navigate('/home') // 2FA off — session already established, skip the code page
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
        {justVerified && (
          <div style={{ color: '#4bbf7b', fontSize: '13.5px', lineHeight: 1.4 }}>
            Email verified — you can log in now.
          </div>
        )}
        {justReset && (
          <div style={{ color: '#4bbf7b', fontSize: '13.5px', lineHeight: 1.4 }}>
            Password updated — sign in with your new password.
          </div>
        )}
        {queryError && (
          <div style={{ color: '#e4574d', fontSize: '13.5px', lineHeight: 1.4 }}>{queryError}</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={label}>Username or email</div>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="NightRook or you@parlor.gg"
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
          <a onClick={() => navigate('/forgot-password')} style={{ cursor: 'pointer' }}>
            Forgot password?
          </a>
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
