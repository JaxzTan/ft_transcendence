import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { navigate, useRoute } from '../router'
import { AccountMenu } from './AccountMenu'
import { btnGold, goldText } from '../theme'
import { apiFetch } from '../api'
import { useApp } from '../store'

const NAV: Array<{ path: string; glyph: string; titleKey: string }> = [
  { path: '/home', glyph: '⌂', titleKey: 'nav.home' },
  { path: '/dashboard', glyph: '▦', titleKey: 'nav.dashboard' },
  { path: '/friends', glyph: '♟', titleKey: 'nav.friends' },
  { path: '/profile', glyph: '👤', titleKey: 'nav.profile' },
  { path: '/leaderboard', glyph: '♛', titleKey: 'nav.leaderboard' },
]

export const SCREEN_TITLE_KEYS: Record<string, string> = {
  '/home': 'nav.home',
  '/dashboard': 'nav.playerDashboard',
  '/leaderboard': 'nav.leaderboard',
  '/friends': 'nav.friends',
  '/profile': 'nav.playerProfile',
}

function railItemStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '11px 12px',
    borderRadius: 11,
    cursor: 'pointer',
    color: active ? '#f4e9cf' : '#b6a88f',
    background: active ? 'linear-gradient(180deg,#2e2317,#241a0f)' : 'transparent',
    border: '1px solid ' + (active ? '#4a3826' : 'transparent'),
    boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,.06)' : 'none',
  }
}

function railGlyphStyle(active: boolean): CSSProperties {
  return {
    width: 30,
    height: 30,
    flex: 'none',
    display: 'grid',
    placeItems: 'center',
    borderRadius: 8,
    fontSize: 15,
    color: active ? '#3a2a10' : '#d8b25e',
    background: active ? 'linear-gradient(180deg,#f0d18a,#c99b45)' : '#2a2016',
    border: '1px solid ' + (active ? '#b8873a' : '#3e2f1f'),
  }
}

/** Sidebar rail + top header wrapping home/dashboard/leaderboard/friends/settings. */
export function Shell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { path } = useRoute()
  const { user } = useApp()
  const [rating, setRating] = useState<number | null>(null)

  useEffect(() => {
    if (!user) {
      setRating(null)
      return
    }
    let cancelled = false
    apiFetch('/api/leaderboard?mode=global&limit=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled) setRating(body?.myRank?.rating ?? null)
      })
      .catch(() => {
        if (!cancelled) setRating(null)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <aside
        style={{
          width: 246,
          flex: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '22px 16px',
          background: 'linear-gradient(180deg,#1e160f,#150f0a)',
          borderRight: '1px solid #2e2115',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '6px 8px 20px' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              flex: 'none',
              background:
                'conic-gradient(from 45deg,#4bbf7b 0 90deg,#f0c24e 90deg 180deg,#4a92e0 180deg 270deg,#e4574d 270deg 360deg)',
              boxShadow: 'inset 0 0 0 3px #17110b,0 4px 10px -3px #000',
            }}
          />
          <div
            style={{
              fontFamily: "'Cinzel',serif",
              fontWeight: 700,
              letterSpacing: 1,
              fontSize: 19,
              lineHeight: 1,
              ...goldText,
            }}
          >
            LUDO
            <br />
            ROYALE
          </div>
        </div>
        {NAV.map((it) => {
          const active = path === it.path
          return (
            <div key={it.path} style={railItemStyle(active)} onClick={() => navigate(it.path)}>
              <div style={railGlyphStyle(active)}>{it.glyph}</div>
              <div style={{ fontWeight: 600, fontSize: '14.5px' }}>{t(it.titleKey)}</div>
            </div>
          )
        })}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate('/lobby')}
          style={{
            ...btnGold,
            padding: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12 }}>▶</span>{t('nav.playNow')}
        </button>
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 32px',
            borderBottom: '1px solid #2e2115',
            background: 'rgba(20,14,9,.55)',
          }}
        >
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 600, color: '#f0e2c4' }}>
            {SCREEN_TITLE_KEYS[path] ? t(SCREEN_TITLE_KEYS[path]) : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999,
                border: '1px solid #3a2c1d', background: '#1a130d', fontWeight: 700, fontSize: 14, color: '#e8dcc6',
              }}
            >
              <span style={{ color: '#f0c24e' }}>♛</span>{rating !== null ? rating.toLocaleString() : '—'}
            </div>
            <AccountMenu />
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>{children}</div>
      </main>
    </div>
  )
}
