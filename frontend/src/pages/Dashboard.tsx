import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from '../components/UserAvatar'
import { navigate } from '../router'
import { useApp } from '../store'
import { retroAudio } from '../utils/audio'
import '../styles/retrowave.css'

type ThemeType = 'synthwave' | 'win95' | 'terminal'

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

  // ------------------------------------------------------------------------
  // THEME & CRT CONTROLS
  // ------------------------------------------------------------------------
  const [theme, setTheme] = useState<ThemeType>('synthwave')
  const [isThemePopoverOpen, setIsThemePopoverOpen] = useState(false)
  const [crtEnabled, setCrtEnabled] = useState(true)

  const applyTheme = (newTheme: ThemeType) => {
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    document.body.setAttribute('data-theme', newTheme)
    localStorage.setItem('retro_theme', newTheme)
    retroAudio.playUiBeep(880, 0.05)
  }

  useEffect(() => {
    const savedTheme = (localStorage.getItem('retro_theme') as ThemeType) || 'synthwave'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)
    document.body.setAttribute('data-theme', savedTheme)

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

    return () => {
      cancelled = true
    }
  }, [user?.username])

  const totalGames = profile ? profile.wins + profile.losses : 0
  const winRate = totalGames > 0 ? Math.round((profile!.wins / totalGames) * 100) : 0

  const statTiles = profile
    ? [
      { label: t('dashboard.rating'), value: `♛ ${profile.rating}`, hue: '#ffe600' },
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
          <nav className="navbar" id="mainNav">
            <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="retro-btn"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                onClick={() => {
                  retroAudio.playUiBeep(440, 0.05)
                  navigate('/home')
                }}
                title="Return to Hub"
              >
                ← HUB
              </button>
              <div
                className="brand-42-logo"
                style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => {
                  retroAudio.playUiBeep(440, 0.05)
                  navigate('/home')
                }}
                title="42 Hub"
              >
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  style={{
                    fill: 'var(--accent-cyan)',
                    filter: 'drop-shadow(0 0 8px var(--accent-cyan)) drop-shadow(0 0 14px var(--accent-pink))',
                  }}
                >
                  <path d="M19.581 16.851H24v-4.439ZM24 3.574h-4.419v4.42l-4.419 4.418v4.44h4.419v-4.44L24 7.993Zm-4.419 0h-4.419v4.42zm-6.324 8.838H4.419l8.838-8.838H8.838L0 12.412v3.595h8.838v4.419h4.419z" />
                </svg>
              </div>
            </div>

            <div className="nav-controls">
              <button
                className="retro-btn theme-trigger-btn"
                style={{ justifyContent: 'center', gap: 6 }}
                onClick={() => {
                  retroAudio.playUiBeep(600, 0.05)
                  navigate('/gamelobby')
                }}
              >
                <span className="theme-btn-icon">&gt;_</span>
                <span className="theme-btn-text">LOBBY</span>
              </button>
              <button
                className="retro-btn theme-trigger-btn"
                style={{ justifyContent: 'center', gap: 6 }}
                onClick={() => {
                  retroAudio.playUiBeep(600, 0.05)
                  navigate('/game')
                }}
              >
                <span className="theme-btn-icon">&#123;&#125;</span>
                <span className="theme-btn-text">GAME</span>
              </button>
              <button
                className="retro-btn theme-trigger-btn"
                style={{ justifyContent: 'center', gap: 6 }}
                onClick={() => {
                  retroAudio.playUiBeep(600, 0.05)
                  navigate('/leaderboard')
                }}
              >
                <span className="theme-btn-icon">#_</span>
                <span className="theme-btn-text">LADDER</span>
              </button>
              <button
                className="retro-btn theme-trigger-btn"
                style={{ justifyContent: 'center', gap: 6 }}
                onClick={() => {
                  retroAudio.playUiBeep(600, 0.05)
                  navigate('/friends')
                }}
              >
                <span className="theme-btn-icon">♟</span>
                <span className="theme-btn-text">FRIENDS</span>
              </button>
              <button
                className="retro-btn theme-trigger-btn"
                style={{ justifyContent: 'center', gap: 6 }}
                onClick={() => {
                  retroAudio.playUiBeep(600, 0.05)
                  navigate('/profile')
                }}
              >
                <span className="theme-btn-icon">@/</span>
                <span className="theme-btn-text">PROFILE</span>
              </button>

              {/* Theme Selector Popover Menu */}
              <div className="theme-popover-wrapper">
                <button
                  className={`retro-btn theme-trigger-btn ${isThemePopoverOpen ? 'active' : ''}`}
                  id="themeModalBtn"
                  aria-label="Toggle Theme Menu"
                  onClick={(e) => {
                    e.stopPropagation()
                    const next = !isThemePopoverOpen
                    setIsThemePopoverOpen(next)
                    retroAudio.playUiBeep(next ? 960 : 480, 0.05)
                  }}
                >
                  <span className="theme-btn-icon">&lt;/&gt;</span>
                  <span className="theme-btn-text">THEME</span>
                  <span className="theme-chevron">▼</span>
                </button>

                <div
                  className={`theme-popover-menu ${isThemePopoverOpen ? 'active' : ''}`}
                  id="themePopoverMenu"
                >
                  <fieldset id="color-scheme">
                    <legend>THEME SELECTOR</legend>
                    <label htmlFor="theme-synthwave">
                      <input
                        type="radio"
                        id="theme-synthwave"
                        name="theme-radio"
                        value="synthwave"
                        checked={theme === 'synthwave'}
                        onChange={() => {
                          applyTheme('synthwave')
                          setIsThemePopoverOpen(false)
                        }}
                      />
                      <span>CYBERPUNK</span>
                    </label>
                    <label htmlFor="theme-win95">
                      <input
                        type="radio"
                        id="theme-win95"
                        name="theme-radio"
                        value="win95"
                        checked={theme === 'win95'}
                        onChange={() => {
                          applyTheme('win95')
                          setIsThemePopoverOpen(false)
                        }}
                      />
                      <span>WIN95</span>
                    </label>
                    <label htmlFor="theme-terminal">
                      <input
                        type="radio"
                        id="theme-terminal"
                        name="theme-radio"
                        value="terminal"
                        checked={theme === 'terminal'}
                        onChange={() => {
                          applyTheme('terminal')
                          setIsThemePopoverOpen(false)
                        }}
                      />
                      <span>TERMINAL</span>
                    </label>
                  </fieldset>
                </div>
              </div>

              {/* CRT Scanlines Toggle */}
              <div className="control-group">
                <label className="retro-toggle" title="Toggle CRT Screen Scanlines">
                  <span>CRT FX</span>
                  <input
                    type="checkbox"
                    id="crtToggle"
                    checked={crtEnabled}
                    onChange={toggleCrt}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </nav>

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
                  border: '1px solid #ffe600',
                  color: '#ffe600',
                }}
              >
                // COMBAT RATING: {profile?.rating ?? 1200}
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
                  <div
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '1.25rem',
                      color: '#ffffff',
                      textShadow: '0 0 8px var(--accent-cyan)',
                      letterSpacing: '1px',
                    }}
                  >
                    {profile?.username ?? user?.username ?? t('common.you')}
                  </div>
                  <div style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    // COMBAT STATUS: ACTIVE PILOT • RANK TIER {profile ? Math.max(1, Math.floor(profile.rating / 200)) : 1}
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
            {(profile ? statTiles : Array.from<{ label: string; value: string; hue: string } | undefined>({ length: 5 })).map(
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
                    background: 'rgba(25, 10, 56, 0.8)',
                    border: `1px solid ${s ? s.hue : 'rgba(0, 240, 255, 0.3)'}`,
                    boxShadow: s ? `inset 0 0 12px ${s.hue}22, 0 0 10px ${s.hue}18` : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '1.4rem',
                      fontWeight: 'bold',
                      color: s ? s.hue : 'var(--text-muted)',
                      textShadow: s ? `0 0 10px ${s.hue}` : 'none',
                      letterSpacing: '1px',
                    }}
                  >
                    {s ? s.value : '...'}
                  </div>
                  <div
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-mono)',
                      marginTop: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    {s ? s.label : t('common.loading')}
                  </div>
                </div>
              )
            )}
          </div>

          {/* 2-Column Section: Match History & Achievements */}
          <main
            className="dashboard-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1.3fr 1fr',
              gap: 20,
              maxWidth: 1100,
              margin: '0 auto',
              width: '100%',
              alignItems: 'start',
            }}
          >
            {/* LEFT COLUMN: RECENT COMBAT LOGS */}
            <section className="retro-window" id="recentMatchesWindow">
              <div className="window-header">
                <span>📜 COMBAT RECON LOGS (RECENT MATCHES)</span>
                <div className="window-controls">
                  <span className="window-btn min" />
                  <span className="window-btn max" />
                </div>
              </div>

              <div className="window-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!games ? (
                  <div style={{ color: 'var(--accent-yellow)', fontSize: '0.78rem', padding: '16px 0', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                    SCANNING BATTLE RECORDS...
                  </div>
                ) : games.games.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', padding: '16px 0', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                    NO COMBAT RECORDS DETECTED YET. ENTER THE ARENA TO LOG TELEMETRY!
                  </div>
                ) : (
                  games.games.map((m) => {
                    const win = m.rank === 1
                    const opponents = m.participants.filter(
                      (p) => p.username !== (profile?.username ?? user?.username)
                    )
                    return (
                      <div
                        key={m.gameId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          borderRadius: 4,
                          background: win ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255, 0, 127, 0.08)',
                          border: `1px solid ${win ? '#00ff8866' : '#ff007f66'}`,
                          boxShadow: `inset 0 0 8px ${win ? '#00ff8815' : '#ff007f15'}`,
                        }}
                      >
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            flex: 'none',
                            borderRadius: 4,
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 'bold',
                            fontSize: '0.72rem',
                            fontFamily: 'var(--font-mono)',
                            color: '#0d0221',
                            background: win ? '#00ff88' : '#ff007f',
                            boxShadow: `0 0 10px ${win ? '#00ff88' : '#ff007f'}`,
                          }}
                        >
                          {win ? 'VICTORY' : 'DEFEAT'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 'bold',
                              fontSize: '0.82rem',
                              color: '#ffffff',
                              fontFamily: 'var(--font-mono)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            VS {opponents.length > 0 ? opponents.map((o) => o.username).join(', ') : '—'}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                            {relativeTime(m.startedAt, t)} • {m.rank ? `PLACEMENT #${m.rank}` : 'UNRANKED'}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            {/* RIGHT COLUMN: CYBER ACHIEVEMENTS MATRIX */}
            <section className="retro-window" id="achievementsWindow">
              <div className="window-header">
                <span>🏆 CYBER ACHIEVEMENTS ({unlockedCount}/15)</span>
                <div className="window-controls">
                  <span className="window-btn min" />
                  <span className="window-btn max" />
                </div>
              </div>

              <div className="window-body" style={{ padding: 14 }}>
                {!achievements ? (
                  <div style={{ color: 'var(--accent-yellow)', fontSize: '0.78rem', padding: '16px 0', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                    LOADING MATRIX UNLOCKS...
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
                    {ACHIEVEMENT_LIST.map((a) => {
                      const unlocked = !!achievements[a.key]
                      return (
                        <div
                          key={a.key}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6,
                            padding: '10px 8px',
                            borderRadius: 4,
                            textAlign: 'center',
                            background: unlocked ? 'rgba(255, 230, 0, 0.12)' : 'rgba(10, 2, 28, 0.65)',
                            border: `1px solid ${unlocked ? '#ffe600' : 'rgba(255, 255, 255, 0.1)'}`,
                            boxShadow: unlocked ? '0 0 10px rgba(255, 230, 0, 0.25), inset 0 0 8px rgba(255, 230, 0, 0.1)' : 'none',
                            opacity: unlocked ? 1 : 0.45,
                            transition: 'all 0.2s ease',
                          }}
                          title={unlocked ? 'Achievement Unlocked!' : 'Locked Achievement'}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: '1.2rem',
                              background: unlocked ? 'linear-gradient(135deg, #ffe600, #ff007f)' : 'rgba(255, 255, 255, 0.05)',
                              boxShadow: unlocked ? '0 0 12px #ffe600' : 'none',
                            }}
                          >
                            {a.glyph}
                          </div>
                          <div
                            style={{
                              fontWeight: 'bold',
                              fontSize: '0.68rem',
                              fontFamily: 'var(--font-mono)',
                              color: unlocked ? '#ffe600' : 'var(--text-muted)',
                              lineHeight: 1.3,
                            }}
                          >
                            {t(`dashboard.${a.key}`)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </>
  )
}
