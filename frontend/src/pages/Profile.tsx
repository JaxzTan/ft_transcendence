import { useEffect, useState, useRef } from 'react'
import { UserAvatar } from '../components/UserAvatar'
import { useRoute, navigate } from '../router'
import { useApp } from '../store'
import { STATUS_STYLE, type PresenceStatus } from '../theme'
import { retroAudio } from '../utils/audio'
import { getRankTier } from '../utils/ranks'
import '../styles/retrowave.css'

type ThemeType = 'synthwave' | 'win95' | 'terminal'

type UserProfile = {
  id: string
  username: string
  avatarStyle: string | null
  rating: number
  highestRating: number
  wins: number
  losses: number
  winStreak: number
  bestWinStreak: number
  createdAt: string
  status: PresenceStatus
}

type Participant = {
  username: string
  avatarStyle: any
  color: number
  rank: number | null
  piecesInGoal: number
}

type MatchHistory = {
  games: Array<{
    gameId: string
    status: string
    color: number
    rank: number | null
    piecesCaptured: number
    piecesInGoal: number
    startedAt: string
    endedAt: string | null
    participants: Participant[]
  }>
  total: number
  page: number
  limit: number
}

type Friend = {
  id: string
  username: string
  avatarStyle: any
  rating: number
  friendsSince: string
  status: PresenceStatus
}

