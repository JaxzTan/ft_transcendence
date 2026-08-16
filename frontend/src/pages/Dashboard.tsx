import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../store'
import { avatarBlue, card } from '../theme'

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

    return () => { cancelled = true }
  }, [user?.username])

  const totalGames = profile ? profile.wins + profile.losses : 0
  const winRate = totalGames > 0 ? Math.round((profile!.wins / totalGames) * 100) : 0
  const initials = (profile?.username ?? user?.username ?? '').slice(0, 2).toUpperCase()

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
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 22, borderRadius: 24, padding: '26px 30px',
          background: 'linear-gradient(145deg, rgba(40,28,65,0.85), rgba(25,18,42,0.95))',
          border: '1px solid rgba(167,139,250,0.25)',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div style={{ ...avatarBlue(76, 28, 20), boxShadow: '0 0 0 4px rgba(167,139,250,0.35), 0 0 24px rgba(244,114,182,0.4)' }}>
          {initials || 'YO'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontSize: 28, fontWeight: 900, color: '#f8f0ff', letterSpacing: -0.5 }}>
            {profile?.username ?? user?.username ?? t('common.you')}
          </div>
          <div style={{ color: '#b8a9d4', fontSize: 14, fontWeight: 600, marginTop: 2 }}>
            Level {(profile ? Math.floor(profile.wins / 3) + 1 : 1)} Player
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#ffd66b', fontFamily: "'Space Grotesk', 'Outfit', sans-serif", textShadow: '0 0 16px rgba(255,214,107,0.3)' }}>
            ♛ {profile?.rating ?? '—'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }}>
        {(profile ? statTiles : Array.from<{ label: string; value: string } | undefined>({ length: 5 })).map((s, i) => (
          <div
            key={i}
            className="interactive-card"
            style={{
              borderRadius: 18, padding: '20px 18px',
              background: 'linear-gradient(145deg, rgba(40,28,65,0.8), rgba(25,18,42,0.9))',
              border: '1px solid rgba(167,139,250,0.2)',
              boxShadow: '0 10px 24px -8px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 900, color: i === 0 ? '#ffd66b' : i === 2 ? '#a78bfa' : '#f8f0ff', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
              {s ? s.value : t('common.loading')}
            </div>
            <div style={{ color: '#b8a9d4', fontSize: '13px', marginTop: 4, fontWeight: 700, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
              {s ? s.label : ''}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1.05fr', gap: 20 }}>
        <div style={{ ...card, padding: 26 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#f8f0ff', marginBottom: 16, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{t('dashboard.recentMatches')}</div>
          {!games ? (
            <div style={{ color: '#b8a9d4', fontSize: 14, padding: '12px 0' }}>{t('common.loading')}</div>
          ) : games.games.length === 0 ? (
            <div style={{ color: '#b8a9d4', fontSize: 14, padding: '12px 0' }}>{t('dashboard.noMatchesYet')}</div>
          ) : (
            games.games.map((m) => {
              const win = m.rank === 1
              const opponents = m.participants.filter((p) => p.username !== (profile?.username ?? user?.username))
              return (
                <div key={m.gameId} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div
                    style={{
                      width: 36, height: 36, flex: 'none', borderRadius: 10, display: 'grid', placeItems: 'center',
                      fontWeight: 900, fontSize: 14,
                      color: '#0f0a1a',
                      background: win ? 'linear-gradient(135deg, #a78bfa, #6bb8ff)' : 'linear-gradient(135deg, #ff6b8a, #7a1e3a)',
                      boxShadow: win ? '0 0 14px rgba(167,139,250,0.4)' : '0 0 14px rgba(255,107,138,0.4)',
                      fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                    }}
                  >
                    {win ? t('dashboard.win') : t('dashboard.loss')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: '#f8f0ff', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                      {t('dashboard.vs')} {opponents.length > 0 ? opponents.map((o) => o.username).join(', ') : '—'}
                    </div>
                    <div style={{ color: '#b8a9d4', fontSize: 12.5 }}>{relativeTime(m.startedAt, t)}</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div style={{ ...card, padding: 26 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#f8f0ff', marginBottom: 16, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{t('dashboard.achievements')}</div>
          {!achievements ? (
            <div style={{ color: '#b8a9d4', fontSize: 14 }}>{t('common.loading')}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
              {ACHIEVEMENT_LIST.map((a) => {
                const unlocked = !!achievements[a.key]
                return (
                  <div
                    key={a.key}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px',
                      borderRadius: 16, textAlign: 'center',
                      background: unlocked ? 'linear-gradient(145deg, rgba(167,139,250,0.15), rgba(244,114,182,0.2))' : 'rgba(255,255,255,0.03)',
                      border: '1px solid ' + (unlocked ? 'rgba(167,139,250,0.45)' : 'rgba(255,255,255,0.06)'),
                      boxShadow: unlocked ? '0 0 16px rgba(167,139,250,0.25)' : 'none',
                      opacity: unlocked ? 1 : 0.45,
                      transition: 'all .15s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 22,
                        color: '#0f0a1a',
                        background: unlocked ? 'linear-gradient(135deg, #a78bfa, #6bb8ff)' : 'rgba(255,255,255,0.06)',
                        boxShadow: unlocked ? '0 0 14px rgba(167,139,250,0.5)' : 'none',
                      }}
                    >
                      {a.glyph}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: unlocked ? '#f8f0ff' : '#665f80', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
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
