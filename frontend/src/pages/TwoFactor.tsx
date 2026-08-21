import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { RetroAuthLayout } from '../components/RetroAuthLayout'
import { navigate, useRoute } from '../router'
import { useApp } from '../store'
import '../styles/retrowave.css'

/**
 * Second login factor. Reached two ways, both carrying ?token=<pendingToken>:
 *  - password login: Login.tsx navigates here after factor one succeeds
 *  - OAuth: the backend callback redirects here after emailing the code
 */
export function TwoFactor() {
  const { t } = useTranslation()
  const { verify2fa } = useApp()
  const { query } = useRoute()
  const pendingToken = query.get('token') ?? ''
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const err = await verify2fa(pendingToken, code)
    setSubmitting(false)
    if (err) setError(err)
    else navigate('/home')
  }

  return (
    <RetroAuthLayout tag={t('auth.oneMoreStep')}>
      <form
        onSubmit={onSubmit}
        style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div>
          <div className="retro-auth-title" style={{ fontSize: 24 }}>
            {t('auth.checkEmailTitle')}
          </div>
          <div className="retro-auth-subtitle">
            {t('auth.codeSentDesc')}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div className="retro-auth-label">{t('auth.loginCodeLabel')}</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            className="retro-auth-input"
            style={{ letterSpacing: 8, fontSize: 22, textAlign: 'center' }}
          />
        </div>
        {error && (
          <div className="retro-auth-error">{error}</div>
        )}
        <button
          type="submit"
          disabled={submitting || code.length !== 6}
          className="retro-auth-btn"
        >
          {submitting ? t('auth.checkingBtn') : t('auth.enterParlorBtn')}
        </button>
        <div className="retro-auth-muted" style={{ textAlign: 'center' }}>
          {t('auth.codeExpired')}{' '}
          <a onClick={() => navigate('/login')} className="retro-auth-link">
            {t('auth.logInAgainLink')}
          </a>{' '}
          {t('auth.toGetNewOne')}
        </div>
      </form>
    </RetroAuthLayout>
  )
}
