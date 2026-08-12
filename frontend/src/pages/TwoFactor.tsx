import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthLayout } from '../components/AuthLayout'
import { navigate, useRoute } from '../router'
import { btnGold, goldText, input, label } from '../theme'
import { useApp } from '../store'

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
    <AuthLayout tag={t('auth.oneMoreStep')}>
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
            {t('auth.checkEmailTitle')}
          </div>
          <div style={{ color: '#a6accd', fontSize: '14.5px', marginTop: 8 }}>
            {t('auth.codeSentDesc')}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={label}>{t('auth.loginCodeLabel')}</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            style={{ ...input, letterSpacing: 8, fontSize: 24, fontWeight: 800, textAlign: 'center', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}
          />
        </div>
        {error && (
          <div style={{ color: '#d0679d', fontSize: '13.5px', lineHeight: 1.4, background: 'rgba(208,103,157,0.15)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(208,103,157,0.3)' }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={submitting || code.length !== 6}
          style={{ ...btnGold, opacity: submitting || code.length !== 6 ? 0.6 : 1 }}
        >
          {submitting ? t('auth.checkingBtn') : t('auth.enterParlorBtn')}
        </button>
        <div style={{ textAlign: 'center', color: '#a6accd', fontSize: 14 }}>
          {t('auth.codeExpired')}{' '}
          <a onClick={() => navigate('/login')} style={{ cursor: 'pointer', fontWeight: 700, color: '#5de4c7' }}>
            {t('auth.logInAgainLink')}
          </a>{' '}
          {t('auth.toGetNewOne')}
        </div>
      </form>
    </AuthLayout>
  )
}
