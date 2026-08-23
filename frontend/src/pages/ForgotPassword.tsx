import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { RetroAuthLayout } from '../components/RetroAuthLayout'
import { navigate } from '../router'
import { useApp } from '../store'
import '../styles/retrowave.css'

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
      <RetroAuthLayout tag={t('auth.checkInboxTag')}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="retro-auth-title" style={{ fontSize: 24 }}>
            {t('auth.checkInboxTitle')}
          </div>
          <div className="retro-auth-muted" style={{ lineHeight: 1.5, fontSize: '14px' }}>
            {t('auth.resetSentPrefix')} <b style={{ color: '#00f0ff' }}>{email}</b>{' '}
            {t('auth.resetSentSuffix')}
          </div>
          <div className="retro-auth-muted" style={{ fontSize: '13px' }}>
            {t('auth.rememberedIt')}{' '}
            <a onClick={() => navigate('/login')} className="retro-auth-link">
              {t('auth.backToSignIn')}
            </a>
          </div>
        </div>
      </RetroAuthLayout>
    )
  }

  return (
    <RetroAuthLayout tag={t('auth.forgotYourPasswordTag')}>
      <form
        onSubmit={onSubmit}
        style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div>
          <div className="retro-auth-title" style={{ fontSize: 24 }}>
            {t('auth.resetYourPasswordTitle')}
          </div>
          <div className="retro-auth-subtitle">
            {t('auth.forgotDesc')}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div className="retro-auth-label">{t('auth.emailLabel')}</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pilot@transcendence.42"
            autoComplete="email"
            required
            autoFocus
            className="retro-auth-input"
          />
        </div>
        {error && (
          <div className="retro-auth-error">{error}</div>
        )}
        <button type="submit" disabled={submitting} className="retro-auth-btn">
          {submitting ? t('auth.sendingBtn') : t('auth.sendResetLink')}
        </button>
        <div className="retro-auth-muted" style={{ textAlign: 'center' }}>
          {t('auth.rememberedIt')}{' '}
          <a onClick={() => navigate('/login')} className="retro-auth-link">
            {t('auth.backToSignIn')}
          </a>
        </div>
      </form>
    </RetroAuthLayout>
  )
}
