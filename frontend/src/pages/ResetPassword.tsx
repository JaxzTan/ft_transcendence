import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { RetroAuthLayout } from '../components/RetroAuthLayout'
import { navigate, useRoute } from '../router'
import { useApp } from '../store'
import { passwordError } from '../validatePassword'
import '../styles/retrowave.css'

/**
 * Step two of password reset. Reached from the emailed link, which carries
 * ?token=<resetToken>. Collects a new password (validated against the same
 * policy as signup) and, on success, sends the user to /login.
 */
export function ResetPassword() {
  const { t } = useTranslation()
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
      <RetroAuthLayout tag={t('auth.linkProblemTag')}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="retro-auth-title" style={{ fontSize: 24 }}>
            {t('auth.invalidLinkTitle')}
          </div>
          <div className="retro-auth-muted" style={{ lineHeight: 1.5, fontSize: '14px' }}>
            {t('auth.invalidLinkDesc')}
          </div>
          <div className="retro-auth-muted" style={{ fontSize: '13px' }}>
            <a onClick={() => navigate('/forgot-password')} className="retro-auth-link">
              {t('auth.requestNewLinkBtn')}
            </a>
          </div>
        </div>
      </RetroAuthLayout>
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
      setError(t('auth.passwordMismatch'))
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
    <RetroAuthLayout tag={t('auth.chooseNewPasswordTag')}>
      <form
        onSubmit={onSubmit}
        style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div>
          <div className="retro-auth-title" style={{ fontSize: 24 }}>
            {t('auth.newPasswordTitle')}
          </div>
          <div className="retro-auth-subtitle">
            {t('auth.newPasswordDesc')}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div className="retro-auth-label">{t('auth.newPasswordLabel')}</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.passwordPlaceholderSignup')}
            autoComplete="new-password"
            autoFocus
            className="retro-auth-input"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div className="retro-auth-label">{t('auth.confirmPasswordLabel')}</div>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            className="retro-auth-input"
          />
        </div>
        {error && (
          <div className="retro-auth-error">{error}</div>
        )}
        <button type="submit" disabled={submitting} className="retro-auth-btn">
          {submitting ? t('auth.savingBtn') : t('auth.updatePasswordBtn')}
        </button>
      </form>
    </RetroAuthLayout>
  )
}
