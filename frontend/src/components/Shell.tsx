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
    padding: '12px 14px',
    borderRadius: 16,
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
    color: active ? '#f8f0ff' : '#b8a9d4',
    background: active ? 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(244,114,182,0.15))' : 'transparent',
    border: '1px solid ' + (active ? 'rgba(167,139,250,0.45)' : 'transparent'),
    boxShadow: active ? '0 8px 24px -6px rgba(167,139,250,0.3), inset 0 1px 0 rgba(255,255,255,0.1)' : 'none',
    transition: 'all 0.18s ease',
  }
}

function railGlyphStyle(active: boolean): CSSProperties {
  return {
    width: 32,
    height: 32,
    flex: 'none',
    display: 'grid',
    placeItems: 'center',
    borderRadius: 10,
    fontSize: 16,
    color: active ? '#fff' : '#a78bfa',
    background: active ? 'linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)' : 'rgba(255,255,255,0.06)',
    border: '1px solid ' + (active ? 'rgba(255,255,255,0.3)' : 'rgba(167,139,250,0.2)'),
    boxShadow: active ? '0 0 16px rgba(167,139,250,0.5)' : 'none',
    transition: 'all 0.18s ease',
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
        .catch(() => { })
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
    postApi('/api/friends/invites/dismiss').catch(() => { })
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <aside
        style={{
          width: 256,
          flex: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '24px 16px',
          background: 'linear-gradient(180deg, rgba(30, 22, 48, 0.95), rgba(18, 12, 32, 0.98))',
          borderRight: '1px solid rgba(167, 139, 250, 0.15)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 8px 24px' }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              flex: 'none',
              background:
                'conic-gradient(from 45deg, #4adeab 0 90deg, #ffd66b 90deg 180deg, #6bb8ff 180deg 270deg, #ff6b8a 270deg 360deg)',
              boxShadow: '0 0 20px rgba(167,139,250,0.4), inset 0 0 0 2px rgba(255,255,255,0.3)',
            }}
          />
          <div
            style={{
              fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
              fontWeight: 900,
              letterSpacing: 1.5,
              fontSize: 22,
              lineHeight: 1.05,
              ...goldText,
            }}
          >
            42
            <br />
            LUDO
          </div>
        </div>
        {NAV.map((it) => {
          const active = path === it.path
          return (
            <div key={it.path} style={railItemStyle(active)} onClick={() => navigate(it.path)}>
              <div style={railGlyphStyle(active)}>{it.glyph}</div>
              <div style={{ fontWeight: active ? 700 : 600, fontSize: '15px' }}>{t(it.titleKey)}</div>
            </div>
          )
        })}
        <div style={{ flex: 1 }} />
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            position: 'relative',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 36px',
            borderBottom: '1px solid rgba(167, 139, 250, 0.15)',
            background: 'rgba(20, 14, 35, 0.7)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div style={{ fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: '#f8f0ff', letterSpacing: '-0.02em' }}>
            {SCREEN_TITLE_KEYS[path] ? t(SCREEN_TITLE_KEYS[path]) : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999,
                border: '1px solid rgba(255, 214, 107, 0.4)', background: 'rgba(255, 214, 107, 0.12)',
                fontWeight: 800, fontSize: 14, color: '#ffd66b',
                boxShadow: '0 0 16px rgba(255, 214, 107, 0.2)',
                fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
              }}
            >
              <span style={{ color: '#ffd66b', fontSize: 16 }}>♛</span>{rating !== null ? rating.toLocaleString() : '—'}
            </div>
            <AccountMenu />
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>{children}</div>
      </main>

      {invite && (
        <div
          style={{
            position: 'fixed', right: 24, bottom: 24, zIndex: 50, width: 340, padding: 20, borderRadius: 22,
            background: 'linear-gradient(145deg, rgba(40, 28, 65, 0.96), rgba(25, 18, 42, 0.98))',
            border: '1px solid rgba(167, 139, 250, 0.5)',
            boxShadow: '0 20px 44px -10px rgba(167, 139, 250, 0.35), 0 0 20px rgba(244, 114, 182, 0.2)',
            display: 'flex', flexDirection: 'column', gap: 14,
            backdropFilter: 'blur(20px)',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15, color: '#f8f0ff', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
            {t('nav.gameInviteFrom', { name: invite.fromUsername })}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={acceptInvite}
              disabled={inviteBusy}
              style={{ ...btnGold, flex: 1, padding: '10px 14px', fontSize: 13.5, opacity: inviteBusy ? 0.6 : 1 }}
            >
              {inviteBusy ? '…' : t('nav.acceptInvite')}
            </button>
            <button onClick={dismissInvite} disabled={inviteBusy} style={{ ...btnOutline, flex: 1, padding: '10px 14px', fontSize: 13.5 }}>
              {t('nav.declineInvite')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
