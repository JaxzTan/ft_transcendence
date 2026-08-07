import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { navigate, useRoute } from '../router'
import { AccountMenu } from './AccountMenu'
import { btnGold, btnOutline, goldText } from '../theme'
import { apiFetch, getApi, postApi } from '../api'
import type { PlayerColor } from '../game/types'
import { useApp } from '../store'

type PendingInvite = { gameId: string; inviteCode: string; fromUsername: string; createdAt: number }

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
  const { user, setActiveMatch } = useApp()
  const [rating, setRating] = useState<number | null>(null)
  const [invite, setInvite] = useState<PendingInvite | null>(null)
  const [inviteBusy, setInviteBusy] = useState(false)

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

  // Presence/invites are poll-based (no push transport in this backend) —
  // check for an incoming game invite from a friend every few seconds.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const poll = () => {
      getApi<PendingInvite | null>('/api/friends/invites/pending')
        .then((data) => { if (!cancelled) setInvite(data) })
        .catch(() => {})
    }
    poll()
    const iv = setInterval(poll, 8000)
    return () => {
      cancelled = true
      clearInterval(iv)
    }
  }, [user])

  const acceptInvite = async () => {
    if (!invite) return
    setInviteBusy(true)
    try {
      const res = await postApi<{ gameId: string; token: string; engineUrl: string; color: PlayerColor; inviteCode?: string }>(
        `/api/match/join/${encodeURIComponent(invite.inviteCode)}`,
        {},
      )
      setActiveMatch(res)
      setInvite(null)
      navigate(`/game?gameId=${res.gameId}`)
    } catch {
      setInvite(null)
    } finally {
      setInviteBusy(false)
    }
  }

  const dismissInvite = () => {
    setInvite(null)
    postApi('/api/friends/invites/dismiss').catch(() => {})
  }

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

      {invite && (
        <div
          style={{
            position: 'fixed', right: 24, bottom: 24, zIndex: 50, width: 320, padding: 18, borderRadius: 16,
            background: 'linear-gradient(180deg,#241b13,#1a130d)', border: '1px solid #c99b45',
            boxShadow: '0 20px 44px -20px rgba(0,0,0,.85)', display: 'flex', flexDirection: 'column', gap: 12,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14.5, color: '#f0e2c4' }}>
            {t('nav.gameInviteFrom', { name: invite.fromUsername })}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={acceptInvite}
              disabled={inviteBusy}
              style={{ ...btnGold, flex: 1, padding: '10px 14px', fontSize: 13, opacity: inviteBusy ? 0.6 : 1 }}
            >
              {inviteBusy ? '…' : t('nav.acceptInvite')}
            </button>
            <button onClick={dismissInvite} disabled={inviteBusy} style={{ ...btnOutline, flex: 1, padding: '10px 14px', fontSize: 13 }}>
              {t('nav.declineInvite')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
