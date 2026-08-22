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
          <div className="retro-auth-title" style={{ fontSize: 32 }}>
            TWO-FACTOR AUTH
          </div>
          <div className="retro-auth-subtitle">
            {t('auth.codeSentDesc')}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="retro-auth-label">{t('auth.loginCodeLabel')}</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            className="retro-auth-input"
            style={{
              letterSpacing: 10,
              fontSize: 26,
              fontWeight: 900,
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-cyan)',
              textShadow: '0 0 10px rgba(0, 240, 255, 0.5)',
            }}
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
          {submitting ? t('auth.checkingBtn') : 'VERIFY & ENTER ARENA'}
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
