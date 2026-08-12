import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
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
      <AuthLayout tag={t('auth.linkProblemTag')}>
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
            {t('auth.invalidLinkTitle')}
          </div>
          <div style={{ color: '#a6accd', fontSize: '14.5px', lineHeight: 1.5 }}>
            {t('auth.invalidLinkDesc')}
          </div>
          <div style={{ color: '#a6accd', fontSize: 14 }}>
            <a onClick={() => navigate('/forgot-password')} style={{ cursor: 'pointer', fontWeight: 700, color: '#5de4c7' }}>
              {t('auth.requestNewLinkBtn')}
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
    <AuthLayout tag={t('auth.chooseNewPasswordTag')}>
      <form
        onSubmit={onSubmit}
        style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 20 }}
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
            {t('auth.newPasswordTitle')}
          </div>
          <div style={{ color: '#a6accd', fontSize: '14.5px', marginTop: 8 }}>
            {t('auth.newPasswordDesc')}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={label}>{t('auth.newPasswordLabel')}</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.passwordPlaceholderSignup')}
            autoComplete="new-password"
            autoFocus
            style={input}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={label}>{t('auth.confirmPasswordLabel')}</div>
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
          <div style={{ color: '#d0679d', fontSize: '13.5px', lineHeight: 1.4, background: 'rgba(208,103,157,0.15)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(208,103,157,0.3)' }}>{error}</div>
        )}
        <button type="submit" disabled={submitting} style={{ ...btnGold, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? t('auth.savingBtn') : t('auth.updatePasswordBtn')}
        </button>
      </form>
    </AuthLayout>
  )
}
