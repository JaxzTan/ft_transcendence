import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { navigate } from '../router'
import { LANGUAGES, useApp, type Lang } from '../store'
import { avatarBlue, sectionLabel } from '../theme'

/**
 * CJK glyphs fill the em box while Latin sits at roughly half of it, so the same
 * px value renders the Latin labels optically larger. Size Latin down to match 中文.
 */
const CJK = /[　-鿿豈-﫿]/
const labelSize = (label: string) => (CJK.test(label) ? '13.5px' : '12.5px')


/** Header avatar that opens a panel for language + two-factor auth. */
export function AccountMenu() {
  const { t } = useTranslation()
  const { user, logout, lang, setLang, twoFactor, toggleTwoFactor } = useApp()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const name = user?.username ?? 'You'
  const initials = name.slice(0, 2).toUpperCase()

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function onSignOut() {
    setOpen(false)
    await logout()
    navigate('/login')
  }

  const pickLang = (code: Lang) => {
    setLang(code)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((v) => !v)
          }
        }}
        style={{
          ...avatarBlue(42, 15),
          cursor: 'pointer',
          boxShadow: open ? '0 0 0 3px #5de4c7, 0 0 16px rgba(93,228,199,.6)' : '0 0 0 2px rgba(137,221,255,.5), 0 4px 12px rgba(0,0,0,.3)',
          transition: 'all .18s ease',
        }}
      >
        {initials}
      </div>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 12px)',
            right: 0,
            zIndex: 50,
            width: 256,
            padding: 10,
            borderRadius: 18,
            background: 'linear-gradient(145deg, rgba(27, 30, 46, 0.96), rgba(20, 23, 35, 0.98))',
            border: '1px solid rgba(93, 228, 199, 0.35)',
            boxShadow: '0 24px 48px -12px rgba(0,0,0,.8), 0 0 24px rgba(93,228,199,.2)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#f0f4fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
              {name}
            </div>
            <div style={{ color: '#a6accd', fontSize: 12 }}>{t('accountMenu.signedIn')}</div>
          </div>

          <div style={{ ...sectionLabel, padding: '12px 10px 6px' }}>{t('accountMenu.language')}</div>
          {LANGUAGES.map((l) => {
            const active = l.code === lang
            return (
              <div
                key={l.code}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => pickLang(l.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontWeight: active ? 700 : 600,
                  color: active ? '#f0f4fc' : '#a6accd',
                  background: active ? 'linear-gradient(135deg, rgba(93,228,199,.22), rgba(137,221,255,.22))' : 'transparent',
                  border: '1px solid ' + (active ? 'rgba(93,228,199,.5)' : 'transparent'),
                  transition: 'all .14s ease',
                }}
              >
                <span style={{ fontSize: 16 }}>{l.flag}</span>
                <span style={{ flex: 1, fontSize: labelSize(l.label) }}>{l.label}</span>
                {active && <span style={{ color: '#5de4c7', fontSize: '14px', fontWeight: 800 }}>✓</span>}
              </div>
            )
          })}

          <div style={{ ...sectionLabel, padding: '12px 10px 6px', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 8 }}>
            {t('accountMenu.security')}
          </div>
          <div
            role="menuitemcheckbox"
            aria-checked={twoFactor}
            onClick={toggleTwoFactor}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#f0f4fc' }}>{t('accountMenu.twoFactorAuth')}</div>
              <div style={{ color: '#a6accd', fontSize: '11.5px' }}>
                {twoFactor ? t('accountMenu.codeRequired') : t('accountMenu.passwordOnly')}
              </div>
            </div>
            <div
              aria-hidden
              style={{
                flex: 'none',
                width: 44,
                height: 24,
                borderRadius: 999,
                padding: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: twoFactor ? 'flex-end' : 'flex-start',
                background: twoFactor ? 'linear-gradient(135deg, #5de4c7, #89ddff)' : 'rgba(255,255,255,0.1)',
                border: '1px solid ' + (twoFactor ? '#5de4c7' : 'rgba(255,255,255,0.2)'),
                boxShadow: twoFactor ? '0 0 10px rgba(93,228,199,0.5)' : 'none',
                transition: 'all .16s ease',
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: twoFactor ? '#13151f' : '#ffffff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}
              />
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 8, paddingTop: 6 }}>
            <div
              role="menuitem"
              onClick={onSignOut}
              style={{ padding: '9px 12px', borderRadius: 10, cursor: 'pointer', fontSize: '13.5px', fontWeight: 700, color: '#d0679d', transition: 'all .14s ease' }}
            >
              {t('accountMenu.signOut')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
