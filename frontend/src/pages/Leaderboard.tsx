import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from '../components/UserAvatar'
import { navigate } from '../router'
import { useApp } from '../store'
import { retroAudio } from '../utils/audio'
import { getRankTier } from '../utils/ranks'
import '../styles/retrowave.css'

type ThemeType = 'synthwave' | 'win95' | 'terminal'

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

const TABS = [
  { k: 'global', labelKey: 'leaderboard.tabGlobal', icon: '🌐' },
  { k: 'friends', labelKey: 'leaderboard.tabFriends', icon: '♟' },
  { k: 'weekly', labelKey: 'leaderboard.tabWeekly', icon: '⚡' },
]

export function Leaderboard() {
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

  const [tab, setTab] = useState('global')
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (tab !== 'global') return
    let cancelled = false
    setLoading(true)
    fetch('/api/leaderboard?mode=global&limit=25', { credentials: 'include' })
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

  const top1 = data?.entries?.find((e) => e.rank === 1)
  const top2 = data?.entries?.find((e) => e.rank === 2)
  const top3 = data?.entries?.find((e) => e.rank === 3)
  const myRankInfo = data?.myRank

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
        <div className="app-wrapper" style={{ maxWidth: 1380, margin: '0 auto', padding: '16px 24px 48px' }}>
          {/* Navigation Header */}
          <nav className="navbar" id="mainNav" style={{ marginBottom: 18 }}>
            <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="retro-btn"
                style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: 'bold' }}
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
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  style={{
                    fill: 'var(--accent-cyan)',
                    filter: 'drop-shadow(0 0 10px var(--accent-cyan)) drop-shadow(0 0 18px var(--accent-pink))',
                  }}
                >
                  <path d="M19.581 16.851H24v-4.439ZM24 3.574h-4.419v4.42l-4.419 4.418v4.44h4.419v-4.44L24 7.993Zm-4.419 0h-4.419v4.42zm-6.324 8.838H4.419l8.838-8.838H8.838L0 12.412v3.595h8.838v4.419h4.419z" />
                </svg>
              </div>
            </div>

            <div className="nav-controls">
              <button
                className="retro-btn theme-trigger-btn"
                style={{ justifyContent: 'center', gap: 8, padding: '8px 14px', fontSize: '0.8rem' }}
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
                style={{ justifyContent: 'center', gap: 8, padding: '8px 14px', fontSize: '0.8rem' }}
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
                style={{ justifyContent: 'center', gap: 8, padding: '8px 14px', fontSize: '0.8rem' }}
                onClick={() => {
                  retroAudio.playUiBeep(600, 0.05)
                  navigate('/dashboard')
                }}
              >
                <span className="theme-btn-icon">▦</span>
                <span className="theme-btn-text">DASHBOARD</span>
              </button>
              <button
                className="retro-btn theme-trigger-btn"
                style={{ justifyContent: 'center', gap: 8, padding: '8px 14px', fontSize: '0.8rem' }}
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
                style={{ justifyContent: 'center', gap: 8, padding: '8px 14px', fontSize: '0.8rem' }}
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
                  style={{ padding: '8px 14px', fontSize: '0.8rem' }}
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

          {/* Hero Header Telemetry */}
          <header className="hero-section" style={{ padding: '20px 0 16px', marginBottom: 18 }}>
            <h1 className="hero-title" style={{ fontSize: '1.9rem', marginBottom: 6, letterSpacing: '2px' }}>
              GLOBAL RANKINGS // CYBER LADDER
            </h1>
            <p className="hero-subtitle" style={{ fontSize: '0.85rem', marginBottom: 0, letterSpacing: '1px' }}>
              ELITE COMBAT TELEMETRY • LIVE ELO STANDINGS & APEX CHAMPIONS
            </p>

            {/* Quick Pilot Standing Ribbon */}
            {user && (
              <div className="badge-bar" style={{ marginTop: 14, justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
                <span
                  className="retro-badge"
                  style={{
                    border: '1.5px solid var(--accent-cyan)',
                    color: 'var(--accent-cyan)',
                    fontSize: '0.8rem',
                    padding: '5px 12px',
                  }}
                >
                  // OPERATIVE: {user.username.toUpperCase()}
                </span>
                {myRankInfo && (() => {
                  const myTier = getRankTier(myRankInfo.rating, myRankInfo.rank)
                  return (
                    <>
                      <span
                        className="retro-badge"
                        style={{
                          border: `1.5px solid ${myTier.border}`,
                          color: myTier.color,
                          boxShadow: `0 0 10px ${myTier.glow}`,
                          fontSize: '0.8rem',
                          padding: '5px 12px',
                        }}
                      >
                        // STANDING: RANK #{myRankInfo.rank} • {myTier.name}
                      </span>
                      <span
                        className="retro-badge"
                        style={{
                          border: '1.5px solid #ffffff',
                          color: '#ffffff',
                          fontSize: '0.8rem',
                          padding: '5px 12px',
                        }}
                      >
                        // RATING: ♛ {myRankInfo.rating}
                      </span>
                    </>
                  )
                })()}
                <span
                  className="retro-badge"
                  style={{
                    border: '1.5px solid #00ff88',
                    color: '#00ff88',
                    fontSize: '0.8rem',
                    padding: '5px 12px',
                  }}
                >
                  // TOTAL ACTIVE COMBATANTS: {data?.total ?? 12}
                </span>
              </div>
            )}
          </header>

          {/* Unified Leaderboard Window Container */}
          <section className="retro-window" style={{ width: '100%' }}>
            <div className="window-header" style={{ padding: '10px 18px', fontSize: '0.85rem' }}>
              <span>🏆 CYBER LADDER // COMBAT TELEMETRY ({data?.total ?? 0} ACTIVE OPERATIVES)</span>
              <div className="window-controls">
                <span className="window-btn min" />
                <span className="window-btn max" />
              </div>
            </div>

            <div className="window-body" style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '20px 22px' }}>
              {/* Category Tabs */}
              <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid rgba(0, 240, 255, 0.25)', paddingBottom: 14 }}>
                {TABS.map((tItem) => {
                  const active = tab === tItem.k
                  return (
                    <button
                      key={tItem.k}
                      className="retro-btn"
                      style={{
                        padding: '8px 18px',
                        fontSize: '0.82rem',
                        background: active ? 'var(--accent-pink)' : 'rgba(25, 10, 56, 0.75)',
                        borderColor: active ? 'var(--accent-pink)' : 'rgba(0, 240, 255, 0.35)',
                        boxShadow: active ? '0 0 16px rgba(255, 0, 127, 0.5)' : 'none',
                        fontWeight: 'bold',
                      }}
                      onClick={() => {
                        retroAudio.playUiBeep(active ? 480 : 720, 0.05)
                        setTab(tItem.k)
                      }}
                    >
                      <span style={{ fontSize: '1rem' }}>{tItem.icon}</span> {t(tItem.labelKey)}
                    </button>
                  )
                })}
              </div>

              {/* Inside-Window Podium Showcase (Rendered directly inside when Global tab active) */}
              {tab === 'global' && data && data.entries.length >= 3 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 16,
                    alignItems: 'end',
                    padding: '12px 14px',
                    borderRadius: 6,
                    background: 'rgba(10, 3, 24, 0.65)',
                    border: '1px solid rgba(0, 240, 255, 0.2)',
                  }}
                >
                  {/* Rank #2 Podium Card */}
                  {top2 && (() => {
                    const tier2 = getRankTier(top2.rating, 2)
                    return (
                      <div
                        style={{
                          background: 'rgba(25, 10, 56, 0.85)',
                          border: '1.5px solid rgba(0, 240, 255, 0.4)',
                          borderRadius: 6,
                          boxShadow: '0 0 16px rgba(0, 240, 255, 0.2)',
                          padding: 16,
                          cursor: 'pointer',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                        onClick={() => {
                          retroAudio.playUiBeep(600, 0.05)
                          navigate(`/profile?u=${top2.username}`)
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: '1.6rem' }}>🥈</span>
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '3px 8px',
                              borderRadius: 4,
                              background: tier2.bg,
                              color: tier2.color,
                              border: `1px solid ${tier2.border}`,
                              fontWeight: 800,
                            }}
                          >
                            {tier2.name}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <UserAvatar
                            username={top2.username}
                            size={48}
                            fallbackStyle={{
                              width: 48,
                              height: 48,
                              borderRadius: 6,
                              background: 'rgba(10, 2, 28, 0.9)',
                              color: 'var(--accent-cyan)',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 'bold',
                              fontSize: '1rem',
                            }}
                          />
                          <div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                              {top2.username}
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                              ♛ {top2.rating}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: 12,
                            paddingTop: 8,
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          <span>MATCHES: <strong style={{ color: '#ffffff' }}>{top2.gamesPlayed}</strong></span>
                          <span>WIN RATE: <strong style={{ color: '#ffffff' }}>{top2.winRate}%</strong></span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Rank #1 Apex Champion Citadel Card */}
                  {top1 && (() => {
                    const tier1 = getRankTier(top1.rating, 1)
                    return (
                      <div
                        style={{
                          background: 'linear-gradient(180deg, rgba(48, 12, 38, 0.95), rgba(20, 5, 28, 0.98))',
                          border: '2px solid #ff1744',
                          borderRadius: 6,
                          boxShadow: '0 0 25px rgba(255, 23, 68, 0.35), inset 0 0 16px rgba(255, 215, 0, 0.1)',
                          padding: '20px 18px',
                          cursor: 'pointer',
                          transform: 'scale(1.02)',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                        onClick={() => {
                          retroAudio.playUiBeep(750, 0.05)
                          navigate(`/profile?u=${top1.username}`)
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04) translateY(-3px)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.02) translateY(0)')}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '2rem', filter: 'drop-shadow(0 0 8px #ffe600)' }}>🥇</span>
                            <span style={{ fontSize: '0.68rem', color: '#ffe600', fontFamily: 'var(--font-mono)', fontWeight: 'bold', letterSpacing: '1px' }}>
                              ★ APEX CHAMPION
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '4px 10px',
                              borderRadius: 4,
                              background: tier1.bg,
                              color: tier1.color,
                              border: `1.5px solid ${tier1.border}`,
                              fontWeight: 900,
                              boxShadow: `0 0 12px ${tier1.glow}`,
                            }}
                          >
                            {tier1.name}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div
                            style={{
                              padding: 3,
                              borderRadius: 8,
                              background: 'linear-gradient(135deg, #ff1744, #ffe600)',
                              boxShadow: '0 0 16px rgba(255, 23, 68, 0.5)',
                            }}
                          >
                            <UserAvatar
                              username={top1.username}
                              size={58}
                              fallbackStyle={{
                                width: 58,
                                height: 58,
                                borderRadius: 6,
                                background: 'rgba(10, 2, 28, 0.95)',
                                color: '#ffe600',
                                display: 'grid',
                                placeItems: 'center',
                                fontWeight: 'bold',
                                fontSize: '1.25rem',
                              }}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ffffff', fontFamily: 'var(--font-heading)' }}>
                              {top1.username}
                            </div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                              ♛ {top1.rating}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: 14,
                            paddingTop: 10,
                            borderTop: '1px solid rgba(255, 23, 68, 0.3)',
                            fontSize: '0.78rem',
                            color: '#ffcad4',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          <span>MATCHES: <strong style={{ color: '#ffffff', fontSize: '0.85rem' }}>{top1.gamesPlayed}</strong></span>
                          <span>WIN RATE: <strong style={{ color: '#00ff88', fontSize: '0.85rem' }}>{top1.winRate}%</strong></span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Rank #3 Podium Card */}
                  {top3 && (() => {
                    const tier3 = getRankTier(top3.rating, 3)
                    return (
                      <div
                        style={{
                          background: 'rgba(25, 10, 56, 0.85)',
                          border: '1.5px solid rgba(255, 0, 127, 0.4)',
                          borderRadius: 6,
                          boxShadow: '0 0 16px rgba(255, 0, 127, 0.2)',
                          padding: 16,
                          cursor: 'pointer',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                        onClick={() => {
                          retroAudio.playUiBeep(600, 0.05)
                          navigate(`/profile?u=${top3.username}`)
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: '1.6rem' }}>🥉</span>
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '3px 8px',
                              borderRadius: 4,
                              background: tier3.bg,
                              color: tier3.color,
                              border: `1px solid ${tier3.border}`,
                              fontWeight: 800,
                            }}
                          >
                            {tier3.name}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <UserAvatar
                            username={top3.username}
                            size={48}
                            fallbackStyle={{
                              width: 48,
                              height: 48,
                              borderRadius: 6,
                              background: 'rgba(10, 2, 28, 0.9)',
                              color: 'var(--accent-pink)',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 'bold',
                              fontSize: '1rem',
                            }}
                          />
                          <div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                              {top3.username}
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                              ♛ {top3.rating}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: 12,
                            paddingTop: 8,
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          <span>MATCHES: <strong style={{ color: '#ffffff' }}>{top3.gamesPlayed}</strong></span>
                          <span>WIN RATE: <strong style={{ color: '#ffffff' }}>{top3.winRate}%</strong></span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Ladder Table Container */}
              <div
                style={{
                  border: '1.5px solid rgba(0, 240, 255, 0.3)',
                  borderRadius: 6,
                  background: 'rgba(5, 2, 18, 0.9)',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.5)',
                }}
              >
                {/* Table Header */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '220px 1fr 140px 140px 120px',
                    gap: 14,
                    padding: '14px 24px',
                    background: 'rgba(25, 10, 56, 0.98)',
                    borderBottom: '1.5px solid rgba(0, 240, 255, 0.3)',
                    fontSize: '0.78rem',
                    fontWeight: 'bold',
                    color: 'var(--accent-cyan)',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                  }}
                >
                  <div>🏷️ RANK & TIER</div>
                  <div>👤 PILOT / CALLSIGN</div>
                  <div>♛ RATING</div>
                  <div>⚔️ MATCHES</div>
                  <div style={{ textAlign: 'right' }}>📊 WIN RATE</div>
                </div>

                {/* Table Content */}
                {loading ? (
                  <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--accent-yellow)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                    ACCESSING QUANTUM LADDER TELEMETRY...
                  </div>
                ) : tab !== 'global' ? (
                  <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                    SECTOR LADDER COMING IN NEXT FIRMWARE CYCLE.
                  </div>
                ) : !data || data.entries.length === 0 ? (
                  <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                    NO LADDER RECORDS LOGGED YET.
                  </div>
                ) : (
                  data.entries.map((entry) => {
                    const isYou = entry.username === user?.username
                    const isRankOne = entry.rank === 1
                    const isTopThree = entry.rank <= 3
                    const tier = getRankTier(entry.rating, entry.rank)
                    const rankMedal =
                      entry.rank === 1
                        ? '🥇'
                        : entry.rank === 2
                        ? '🥈'
                        : entry.rank === 3
                        ? '🥉'
                        : `#${entry.rank}`

                    return (
                      <div
                        key={entry.rank}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '220px 1fr 140px 140px 120px',
                          gap: 14,
                          padding: isRankOne ? '22px 24px' : isTopThree ? '16px 24px' : '14px 24px',
                          borderBottom: isRankOne
                            ? '2.5px solid rgba(255, 23, 68, 0.6)'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                          alignItems: 'center',
                          background: isRankOne
                            ? isYou
                              ? 'linear-gradient(90deg, rgba(255, 0, 127, 0.3), rgba(255, 23, 68, 0.2))'
                              : 'linear-gradient(90deg, rgba(255, 23, 68, 0.18), rgba(255, 215, 0, 0.08))'
                            : isYou
                            ? 'rgba(255, 0, 127, 0.18)'
                            : 'transparent',
                          boxShadow: isRankOne
                            ? '0 0 20px rgba(255, 23, 68, 0.25)'
                            : isYou
                            ? 'inset 0 0 15px rgba(255, 0, 127, 0.15)'
                            : 'none',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          retroAudio.playUiBeep(640, 0.04)
                          navigate(`/profile?u=${entry.username}`)
                        }}
                        onMouseEnter={(e) => {
                          if (!isYou && !isRankOne) e.currentTarget.style.background = 'rgba(0, 240, 255, 0.1)'
                        }}
                        onMouseLeave={(e) => {
                          if (!isYou && !isRankOne) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        {/* Rank Badge Column */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: isRankOne ? 12 : 10 }}>
                          <span
                            style={{
                              fontWeight: 'bold',
                              fontSize: isRankOne ? '1.8rem' : entry.rank <= 3 ? '1.35rem' : '0.95rem',
                              color: '#ffffff',
                              fontFamily: 'var(--font-mono)',
                              minWidth: isRankOne ? 38 : 32,
                              textAlign: 'center',
                            }}
                          >
                            {rankMedal}
                          </span>
                          <span
                            style={{
                              fontSize: isRankOne ? '12px' : '11px',
                              padding: isRankOne ? '4px 10px' : '3px 8px',
                              borderRadius: 4,
                              background: tier.bg,
                              color: tier.color,
                              border: `1.5px solid ${tier.border}`,
                              fontWeight: 800,
                              letterSpacing: '0.04em',
                              whiteSpace: 'nowrap',
                              boxShadow: `0 0 10px ${tier.glow}`,
                            }}
                          >
                            {tier.name}
                          </span>
                        </div>

                        {/* Pilot Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: isRankOne ? 14 : 12 }}>
                          <UserAvatar
                            username={entry.username}
                            size={isRankOne ? 48 : isTopThree ? 38 : 34}
                            fallbackStyle={{
                              width: isRankOne ? 48 : isTopThree ? 38 : 34,
                              height: isRankOne ? 48 : isTopThree ? 38 : 34,
                              borderRadius: 5,
                              background: 'rgba(10, 2, 28, 0.9)',
                              color: 'var(--accent-cyan)',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 'bold',
                              fontSize: isRankOne ? '1rem' : '0.8rem',
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 'bold',
                                fontSize: isRankOne ? '1.15rem' : isTopThree ? '1.02rem' : '0.92rem',
                                color: '#ffffff',
                                fontFamily: 'var(--font-mono)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {entry.username} {isYou && <span style={{ color: 'var(--accent-pink)', fontSize: '0.75rem' }}>[YOU]</span>}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: isRankOne ? '0.78rem' : '0.7rem', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                              WINS: <strong style={{ color: '#ffffff' }}>{entry.wins}</strong> • LOSSES: <strong style={{ color: '#ffffff' }}>{entry.losses}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Rating */}
                        <div
                          style={{
                            fontWeight: 'bold',
                            fontSize: isRankOne ? '1.35rem' : isTopThree ? '1.12rem' : '1.02rem',
                            color: '#ffffff',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          ♛ {entry.rating}
                        </div>

                        {/* Games Played */}
                        <div style={{ color: '#ffffff', fontSize: isRankOne ? '0.95rem' : '0.85rem', fontFamily: 'var(--font-mono)' }}>
                          {entry.gamesPlayed} MATCHES
                        </div>

                        {/* Win Rate */}
                        <div
                          style={{
                            textAlign: 'right',
                            fontWeight: 'bold',
                            fontSize: isRankOne ? '1.1rem' : '0.92rem',
                            color: '#ffffff',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {entry.winRate}%
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
