import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RetroNavbar } from '../components/RetroNavbar'
import { UserAvatar } from '../components/UserAvatar'
import { navigate } from '../router'
import { useApp } from '../store'
import { retroAudio } from '../utils/audio'
import { getRankTier } from '../utils/ranks'
import { RankBadge } from '../components/RankBadge'
import '../styles/retrowave.css'

interface Profile {
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

  // ------------------------------------------------------------------------
  // CRT CONTROLS
  // ------------------------------------------------------------------------
  const [crtEnabled, setCrtEnabled] = useState(true)

  useEffect(() => {
    const savedCrt = localStorage.getItem('retro_crt')
    if (savedCrt === 'false') {
      setCrtEnabled(false)
    }
  }, [])

  const toggleCrt = () => {
    const next = !crtEnabled
    setCrtEnabled(next)
    localStorage.setItem('retro_crt', next ? 'true' : 'false')
    retroAudio.playUiBeep(440, 0.05)
  }

  const [profile, setProfile] = useState<Profile | null>(null)
  const [games, setGames] = useState<GamesResponse | null>(null)
  const [achievements, setAchievements] = useState<Record<string, boolean> | null>(null)
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null)

  useEffect(() => {
    if (!user?.username) return
    let cancelled = false

    fetch(`/api/user/${user.username}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setProfile(data)
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })

    fetch(`/api/user/${user.username}/games?limit=5`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setGames(data)
      })
      .catch(() => {
        if (!cancelled) setGames({ games: [] })
      })

    fetch('/api/achievements', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setAchievements(data ?? {})
      })
      .catch(() => {
        if (!cancelled) setAchievements({})
      })

    fetch('/api/leaderboard?mode=global&limit=1', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.myRank?.rank) setLeaderboardRank(data.myRank.rank)
      })
      .catch(() => {
        if (!cancelled) setLeaderboardRank(null)
      })

    return () => {
      cancelled = true
    }
  }, [user?.username])

  const totalGames = profile ? profile.wins + profile.losses : 0
  const winRate = totalGames > 0 ? Math.round((profile!.wins / totalGames) * 100) : 0
  const currentTier = getRankTier(profile?.rating ?? 1200, leaderboardRank)

  const statTiles = profile
    ? [
      { label: t('dashboard.rating'), value: `♛ ${profile.rating}`, hue: currentTier.color, badge: currentTier.badge },
      { label: t('dashboard.gamesPlayed'), value: String(totalGames), hue: '#00f0ff' },
      { label: t('dashboard.winRate'), value: `${winRate}%`, hue: '#00ff88' },
      { label: t('dashboard.currentStreak'), value: String(profile.winStreak), hue: '#ff007f' },
      { label: t('dashboard.bestStreak'), value: String(profile.bestWinStreak), hue: '#9d00ff' },
    ]
    : []

  const unlockedCount = achievements ? Object.values(achievements).filter(Boolean).length : 0

  return (
    <>
      {/* Animated 3D Synthwave Grid & Sun Background */}
      <div className="grid-background">
        <div className="synthwave-sun" />
        <div className="grid-horizon" />
        <div className="perspective-grid" />
        <div className="win95-starfield" />
        <div className="terminal-vector-core" />
      </div>

      {/* CRT Monitor Overlay FX Container */}
      <div className={`crt-screen ${crtEnabled ? 'crt-curved' : ''}`} id="crtScreen">
        <div
          className="crt-scanlines"
          id="crtOverlay"
          style={{ display: crtEnabled ? 'block' : 'none' }}
        />
        <div className="crt-flicker" />

        {/* Main Content Wrapper */}
        <div className="app-wrapper">
          {/* Navigation Header */}
          <RetroNavbar
            activeRoute="/dashboard"
            crtEnabled={crtEnabled}
            toggleCrt={toggleCrt}
          />

          {/* Hero Telemetry Banner */}
          <header className="hero-section" style={{ padding: '16px 0 14px' }}>
            <h1 className="hero-title" style={{ fontSize: '1.45rem', marginBottom: 4 }}>
              TACTICAL HUD // PILOT DASHBOARD
            </h1>
            <p className="hero-subtitle" style={{ fontSize: '0.75rem', marginBottom: 0 }}>
              LIVE COMBAT TELEMETRY, CYBER ACHIEVEMENTS & RECON LOGS
            </p>

            <div className="badge-bar" style={{ marginTop: 12 }}>
              <span
                className="retro-badge"
                style={{
                  border: '1px solid var(--accent-cyan)',
                  color: 'var(--accent-cyan)',
                }}
              >
                // CALLSIGN: {user?.username?.toUpperCase() ?? 'GUEST'}
              </span>
              <span
                className="retro-badge"
                style={{
                  border: `1px solid ${currentTier.border}`,
                  color: currentTier.color,
                  boxShadow: `0 0 8px ${currentTier.glow}`,
                }}
              >
                // RANK: {currentTier.name} ({profile?.rating ?? 1200} ELO)
              </span>
              <span
                className="retro-badge"
                style={{
                  border: '1px solid #00ff88',
                  color: '#00ff88',
                }}
              >
                // ACHIEVEMENTS: {unlockedCount}/15 UNLOCKED
              </span>
            </div>
          </header>

          {/* Pilot Dossier Card Window */}
          <section className="retro-window" style={{ maxWidth: 1100, margin: '0 auto 20px', width: '100%' }}>
            <div className="window-header">
              <span>👤 PILOT DOSSIER // CALLSIGN OVERVIEW</span>
              <div className="window-controls">
                <span className="window-btn min" />
                <span className="window-btn max" />
              </div>
            </div>

            <div
              className="window-body"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
                padding: '16px 20px',
                background: 'rgba(25, 10, 56, 0.75)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    padding: 3,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-pink))',
                    boxShadow: '0 0 16px rgba(0, 240, 255, 0.4)',
                  }}
                >
                  <UserAvatar
                    username={profile?.username ?? user?.username ?? ''}
                    size={68}
                    fallbackStyle={{
                      width: 68,
                      height: 68,
                      borderRadius: 6,
                      background: 'rgba(10, 2, 28, 0.95)',
                      color: 'var(--accent-cyan)',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '1.4rem',
                      fontWeight: 'bold',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '1.25rem',
                        color: '#ffffff',
                        textShadow: '0 0 8px var(--accent-cyan)',
                        letterSpacing: '1px',
                      }}
                    >
                      {profile?.username ?? user?.username ?? t('common.you')}
                    </span>
                    <RankBadge tier={currentTier} fontSize="0.78rem" padding="3px 10px" />
                  </div>
                  <div style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    // COMBAT STATUS: ACTIVE PILOT • {currentTier.badge} • ELO {profile?.rating ?? 1200}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  className="retro-btn"
                  style={{ padding: '8px 16px', fontSize: '0.75rem' }}
                  onClick={() => {
                    retroAudio.playUiBeep(700, 0.05)
                    navigate('/gamelobby')
                  }}
                >
                  ⚔️ ENTER ARENA
                </button>
                <button
                  className="retro-btn"
                  style={{ padding: '8px 16px', fontSize: '0.75rem' }}
                  onClick={() => {
                    retroAudio.playUiBeep(700, 0.05)
                    navigate('/profile')
                  }}
                >
                  @/ DOSSIER SETTINGS
                </button>
              </div>
            </div>
          </section>

          {/* 5-Tile Tactical Telemetry Matrix */}
          <div
            style={{
              maxWidth: 1100,
              margin: '0 auto 20px',
              width: '100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 14,
            }}
          >
            {(profile ? statTiles : Array.from<{ label: string; value: string; hue: string; badge?: string } | undefined>({ length: 5 })).map(
              (s, i) => (
                <div
                  key={i}
                  className="retro-window"
                  style={{
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(25, 10, 56, 0.65)',
                    border: `1px solid ${s?.hue ? s.hue + '55' : 'rgba(0, 240, 255, 0.3)'}`,
                  }}
                >
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
                    {s ? s.label.toUpperCase() : '...'}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '1.45rem',
                      color: s?.hue ?? '#ffffff',
                      textShadow: s?.hue ? `0 0 10px ${s.hue}` : 'none',
                    }}
                  >
                    {s ? s.value : '...'}
                  </div>
                  {s?.badge && (
                    <span style={{ fontSize: '0.65rem', color: s.hue, fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                      {s.badge}
                    </span>
                  )}
                </div>
              ),
            )}
          </div>

          {/* Main 2-Column Section: Match History & Achievement Vault */}
          <div
            style={{
              maxWidth: 1100,
              margin: '0 auto',
              width: '100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 20,
            }}
          >
            {/* Match History Recon Logs */}
            <section className="retro-window">
              <div className="window-header">
                <span>📜 RECON LOGS // COMBAT ARCHIVE</span>
                <div className="window-controls">
                  <span className="window-btn min" />
                  <span className="window-btn max" />
                </div>
              </div>

              <div
                className="window-body"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: 14,
                  background: 'rgba(25, 10, 56, 0.65)',
                }}
              >
                {!games || games.games.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                    NO COMBAT TELEMETRY LOGGED. DEPLOY INTO ARENA.
                  </div>
                ) : (
                  games.games.map((g) => {
                    const isWin = g.rank === 1
                    return (
                      <div
                        key={g.gameId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 4,
                          background: isWin ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255, 0, 127, 0.08)',
                          border: `1px solid ${isWin ? 'rgba(0, 255, 136, 0.35)' : 'rgba(255, 0, 127, 0.35)'}`,
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '1.2rem' }}>{isWin ? '🏆' : '💀'}</span>
                          <div>
                            <div
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 'bold',
                                color: isWin ? '#00ff88' : '#ff007f',
                                letterSpacing: '0.5px',
                              }}
                            >
                              {isWin ? 'VICTORY SECURED' : `DEFEATED // RANK #${g.rank ?? '?'}`}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginTop: 2 }}>
                              {g.participants.length} COMBATANTS • {relativeTime(g.startedAt, t)}
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 8px',
                            borderRadius: 3,
                            background: isWin ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 0, 127, 0.2)',
                            color: isWin ? '#00ff88' : '#ff007f',
                            border: `1px solid ${isWin ? '#00ff88' : '#ff007f'}`,
                            fontWeight: 'bold',
                          }}
                        >
                          {isWin ? '+ELO' : '-ELO'}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            {/* Achievement Matrix Vault */}
            <section className="retro-window">
              <div className="window-header">
                <span>🏆 CYBER VAULT // ACHIEVEMENTS ({unlockedCount}/15)</span>
                <div className="window-controls">
                  <span className="window-btn min" />
                  <span className="window-btn max" />
                </div>
              </div>

              <div
                className="window-body"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 10,
                  padding: 14,
                  background: 'rgba(25, 10, 56, 0.65)',
                }}
              >
                {ACHIEVEMENT_LIST.map((ach) => {
                  const isUnlocked = achievements ? !!achievements[ach.key] : false
                  return (
                    <div
                      key={ach.key}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 4,
                        textAlign: 'center',
                        background: isUnlocked ? 'rgba(255, 230, 0, 0.08)' : 'rgba(0, 0, 0, 0.35)',
                        border: `1px solid ${isUnlocked ? 'rgba(255, 230, 0, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                        opacity: isUnlocked ? 1 : 0.45,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ fontSize: '1.4rem', marginBottom: 4, filter: isUnlocked ? 'none' : 'grayscale(1)' }}>
                        {ach.glyph}
                      </div>
                      <div
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 'bold',
                          color: isUnlocked ? '#ffe600' : 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {t(`dashboard.${ach.key}`, ach.key)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
