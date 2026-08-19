import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { MEDAL_COLORS } from '../data'
import { avatarDim, card } from '../theme'
import { useApp } from '../store'
import { UserAvatar } from '../components/UserAvatar'

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
  padding: '12px 20px',
  borderBottom: '1px solid #241a10',
  alignItems: 'center',
}

const MEDAL_BASE: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  display: 'grid',
  placeItems: 'center',
  fontWeight: 800,
  fontSize: 13,
}

const EMPTY_STATE: CSSProperties = {
  padding: '32px 20px',
  textAlign: 'center',
  color: '#a99a83',
  fontSize: '13.5px',
}

// Only 'global' is backed by the API today (LeaderboardService only tracks
// rating per game mode, not per-social-graph or time window) — the other
// tabs are left as a visible "coming soon" rather than faked client-side.
const TABS = [
  { k: 'global', labelKey: 'leaderboard.tabGlobal' },
  { k: 'friends', labelKey: 'leaderboard.tabFriends' },
  { k: 'weekly', labelKey: 'leaderboard.tabWeekly' },
]

function Medal({ rank }: { rank: number }) {
  return (
    <span
      style={
        rank <= 3
          ? { ...MEDAL_BASE, background: MEDAL_COLORS[rank - 1], color: '#241a0c' }
          : { ...MEDAL_BASE, background: 'transparent', color: '#a99a83' }
      }
    >
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
  // If the logged-in user is already on this page, highlight that row
  // instead of appending a second "you" row for the same rank.
  const mineOnPage = myRank ? entries.some((e) => e.username === myRank.username) : false

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {TABS.map((tabItem) => {
          const active = tab === tabItem.k
          return (
            <div
              key={tabItem.k}
              onClick={() => setTab(tabItem.k)}
              style={{
                cursor: 'pointer',
                padding: '9px 18px',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: '13.5px',
                color: active ? '#2a1c07' : '#c9bda3',
                background: active ? 'linear-gradient(180deg,#f0d18a,#c99b45)' : '#1a130d',
                border: '1px solid ' + (active ? '#b8873a' : '#3a2c1d'),
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
            padding: '14px 20px',
            borderBottom: '1px solid #2e2115',
            font: "700 12px 'Hanken Grotesk'",
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: '#a99a83',
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
                    ? { ...ROW_BASE, background: 'linear-gradient(90deg,rgba(74,146,224,.14),transparent)' }
                    : ROW_BASE
                }
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Medal rank={e.rank} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <UserAvatar
                    username={e.username}
                    size={34}
                    fallbackStyle={avatarDim(34)}
                  />
                  <span style={{ fontWeight: 700, fontSize: '14.5px' }}>{isMe ? t('common.you') : e.username}</span>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 800, color: '#f0c24e' }}>{e.rating}</div>
                <div style={{ textAlign: 'right', fontWeight: 600, color: '#c9bda3' }}>{e.wins}</div>
                <div style={{ textAlign: 'right', fontWeight: 600, color: '#c9bda3' }}>{e.winRate}%</div>
              </div>
            )
          })
        )}

        {tab === 'global' && user && myRank && !mineOnPage && (
          <div
            style={{
              ...ROW_BASE,
              background: 'linear-gradient(90deg,rgba(74,146,224,.14),transparent)',
              borderTop: '1px solid #4a92e055',
              borderBottom: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ ...MEDAL_BASE, background: 'transparent', color: '#4a92e0' }}>{myRank.rank}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <UserAvatar
                username={user.username}
                size={34}
                fallbackStyle={{
                  width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  fontWeight: 800, fontSize: 12, background: 'linear-gradient(180deg,#4a92e0,#2c66ad)', color: '#0d1b28',
                }}
              />
              <span style={{ fontWeight: 800, fontSize: '14.5px' }}>{t('common.you')}</span>
            </div>
            <div style={{ textAlign: 'right', fontWeight: 800, color: '#f0c24e' }}>{myRank.rating.toLocaleString()}</div>
            <div style={{ textAlign: 'right', fontWeight: 600, color: '#c9bda3' }}>—</div>
            <div style={{ textAlign: 'right', fontWeight: 600, color: '#c9bda3' }}>—</div>
          </div>
        )}
      </div>
    </div>
  )
}
