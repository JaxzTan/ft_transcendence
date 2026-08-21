import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../store'
import { avatarBlue, card } from '../theme'
import { UserAvatar } from '../components/UserAvatar'
import { getRankTier } from '../utils/ranks'

type Profile = {
  username: string
  rating: number
  wins: number
  losses: number
  winStreak: number
  bestWinStreak: number
}

type Participant = { username: string; color: number; rank: number | null }
type GameEntry = {
  gameId: string
  rank: number | null
  startedAt: string
  participants: Participant[]
}
type GamesResponse = { games: GameEntry[] }

/** The 15 real achievement flags GET /api/achievements returns, in display order. */
const ACHIEVEMENT_LIST: Array<{ key: string; glyph: string }> = [
  { key: 'achFirstBlood', glyph: '🩸' },
  { key: 'achOnFire', glyph: '🔥' },
  { key: 'achDiceMaster', glyph: '🎲' },
  { key: 'achBabySteps', glyph: '👣' },
  { key: 'achTheDiceLoveMe', glyph: '🍀' },
  { key: 'achTactician', glyph: '♟' },
  { key: 'achMaster', glyph: '👑' },
  { key: 'achGrandBotMaster', glyph: '🤖' },
  { key: 'achWorldChampion', glyph: '🏆' },
  { key: 'achLoveTheMachine', glyph: '❤️' },
  { key: 'achft_Transcendence', glyph: '✨' },
  { key: 'achUnstoppable', glyph: '⚔️' },
  { key: 'achCleanSweep', glyph: '🧹' },
  { key: 'achLastLaugh', glyph: '😄' },
  { key: 'achSpeedDemon', glyph: '⚡' },
]

function relativeTime(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 1) return t('dashboard.justNow')
  if (hours < 24) return t('dashboard.hoursAgo', { count: hours })
  return t('dashboard.daysAgo', { count: Math.floor(hours / 24) })
}

export function Dashboard() {
  const { t } = useTranslation()
  const { user } = useApp()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [games, setGames] = useState<GamesResponse | null>(null)
  const [achievements, setAchievements] = useState<Record<string, boolean> | null>(null)
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null)

  useEffect(() => {
    if (!user?.username) return
    let cancelled = false

    fetch(`/api/user/${user.username}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setProfile(data) })
      .catch(() => { if (!cancelled) setProfile(null) })

    fetch(`/api/user/${user.username}/games?limit=5`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setGames(data) })
      .catch(() => { if (!cancelled) setGames({ games: [] }) })

    fetch('/api/achievements', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setAchievements(data ?? {}) })
      .catch(() => { if (!cancelled) setAchievements({}) })

    fetch('/api/leaderboard?mode=global&limit=1', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data?.myRank?.rank) setLeaderboardRank(data.myRank.rank) })
      .catch(() => { if (!cancelled) setLeaderboardRank(null) })

    return () => { cancelled = true }
  }, [user?.username])

  const totalGames = profile ? profile.wins + profile.losses : 0
  const winRate = totalGames > 0 ? Math.round((profile!.wins / totalGames) * 100) : 0

  const statTiles = profile
    ? [
      { label: t('dashboard.rating'), value: `♛ ${profile.rating}` },
      { label: t('dashboard.gamesPlayed'), value: String(totalGames) },
      { label: t('dashboard.winRate'), value: `${winRate}%` },
      { label: t('dashboard.currentStreak'), value: String(profile.winStreak) },
      { label: t('dashboard.bestStreak'), value: String(profile.bestWinStreak) },
    ]
    : []

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, borderRadius: 18, padding: '24px 26px', background: 'linear-gradient(180deg,#241b13,#1a130d)', border: '1px solid #3a2c1d' }}>
        <UserAvatar
          username={profile?.username ?? user?.username ?? ''}
          size={74}
          fallbackStyle={avatarBlue(74, 26, 18)}
          style={{ boxShadow: '0 0 0 3px #f0d18a55' }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 26, color: '#f4e9cf' }}>
              {profile?.username ?? user?.username ?? t('common.you')}
            </div>
            {profile && (() => {
              const tier = getRankTier(profile.rating, leaderboardRank)
              return (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: tier.bg,
                    color: tier.color,
                    border: `1px solid ${tier.border}`,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                  }}
                >
                  {tier.name}
                </span>
              )
            })()}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: profile ? getRankTier(profile.rating, leaderboardRank).color : '#f0c24e' }}>♛ {profile?.rating ?? '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
        {(profile ? statTiles : Array.from<{ label: string; value: string } | undefined>({ length: 5 })).map((s, i) => (
          <div key={i} style={{ borderRadius: 14, padding: 18, background: 'linear-gradient(180deg,#221a12,#18120c)', border: '1px solid #33261a' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#f0e2c4' }}>{s ? s.value : t('common.loading')}</div>
            <div style={{ color: '#a99a83', fontSize: '12.5px', marginTop: 4, fontWeight: 600 }}>
              {s ? s.label : ''}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#f0e2c4', marginBottom: 14 }}>{t('dashboard.recentMatches')}</div>
          {!games ? (
            <div style={{ color: '#a99a83', fontSize: 13.5, padding: '8px 0' }}>{t('common.loading')}</div>
          ) : games.games.length === 0 ? (
            <div style={{ color: '#a99a83', fontSize: 13.5, padding: '8px 0' }}>{t('dashboard.noMatchesYet')}</div>
          ) : (
            games.games.map((m) => {
              const win = m.rank === 1
              const opponents = m.participants.filter((p) => p.username !== (profile?.username ?? user?.username))
              return (
                <div key={m.gameId} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: '1px solid #2a2015' }}>
                  <div
                    style={{
                      width: 34, height: 34, flex: 'none', borderRadius: 9, display: 'grid', placeItems: 'center',
                      fontWeight: 800, fontSize: 14,
                      color: win ? '#0d1b12' : '#2a0f0c',
                      background: win ? 'linear-gradient(180deg,#5fd08a,#2c8a53)' : 'linear-gradient(180deg,#e4574d,#a8362e)',
                    }}
                  >
                    {win ? t('dashboard.win') : t('dashboard.loss')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {t('dashboard.vs')} {opponents.length > 0 ? opponents.map((o) => o.username).join(', ') : '—'}
                    </div>
                    <div style={{ color: '#a99a83', fontSize: 12 }}>{relativeTime(m.startedAt, t)}</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#f0e2c4', marginBottom: 14 }}>{t('dashboard.achievements')}</div>
          {!achievements ? (
            <div style={{ color: '#a99a83', fontSize: 13.5 }}>{t('common.loading')}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {ACHIEVEMENT_LIST.map((a) => {
                const unlocked = !!achievements[a.key]
                return (
                  <div
                    key={a.key}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 10px',
                      borderRadius: 12, textAlign: 'center',
                      background: unlocked ? 'rgba(240,209,138,.08)' : '#18120c',
                      border: '1px solid ' + (unlocked ? '#4a3826' : '#241a10'),
                    }}
                  >
                    <div
                      style={{
                        width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 20,
                        color: unlocked ? '#2a1c07' : '#4a3826',
                        background: unlocked ? 'linear-gradient(180deg,#f0d18a,#c99b45)' : '#241a10',
                      }}
                    >
                      {a.glyph}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: unlocked ? '#f0e2c4' : '#6b5d49' }}>
                      {t(`dashboard.${a.key}`)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
