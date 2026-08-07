import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      <AuthLayout tag={t('auth.checkInboxTag')}>
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
            {t('auth.checkInboxTitle')}
          </div>
          <div style={{ color: '#a99a83', fontSize: '14.5px', lineHeight: 1.5 }}>
            {t('auth.resetSentPrefix')} <b style={{ color: '#f0e2c4' }}>{email}</b>{' '}
            {t('auth.resetSentSuffix')}
          </div>
          <div style={{ color: '#a99a83', fontSize: 14 }}>
            {t('auth.rememberedIt')}{' '}
            <a onClick={() => navigate('/login')} style={{ cursor: 'pointer', fontWeight: 700 }}>
              {t('auth.backToSignIn')}
            </a>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout tag={t('auth.forgotYourPasswordTag')}>
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
            {t('auth.resetYourPasswordTitle')}
          </div>
          <div style={{ color: '#a99a83', fontSize: '14.5px', marginTop: 8 }}>
            {t('auth.forgotDesc')}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={label}>{t('auth.emailLabel')}</div>
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
          {submitting ? t('auth.sendingBtn') : t('auth.sendResetLink')}
        </button>
        <div style={{ textAlign: 'center', color: '#a99a83', fontSize: 14 }}>
          {t('auth.rememberedIt')}{' '}
          <a onClick={() => navigate('/login')} style={{ cursor: 'pointer', fontWeight: 700 }}>
            {t('auth.backToSignIn')}
          </a>
        </div>
      </form>
    </AuthLayout>
  )
}
