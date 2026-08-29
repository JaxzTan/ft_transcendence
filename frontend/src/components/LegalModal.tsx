import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../store'
import { RETRO_BTN } from '../styles/tw'

// Legal copy lives in the locales folder as one .md per language, imported raw
// so it's bundled into the SPA (no runtime fetch, works offline, no CSP issue).
import privacyEn from '../locales/legal/privacy-en.md?raw'
import privacyFr from '../locales/legal/privacy-fr.md?raw'
import privacyMs from '../locales/legal/privacy-ms.md?raw'
import termsEn from '../locales/legal/terms-en.md?raw'
import termsFr from '../locales/legal/terms-fr.md?raw'
import termsMs from '../locales/legal/terms-ms.md?raw'

const DOCS = {
  privacy: { en: privacyEn, fr: privacyFr, ms: privacyMs },
  terms: { en: termsEn, fr: termsFr, ms: termsMs },
} as const

type DocKey = keyof typeof DOCS

export function LegalModal({ doc, onClose }: { doc: DocKey; onClose: () => void }) {
  const { t } = useTranslation()
  const { lang } = useApp()

  // ESC closes the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const text = DOCS[doc][lang] ?? DOCS[doc].en

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.78)', backdropFilter: 'blur(4px)',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={doc === 'privacy' ? t('legal.privacyTitle') : t('legal.termsTitle')}
        style={{
          width: 'min(94vw, 820px)', maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          borderRadius: 10, overflow: 'hidden',
          background: 'var(--bg-card)',
          border: '2px solid var(--accent-cyan)',
          boxShadow: '0 0 30px rgba(0, 240, 255, 0.35), 0 20px 60px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Header — title + big obvious dismiss button */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '12px 16px',
            background: 'rgba(0, 0, 0, 0.4)',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div
            style={{
              fontWeight: 900, fontSize: '1rem', letterSpacing: '0.05em',
              fontFamily: 'var(--font-display, inherit)', color: 'var(--accent-cyan)',
            }}
          >
            {doc === 'privacy' ? t('legal.privacyTitle') : t('legal.termsTitle')}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('legal.close')}
            title={t('legal.close')}
            style={{
              flex: 'none', width: 46, height: 46,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', fontWeight: 900, lineHeight: 1, cursor: 'pointer',
              background: 'var(--accent-pink)', color: '#ffffff',
              border: '2px solid #ffffff', borderRadius: 6,
              boxShadow: '0 0 14px rgba(255, 0, 127, 0.5)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body — high readability: solid theme background, comfortable type */}
        <div
          style={{
            padding: '20px 26px', overflowY: 'auto', flex: 1,
            background: 'var(--bg-card)', color: 'var(--text-main)',
            fontSize: '0.95rem', lineHeight: 1.7,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            fontFamily: 'var(--font-body, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif)',
          }}
        >
          {text}
        </div>

        {/* Footer — big obvious full-width close */}
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(0, 0, 0, 0.4)',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <button
            type="button"
            className={RETRO_BTN}
            onClick={onClose}
            style={{
              width: '100%', padding: '14px 20px',
              fontSize: '1rem', fontWeight: 900, letterSpacing: '0.12em', cursor: 'pointer',
              background: 'var(--accent-pink)', color: '#ffffff',
              border: '2px solid var(--accent-cyan)',
              boxShadow: '0 0 14px rgba(255, 0, 127, 0.45)',
            }}
          >
            {t('legal.close')} ✕
          </button>
        </div>
      </div>
    </div>
  )
}