export function Profile() {
  const { query } = useRoute()
  const { user } = useApp()
  const username = query.get('u') || user?.username
  const isOwnProfile = user?.username === username

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

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [gamesData, setGamesData] = useState<MatchHistory | null>(null)
  const [friendsData, setFriendsData] = useState<Friend[] | null>(null)
  const [loading, setLoading] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [avatarBuster, setAvatarBuster] = useState(Date.now())

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('File size must be less than 2MB.')
      return
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Allowed: PNG, JPEG, GIF, WebP.')
      return
    }

    setUploading(true)
    setUploadError('')
    const formData = new FormData()
    formData.append('avatar', file)

    try {
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json()
        setUploadError(err.message || 'Failed to upload avatar.')
      } else {
        retroAudio.playUiBeep(880, 0.06)
        setAvatarBuster(Date.now())
      }
    } catch (e) {
      setUploadError('An error occurred during upload.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    try {
      const res = await fetch('/api/user/avatar', {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        retroAudio.playUiBeep(440, 0.06)
        setAvatarBuster(Date.now())
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (!username) return
    let cancelled = false
    setLoading(true)

    fetch(`/api/user/${username}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setProfile(data)
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    fetch(`/api/user/${username}/games?limit=10`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setGamesData(data)
      })
      .catch(() => {
        if (!cancelled) setGamesData(null)
      })

    fetch('/api/friends')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setFriendsData(data?.friends || [])
      })
      .catch(() => {
        if (!cancelled) setFriendsData([])
      })

    return () => {
      cancelled = true
    }
  }, [username, avatarBuster])

  const totalGames = profile ? profile.wins + profile.losses : 0
  const winRate = totalGames > 0 ? Math.round((profile!.wins / totalGames) * 100) : 0
  const statusStyle = profile ? STATUS_STYLE[profile.status] || STATUS_STYLE.offline : STATUS_STYLE.offline
  const rankTier = profile ? getRankTier(profile.rating) : getRankTier(1200)

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
                  navigate('/dashboard')
                }}
              >
                <span className="theme-btn-icon">▦</span>
                <span className="theme-btn-text">DASHBOARD</span>
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
              PILOT DOSSIER // CALLSIGN DATABASE
            </h1>
            <p className="hero-subtitle" style={{ fontSize: '0.75rem', marginBottom: 0 }}>
              AUTHENTICATED PILOT SPECIFICATIONS, AVATAR UPLOAD & COMBAT HISTORY
            </p>
          </header>

          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--accent-yellow)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
              INITIALIZING PILOT DOSSIER TELEMETRY...
            </div>
          ) : !profile ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#ff0055', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
              PILOT "{username}" NOT FOUND IN ARCHIVES.
            </div>
          ) : (
            <div
              style={{
                maxWidth: 1100,
                margin: '0 auto',
                width: '100%',
                display: 'grid',
                gridTemplateColumns: isOwnProfile ? '1fr 300px' : '1fr',
                gap: 20,
                alignItems: 'start',
              }}
            >
              {/* Left Column: Dossier Header, Stats & Match History */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Dossier Header Window */}
                <section className="retro-window">
                  <div className="window-header">
                    <span>👤 PILOT IDENTIFICATION // RECORD #{profile.id.slice(0, 8)}</span>
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
                      gap: 20,
                      padding: 20,
                      background: 'rgba(25, 10, 56, 0.85)',
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Avatar Container */}
                    <div style={{ position: 'relative' }}>
                      <div
                        style={{
                          padding: 3,
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-pink))',
                          boxShadow: '0 0 16px rgba(0, 240, 255, 0.4)',
                        }}
                      >
                        <UserAvatar
                          username={profile.username}
                          avatarStyle={profile.avatarStyle}
                          size={88}
                          fallbackStyle={{
                            width: 88,
                            height: 88,
                            borderRadius: 6,
                            background: 'rgba(10, 2, 28, 0.95)',
                            color: 'var(--accent-cyan)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '1.8rem',
                            fontWeight: 'bold',
                            fontFamily: 'var(--font-mono)',
                          }}
                          cacheBuster={avatarBuster}
                        />
                      </div>
                      <span
                        title={statusStyle.label}
                        style={{
                          position: 'absolute',
                          right: 2,
                          bottom: 2,
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: statusStyle.color,
                          border: '2px solid #0d0221',
                          boxShadow: `0 0 8px ${statusStyle.color}`,
                        }}
                      />
                      {isOwnProfile && (
                        <div
                          onClick={() => !uploading && fileInputRef.current?.click()}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 8,
                            background: 'rgba(0,0,0,0.65)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent-cyan)',
                            fontSize: '0.72rem',
                            fontWeight: 'bold',
                            fontFamily: 'var(--font-mono)',
                            cursor: uploading ? 'not-allowed' : 'pointer',
                            opacity: 0,
                            transition: 'opacity 0.2s',
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseOut={(e) => (e.currentTarget.style.opacity = '0')}
                        >
                          {uploading ? 'UPLOADING...' : 'CHANGE'}
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/gif, image/webp"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                    </div>

                    {/* Pilot Info */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-heading)',
                          fontSize: '1.4rem',
                          color: '#ffffff',
                          textShadow: '0 0 10px var(--accent-cyan)',
                        }}
                      >
                        {profile.username}
                      </div>
                      <div style={{ color: statusStyle.color, fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginTop: 4, fontWeight: 'bold' }}>
                        ● {statusStyle.label.toUpperCase()}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        COMMISSIONED: {new Date(profile.createdAt).toLocaleDateString()}
                      </div>

                      {isOwnProfile && (
                        <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
                          <button
                            className="retro-btn"
                            onClick={handleRemoveAvatar}
                            style={{ padding: '3px 8px', fontSize: '0.65rem', color: '#ff0055', borderColor: '#ff0055' }}
                          >
                            REMOVE AVATAR
                          </button>
                          {uploadError && (
                            <span style={{ color: '#ff0055', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
                              ⚠️ {uploadError}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Rating Big Box */}
                    <div
                      style={{
                        padding: '12px 20px',
                        borderRadius: 4,
                        background: 'rgba(5, 2, 18, 0.8)',
                        border: `1.5px solid ${rankTier.border}`,
                        boxShadow: `0 0 14px ${rankTier.glow}`,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        COMBAT RATING
                      </div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: rankTier.color, fontFamily: 'var(--font-mono)' }}>
                        ♛ {profile.rating}
                      </div>
                      <div
                        style={{
                          fontSize: '0.65rem',
                          color: rankTier.color,
                          background: rankTier.bg,
                          padding: '2px 8px',
                          borderRadius: 3,
                          marginTop: 4,
                          fontWeight: 'bold',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {rankTier.name}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 4 Stat Boxes */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                  <div
                    className="retro-window"
                    style={{
                      padding: 12,
                      textAlign: 'center',
                      border: '1px solid #00ff88',
                      background: 'rgba(25, 10, 56, 0.8)',
                    }}
                  >
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'var(--font-mono)' }}>VICTORIES</div>
                    <div style={{ color: '#00ff88', fontSize: '1.3rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {profile.wins}
                    </div>
                  </div>

                  <div
                    className="retro-window"
                    style={{
                      padding: 12,
                      textAlign: 'center',
                      border: '1px solid #ff007f',
                      background: 'rgba(25, 10, 56, 0.8)',
                    }}
                  >
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'var(--font-mono)' }}>DEFEATS</div>
                    <div style={{ color: '#ff007f', fontSize: '1.3rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {profile.losses}
                    </div>
                  </div>

                  <div
                    className="retro-window"
                    style={{
                      padding: 12,
                      textAlign: 'center',
                      border: '1px solid var(--accent-cyan)',
                      background: 'rgba(25, 10, 56, 0.8)',
                    }}
                  >
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'var(--font-mono)' }}>WIN RATIO</div>
                    <div style={{ color: 'var(--accent-cyan)', fontSize: '1.3rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {winRate}%
                    </div>
                  </div>

                  <div
                    className="retro-window"
                    style={{
                      padding: 12,
                      textAlign: 'center',
                      border: '1px solid #ffe600',
                      background: 'rgba(25, 10, 56, 0.8)',
                    }}
                  >
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'var(--font-mono)' }}>BEST STREAK</div>
                    <div style={{ color: '#ffe600', fontSize: '1.3rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      🔥 {profile.bestWinStreak}
                    </div>
                  </div>
                </div>

                {/* Match History Window */}
                <section className="retro-window">
                  <div className="window-header">
                    <span>📜 COMBAT TELEMETRY LOGS ({gamesData?.total ?? 0} MATCHES)</span>
                    <div className="window-controls">
                      <span className="window-btn min" />
                      <span className="window-btn max" />
                    </div>
                  </div>

                  <div className="window-body" style={{ padding: 14, background: 'rgba(25, 10, 56, 0.85)' }}>
                    {!gamesData || gamesData.games.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                        NO COMBAT ARCHIVES FOUND FOR THIS OPERATIVE.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {gamesData.games.map((g) => {
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
                                    }}
                                  >
                                    {isWin ? 'VICTORY SECURED' : `DEFEATED // RANK #${g.rank ?? '?'}`}
                                  </div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginTop: 2 }}>
                                    {g.participants.length} COMBATANTS • {new Date(g.startedAt).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ textAlign: 'right', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                  CAP: {g.piecesCaptured} • GOAL: {g.piecesInGoal}
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
                                  {isWin ? 'WIN' : 'LOSS'}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Right Column: Friends Drawer (When Own Profile) */}
              {isOwnProfile && (
                <section className="retro-window">
                  <div className="window-header">
                    <span>♟ COMM LINK // ALLIES ({friendsData?.length ?? 0})</span>
                    <div className="window-controls">
                      <span className="window-btn min" />
                      <span className="window-btn max" />
                    </div>
                  </div>

                  <div
                    className="window-body"
                    style={{
                      padding: 12,
                      background: 'rgba(25, 10, 56, 0.85)',
                      maxHeight: 520,
                      overflowY: 'auto',
                    }}
                  >
                    {!friendsData || friendsData.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        NO OPERATIVE LINKS ESTABLISHED.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {friendsData.map((f) => {
                          const fTier = getRankTier(f.rating)
                          const fStatus = STATUS_STYLE[f.status] || STATUS_STYLE.offline
                          return (
                            <div
                              key={f.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 10px',
                                borderRadius: 4,
                                background: 'rgba(5, 2, 18, 0.65)',
                                border: '1px solid rgba(0, 240, 255, 0.15)',
                                cursor: 'pointer',
                              }}
                              onClick={() => {
                                retroAudio.playUiBeep(640, 0.04)
                                navigate(`/profile?u=${f.username}`)
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <UserAvatar
                                  username={f.username}
                                  avatarStyle={f.avatarStyle}
                                  size={28}
                                  fallbackStyle={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 3,
                                    background: 'rgba(10, 2, 28, 0.9)',
                                    color: 'var(--accent-cyan)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '0.7rem',
                                  }}
                                />
                                <div>
                                  <div style={{ fontWeight: 'bold', fontSize: '0.78rem', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                                    {f.username}
                                  </div>
                                  <div style={{ color: fStatus.color, fontSize: '0.62rem', fontFamily: 'var(--font-mono)' }}>
                                    ● {fStatus.label.toUpperCase()}
                                  </div>
                                </div>
                              </div>

                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  padding: '2px 6px',
                                  borderRadius: 3,
                                  background: fTier.bg,
                                  color: fTier.color,
                                  border: `1px solid ${fTier.border}`,
                                  fontWeight: 'bold',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                {fTier.badge}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
