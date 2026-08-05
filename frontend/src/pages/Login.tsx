import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthLayout, GoldCheck } from '../components/AuthLayout'
import { OAuthButtons, OrDivider } from '../components/OAuthButtons'
import { navigate, useRoute } from '../router'
import { btnGold, goldText, input, label } from '../theme'
import { useApp } from '../store'

export function Login() {
  const { t } = useTranslation()
  const { login } = useApp()
  const { query } = useRoute()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Human-readable text for ?error= codes the backend redirects here with.
  const QUERY_ERRORS: Record<string, string> = {
    'no-verified-email': t('auth.errorNoVerifiedEmail'),
    'invalid-verification-link': t('auth.errorInvalidVerificationLink'),
  }

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
    <AuthLayout tag={t('auth.loginTag')}>
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
            {t('nav.title')}
          </div>
          <div style={{ color: '#a99a83', fontSize: 15, marginTop: 8 }}>
            {t('auth.loginTagline')}
          </div>
        </div>
        {justVerified && (
          <div style={{ color: '#4bbf7b', fontSize: '13.5px', lineHeight: 1.4 }}>
            {t('auth.emailVerifiedNotice')}
          </div>
        )}
        {justReset && (
          <div style={{ color: '#4bbf7b', fontSize: '13.5px', lineHeight: 1.4 }}>
            {t('auth.passwordUpdatedNotice')}
          </div>
        )}
        {queryError && (
          <div style={{ color: '#e4574d', fontSize: '13.5px', lineHeight: 1.4 }}>{queryError}</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={label}>{t('auth.identifierLabel')}</div>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t('auth.identifierPlaceholder')}
            autoComplete="username"
            style={input}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={label}>{t('auth.passwordLabel')}</div>
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
            {t('auth.rememberMe')}
          </label>
          <a onClick={() => navigate('/forgot-password')} style={{ cursor: 'pointer' }}>
            {t('auth.forgotPasswordLink')}
          </a>
        </div>
        <button type="submit" disabled={submitting} style={{ ...btnGold, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? t('auth.enteringBtn') : t('auth.enterParlorBtn')}
        </button>
        <OrDivider text={t('auth.orContinueWith')} />
        <OAuthButtons />
        <div style={{ textAlign: 'center', color: '#a99a83', fontSize: 14 }}>
          {t('auth.newToTable')}{' '}
          <a onClick={() => navigate('/signup')} style={{ cursor: 'pointer', fontWeight: 700 }}>
            {t('auth.createAccountLink')}
          </a>
        </div>
      </form>
    </AuthLayout>
  )
}
