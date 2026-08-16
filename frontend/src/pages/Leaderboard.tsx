import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { avatarDim, card } from '../theme'
import { useApp } from '../store'

type LeaderboardEntry = {
  rank: number
  username: string
  rating: number
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
  winRate: number
  avatarStyle: string | null
}

type LeaderboardResponse = {
  entries: LeaderboardEntry[]
  total: number
  page: number
  limit: number
  myRank?: { rank: number; username: string; rating: number } | null
}

const ROW_BASE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '64px 1fr 120px 120px 90px',
  gap: 8,
  padding: '14px 22px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  alignItems: 'center',
}

const MEDAL_BASE: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 10,
  display: 'grid',
  placeItems: 'center',
  fontWeight: 900,
  fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
  fontSize: 14,
}

const EMPTY_STATE: CSSProperties = {
  padding: '40px 20px',
  textAlign: 'center',
  color: '#b8a9d4',
  fontSize: '14px',
}

const TABS = [
  { k: 'global', labelKey: 'leaderboard.tabGlobal' },
  { k: 'friends', labelKey: 'leaderboard.tabFriends' },
  { k: 'weekly', labelKey: 'leaderboard.tabWeekly' },
]

function Medal({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span style={{ ...MEDAL_BASE, background: 'linear-gradient(135deg, #ffd66b, #e5a93c)', color: '#0f0a1a', boxShadow: '0 0 14px rgba(255,214,107,0.5)' }}>
        1
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span style={{ ...MEDAL_BASE, background: 'linear-gradient(135deg, #b8a9d4, #70a8db)', color: '#0f0a1a', boxShadow: '0 0 12px rgba(167,139,250,0.4)' }}>
        2
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span style={{ ...MEDAL_BASE, background: 'linear-gradient(135deg, #ff6b8a, #7a1e3a)', color: '#0f0a1a', boxShadow: '0 0 12px rgba(255,107,138,0.4)' }}>
        3
      </span>
    )
  }
  return (
    <span style={{ ...MEDAL_BASE, background: 'transparent', color: '#b8a9d4' }}>
      {rank}
    </span>
  )
}

export function Leaderboard() {
  const { t } = useTranslation()
  const { user } = useApp()
  const [tab, setTab] = useState('global')
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (tab !== 'global') return
    let cancelled = false
    setLoading(true)
    fetch('/api/leaderboard?mode=global&limit=20', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<LeaderboardResponse>) : Promise.reject(r.status)))
      .then((body) => {
        if (!cancelled) setData(body)
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab])

  const entries = data?.entries ?? []
  const myRank = data?.myRank
  const mineOnPage = myRank ? entries.some((e) => e.username === myRank.username) : false

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {TABS.map((tabItem) => {
          const active = tab === tabItem.k
          return (
            <div
              key={tabItem.k}
              onClick={() => setTab(tabItem.k)}
              style={{
                cursor: 'pointer',
                padding: '10px 20px',
                borderRadius: 14,
                fontWeight: 800,
                fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                fontSize: '14px',
                color: active ? '#0f0a1a' : '#b8a9d4',
                background: active ? 'linear-gradient(135deg, #a78bfa, #6bb8ff)' : 'rgba(255,255,255,0.05)',
                border: '1px solid ' + (active ? 'rgba(167,139,250,0.8)' : 'rgba(255,255,255,0.08)'),
                boxShadow: active ? '0 4px 16px rgba(167,139,250,0.35)' : 'none',
                transition: 'all .16s ease',
              }}
            >
              {t(tabItem.labelKey)}
            </div>
          )
        })}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '64px 1fr 120px 120px 90px',
            gap: 8,
            padding: '16px 22px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            font: "800 12px 'Space Grotesk', 'Outfit', sans-serif",
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: '#b8a9d4',
          }}
        >
          <div>{t('leaderboard.rank')}</div>
          <div>{t('leaderboard.player')}</div>
          <div style={{ textAlign: 'right' }}>{t('leaderboard.rating')}</div>
          <div style={{ textAlign: 'right' }}>{t('leaderboard.wins')}</div>
          <div style={{ textAlign: 'right' }}>{t('leaderboard.winPercent')}</div>
        </div>

        {tab !== 'global' ? (
          <div style={EMPTY_STATE}>{t('leaderboard.comingSoon')}</div>
        ) : loading ? (
          <div style={EMPTY_STATE}>{t('common.loading')}</div>
        ) : entries.length === 0 ? (
          <div style={EMPTY_STATE}>{t('leaderboard.noRankedPlayers')}</div>
        ) : (
          entries.map((e) => {
            const isMe = e.username === myRank?.username
            return (
              <div
                key={e.username}
                style={
                  isMe
                    ? { ...ROW_BASE, background: 'linear-gradient(90deg, rgba(167,139,250,0.18), rgba(244,114,182,0.15))', borderLeft: '3px solid #a78bfa' }
                    : ROW_BASE
                }
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Medal rank={e.rank} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ ...avatarDim(36) }}>{e.username.slice(0, 2).toUpperCase()}</div>
                  <span style={{ fontWeight: 700, fontSize: '15px', color: '#f8f0ff', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                    {isMe ? t('common.you') : e.username}
                  </span>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 800, color: '#ffd66b', fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontSize: 15 }}>
                  ♛ {e.rating.toLocaleString()}
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, color: '#d4c8e8' }}>{e.wins}</div>
                <div style={{ textAlign: 'right', fontWeight: 700, color: '#a78bfa' }}>{e.winRate}%</div>
              </div>
            )
          })
        )}

        {tab === 'global' && user && myRank && !mineOnPage && (
          <div
            style={{
              ...ROW_BASE,
              background: 'linear-gradient(90deg, rgba(167,139,250,0.2), rgba(244,114,182,0.18))',
              borderTop: '2px solid rgba(167,139,250,0.4)',
              borderBottom: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ ...MEDAL_BASE, background: 'transparent', color: '#a78bfa' }}>{myRank.rank}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  fontWeight: 900, fontSize: 13, background: 'linear-gradient(135deg, #a78bfa, #6bb8ff)', color: '#0f0a1a',
                  boxShadow: '0 0 12px rgba(167,139,250,0.5)', fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                }}
              >
                YO
              </div>
              <span style={{ fontWeight: 800, fontSize: '15px', color: '#f8f0ff', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{t('common.you')}</span>
            </div>
            <div style={{ textAlign: 'right', fontWeight: 800, color: '#ffd66b', fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontSize: 15 }}>
              ♛ {myRank.rating.toLocaleString()}
            </div>
            <div style={{ textAlign: 'right', fontWeight: 600, color: '#b8a9d4' }}>—</div>
            <div style={{ textAlign: 'right', fontWeight: 600, color: '#b8a9d4' }}>—</div>
          </div>
        )}
      </div>
    </div>
  )
}
