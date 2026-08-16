import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthLayout, GoldCheck } from '../components/AuthLayout'
import { OAuthButtons, OrDivider } from '../components/OAuthButtons'
import { navigate } from '../router'
import { btnGold, goldText, input, label } from '../theme'
import { useApp } from '../store'
import { passwordError } from '../validatePassword'

export function Signup() {
  const { t } = useTranslation()
  const { register } = useApp()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    // Mirror the backend rule (RegisterDto) so weak passwords fail instantly
    // rather than round-tripping to a 400. The server still re-checks.
    const pwError = passwordError(password)
    if (pwError) {
      setError(pwError)
      return
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }
    setSubmitting(true)
    setError(null)
    const err = await register(username, password, email.trim())
    setSubmitting(false)
    if (err) setError(err)
    else setSent(true) // no session yet — the account activates via the emailed link
  }

  if (sent) {
    return (
      <AuthLayout tag={t('auth.oneMoreStep')}>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
              fontWeight: 900,
              letterSpacing: -0.5,
              fontSize: 34,
              lineHeight: 1.05,
              ...goldText,
            }}
          >
            {t('auth.checkInboxTitle')}
          </div>
          <div style={{ color: '#b8a9d4', fontSize: '14.5px', lineHeight: 1.5 }}>
            {t('auth.verificationSentPrefix')} <b style={{ color: '#f8f0ff' }}>{email}</b>.{' '}
            {t('auth.verificationSentSuffix')}
          </div>
          <div style={{ color: '#b8a9d4', fontSize: 14 }}>
            {t('auth.doneVerifying')}{' '}
            <a onClick={() => navigate('/login')} style={{ cursor: 'pointer', fontWeight: 700, color: '#a78bfa' }}>
              {t('auth.signInLink')}
            </a>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout tag={t('auth.signupTag')}>
      <form
        onSubmit={onSubmit}
        style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
              fontWeight: 900,
              letterSpacing: -0.5,
              fontSize: 34,
              lineHeight: 1.05,
              ...goldText,
            }}
          >
            {t('auth.createSeatTitle')}
          </div>
          <div style={{ color: '#b8a9d4', fontSize: '14.5px', marginTop: 8 }}>
            {t('auth.claimSeatDesc')}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={label}>{t('auth.usernameLabel')}</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('auth.usernamePlaceholder')}
            autoComplete="username"
            style={input}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={label}>{t('auth.emailLabel')}</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailPlaceholderSignup')}
            autoComplete="email"
            required
            style={input}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={label}>{t('auth.passwordLabel')}</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholderSignup')}
              autoComplete="new-password"
              style={input}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={label}>{t('auth.confirmLabel')}</div>
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
          <div style={{ color: '#ff6b8a', fontSize: '13.5px', lineHeight: 1.4, background: 'rgba(255,107,138,0.15)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,107,138,0.3)' }}>{error}</div>
        )}
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 9,
            cursor: 'pointer',
            color: '#b8a9d4',
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          <GoldCheck offsetTop />
          {t('auth.agreeTerms')}
        </label>
        <button type="submit" disabled={submitting} style={{ ...btnGold, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? t('auth.creatingBtn') : t('auth.createAccountBtn')}
        </button>
        <OrDivider text={t('auth.orSignUpWith')} />
        <OAuthButtons />
        <div style={{ textAlign: 'center', color: '#b8a9d4', fontSize: 14 }}>
          {t('auth.alreadyHaveSeat')}{' '}
          <a onClick={() => navigate('/login')} style={{ cursor: 'pointer', fontWeight: 700, color: '#a78bfa' }}>
            {t('auth.signInLink')}
          </a>
        </div>
      </form>
    </AuthLayout>
  )
}
