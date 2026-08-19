import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi, postApi } from '../api'
import { UserAvatar } from '../components/UserAvatar'
import type { PlayerColor } from '../game/types'
import { navigate } from '../router'
import { useApp } from '../store'
import { COL } from '../theme'
import { retroAudio } from '../utils/audio'
import '../styles/retrowave.css'

type ThemeType = 'synthwave' | 'win95' | 'terminal'

type Room = {
  id: string
  roomCode: string
  host: string
  seats: number
  maxSeats: number
  mode: 'classic' | 'duel'
}

type MatchResult = {
  gameId: string
  token: string
  engineUrl: string
  color: PlayerColor
  inviteCode?: string
  mode: 'pvp' | 'pve' | 'hotseat'
  playerCount: number
}

type ModeCard = {
  key: string
  title: string
  desc: string
  glyph: string
  hue: string
  badge: 'casual' | 'ranked' | 'invite' | 'semiRanked'
  onClick: () => void
}

const ROOM_AVATAR_HUES = [COL.red.base, COL.green.base, COL.yellow.base, COL.blue.base]

function hueForHost(host: string): string {
  let hash = 0
  for (let i = 0; i < host.length; i++) hash = (hash * 31 + host.charCodeAt(i)) >>> 0
  return ROOM_AVATAR_HUES[hash % ROOM_AVATAR_HUES.length]
}

export function LudoLobby() {
  const { t } = useTranslation()
  const { user, setActiveMatch } = useApp()

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

  const [rooms, setRooms] = useState<Room[] | null>(null)
  const [roomFilter, setRoomFilter] = useState<'all' | 'classic' | 'duel'>('all')
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null)

  const [hasActiveGame, setHasActiveGame] = useState(false)
  const [hostBusy, setHostBusy] = useState(false)

  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [joiningByCode, setJoiningByCode] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRooms = () => {
    getApi<Room[]>('/api/games/rooms')
      .then((data) => setRooms(data))
      .catch(() => setRooms((prev) => prev ?? []))
  }

  const fetchHasActiveGame = () => {
    getApi<Array<{ id: string }>>('/api/games/mine')
      .then((data) => setHasActiveGame(data.length > 0))
      .catch(() => {})
  }

  useEffect(() => {
    fetchRooms()
    fetchHasActiveGame()
    const iv = setInterval(() => {
      fetchRooms()
      fetchHasActiveGame()
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  const createRoom = async () => {
    if (hasActiveGame) {
      retroAudio.playUiBeep(300, 0.08)
      setError(t('lobbyBrowser.createRoomWhileActiveError'))
      return
    }
    setHostBusy(true)
    setError(null)
    retroAudio.playUiBeep(920, 0.08)
    try {
      const res = await postApi<MatchResult>('/api/match/pvp/invite', { clashEnabled: true })
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to host a table')
    } finally {
      setHostBusy(false)
    }
  }

  const rejoinRoom = async (room: Room) => {
    setJoiningRoomId(room.id)
    setError(null)
    retroAudio.playUiBeep(780, 0.06)
    try {
      const res = await postApi<MatchResult>(`/api/game/${room.id}/rejoin`, {})
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rejoin table')
      setJoiningRoomId(null)
      fetchRooms()
    }
  }

  const joinByCode = async (code: string) => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    const ownRoom = (rooms ?? []).find((r) => r.host === user?.username && r.roomCode === trimmed)
    if (ownRoom) {
      await rejoinRoom(ownRoom)
      return
    }
    setJoiningByCode(true)
    setError(null)
    retroAudio.playUiBeep(780, 0.06)
    try {
      const res = await postApi<MatchResult>(`/api/match/join/${encodeURIComponent(trimmed)}`, {})
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
      setJoiningByCode(false)
    }
  }

  const joinRoom = async (room: Room) => {
    setJoiningRoomId(room.id)
    setError(null)
    retroAudio.playUiBeep(780, 0.06)
    try {
      const res = await postApi<MatchResult>(`/api/match/join/${encodeURIComponent(room.roomCode)}`, {})
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
      setJoiningRoomId(null)
      fetchRooms()
    }
  }

  const modeCards: ModeCard[] = [
    {
      key: 'vsBots',
      title: t('lobby.vsBots'),
      desc: t('lobbyBrowser.vsBotsDesc'),
      glyph: '♟',
      hue: '#00ff88',
      badge: 'semiRanked',
      onClick: () => {
        retroAudio.playUiBeep(640, 0.05)
        navigate('/gamelobby/table?mode=4&bots=1')
      },
    },
    {
      key: 'duel2P',
      title: t('lobby.duel2P'),
      desc: t('lobbyBrowser.duel2PDesc'),
      glyph: '✕',
      hue: '#ff007f',
      badge: 'casual',
      onClick: () => {
        retroAudio.playUiBeep(640, 0.05)
        navigate('/gamelobby/table?mode=4&bots=0&local=1')
      },
    },
    {
      key: 'customTable',
      title: 'CUSTOM TABLE',
      desc: 'CONFIGURE CUSTOM SEATS, BOTS & HOTSEAT PLAYERS',
      glyph: '⚙️',
      hue: '#ffe600',
      badge: 'casual',
      onClick: () => {
        retroAudio.playUiBeep(640, 0.05)
        navigate('/gamelobby/table')
      },
    },
  ]

  const badgeStyle = (badge: ModeCard['badge']): React.CSSProperties => {
    const hue =
      badge === 'ranked'
        ? '#ffe600'
        : badge === 'semiRanked'
        ? '#00ff88'
        : badge === 'casual'
        ? '#00f0ff'
        : '#ff007f'
    return {
      fontSize: '0.65rem',
      fontWeight: 'bold',
      letterSpacing: '0.5px',
      color: hue,
      background: `${hue}22`,
      border: `1px solid ${hue}66`,
      borderRadius: 4,
      padding: '2px 8px',
      fontFamily: 'var(--font-mono)',
      textTransform: 'uppercase',
    }
  }

  const badgeLabel = (badge: ModeCard['badge']) =>
    badge === 'ranked'
      ? t('lobbyBrowser.ranked')
      : badge === 'semiRanked'
      ? t('lobbyBrowser.semiRanked')
      : badge === 'casual'
      ? t('lobbyBrowser.casual')
      : t('lobbyBrowser.invite')

  const filteredRooms = (rooms ?? []).filter((r) => roomFilter === 'all' || r.mode === roomFilter)

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
              CYBER LUDO // ARENA LOBBY
            </h1>
            <p className="hero-subtitle" style={{ fontSize: '0.75rem', marginBottom: 0 }}>
              SELECT COMBAT PROTOCOL OR INITIALIZE QUANTUM MULTIPLAYER ROOM
            </p>

            <div className="badge-bar" style={{ marginTop: 12 }}>
              <span
                className="retro-badge"
                style={{
                  border: '1px solid var(--accent-cyan)',
                  color: 'var(--accent-cyan)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                // ACTIVE SECTORS: {rooms ? rooms.length : 0}
              </span>
              <span
                className="retro-badge"
                style={{
                  border: '1px solid #00ff88',
                  color: '#00ff88',
                }}
              >
                // PILOT: {user?.username?.toUpperCase() ?? 'GUEST'}
              </span>
              <span
                className="retro-badge"
                style={{
                  border: hasActiveGame ? '1px solid var(--accent-yellow)' : '1px dashed rgba(255,255,255,0.2)',
                  color: hasActiveGame ? 'var(--accent-yellow)' : 'var(--text-muted)',
                }}
              >
                // ACTIVE ROOM: {hasActiveGame ? 'YES [IN-FLIGHT]' : 'NONE'}
              </span>
            </div>
          </header>

          {/* Main 2-Column Tactical Grid */}
          <main
            className="dashboard-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr',
              gap: 20,
              alignItems: 'start',
              width: '100%',
              margin: '0 auto',
            }}
          >
            {/* LEFT COLUMN: GAME MODES & LIVE ROOMS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Tactical Game Modes Matrix */}
              <section className="retro-window" id="modesWindow">
                <div className="window-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🎮 COMBAT PROTOCOLS // GAME MODES</span>
                  </div>
                  <div className="window-controls">
                    <span className="window-btn min" />
                    <span className="window-btn max" />
                  </div>
                </div>

                <div
                  className="window-body"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: 12,
                    padding: 14,
                  }}
                >
                  {modeCards.map((m) => (
                    <div
                      key={m.key}
                      onClick={m.onClick}
                      style={{
                        cursor: 'pointer',
                        borderRadius: 4,
                        padding: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 10,
                        background: 'rgba(25, 10, 56, 0.75)',
                        border: `1px solid ${m.hue}66`,
                        boxShadow: `inset 0 0 10px ${m.hue}15`,
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = m.hue
                        e.currentTarget.style.boxShadow = `0 0 15px ${m.hue}55, inset 0 0 12px ${m.hue}33`
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = `${m.hue}66`
                        e.currentTarget.style.boxShadow = `inset 0 0 10px ${m.hue}15`
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 4,
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '1.2rem',
                            color: m.hue,
                            background: 'rgba(0, 0, 0, 0.4)',
                            border: `1px solid ${m.hue}`,
                            boxShadow: `0 0 8px ${m.hue}44`,
                          }}
                        >
                          {m.glyph}
                        </div>
                        <span style={badgeStyle(m.badge)}>{badgeLabel(m.badge)}</span>
                      </div>
                      <div>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            color: '#ffffff',
                            marginBottom: 4,
                          }}
                        >
                          {m.title}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.4 }}>
                          {m.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Live Combat Rooms Browser */}
              <section className="retro-window" id="roomsWindow">
                <div className="window-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📡 OPEN QUANTUM ROOMS ({filteredRooms.length})</span>
                  </div>
                  <div className="window-controls">
                    <span className="window-btn min" />
                    <span className="window-btn max" />
                  </div>
                </div>

                <div className="window-body" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Filter Sub-Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      // FILTER SECTOR:
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="retro-btn"
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.65rem',
                          background: roomFilter === 'all' ? 'var(--accent-pink)' : undefined,
                        }}
                        onClick={() => {
                          retroAudio.playUiBeep(520, 0.05)
                          setRoomFilter('all')
                        }}
                      >
                        ALL
                      </button>
                      <button
                        className="retro-btn"
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.65rem',
                          background: roomFilter === 'classic' ? 'var(--accent-pink)' : undefined,
                        }}
                        onClick={() => {
                          retroAudio.playUiBeep(520, 0.05)
                          setRoomFilter('classic')
                        }}
                      >
                        CLASSIC 4P
                      </button>
                      <button
                        className="retro-btn"
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.65rem',
                          background: roomFilter === 'duel' ? 'var(--accent-pink)' : undefined,
                        }}
                        onClick={() => {
                          retroAudio.playUiBeep(520, 0.05)
                          setRoomFilter('duel')
                        }}
                      >
                        DUEL 2P
                      </button>
                    </div>
                  </div>

                  {/* Room Table */}
                  <div
                    style={{
                      border: '1px solid rgba(0, 240, 255, 0.25)',
                      borderRadius: 4,
                      background: 'rgba(5, 2, 18, 0.8)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Header Row */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1.5fr 0.8fr 1fr auto',
                        gap: 8,
                        padding: '8px 12px',
                        background: 'rgba(25, 10, 56, 0.9)',
                        borderBottom: '1px solid rgba(0, 240, 255, 0.25)',
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        color: 'var(--accent-cyan)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <div>SECTOR CODE</div>
                      <div>HOST CALLSIGN</div>
                      <div>CAPACITY</div>
                      <div>STAKES</div>
                      <div>ACTION</div>
                    </div>

                    {/* Room Rows */}
                    <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                      {rooms === null ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--accent-yellow)', fontSize: '0.75rem' }}>
                          SCANNING OPEN SECTORS...
                        </div>
                      ) : filteredRooms.length === 0 ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          NO OPEN COMBAT ROOMS FOUND. INITIALIZE ONE ON THE RIGHT!
                        </div>
                      ) : (
                        filteredRooms.map((room) => {
                          const isOwn = room.host === user?.username
                          const full = room.seats >= room.maxSeats
                          const hue = hueForHost(room.host)
                          return (
                            <div
                              key={room.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1.5fr 0.8fr 1fr auto',
                                gap: 8,
                                padding: '10px 12px',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                                alignItems: 'center',
                                background: isOwn ? 'rgba(255, 0, 127, 0.12)' : 'transparent',
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 'bold',
                                  fontSize: '0.78rem',
                                  color: '#ffe600',
                                  fontFamily: 'var(--font-mono)',
                                  letterSpacing: '0.5px',
                                }}
                              >
                                {room.roomCode}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <UserAvatar
                                  username={room.host}
                                  size={24}
                                  fallbackStyle={{
                                    width: 24,
                                    height: 24,
                                    flex: 'none',
                                    borderRadius: 3,
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '0.65rem',
                                    color: '#0d0221',
                                    background: hue,
                                  }}
                                  style={{ borderRadius: 3, border: `1px solid ${hue}` }}
                                />
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 'bold',
                                      fontSize: '0.78rem',
                                      color: '#ffffff',
                                      fontFamily: 'var(--font-mono)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {room.host}
                                  </div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.62rem' }}>
                                    {room.maxSeats}P • {room.mode}
                                  </div>
                                </div>
                              </div>
                              <div
                                style={{
                                  fontWeight: 'bold',
                                  fontSize: '0.78rem',
                                  color: full ? '#ff0055' : '#00ff88',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                {room.seats}/{room.maxSeats}
                              </div>
                              <div>
                                <span style={badgeStyle('ranked')}>{t('lobbyBrowser.ranked')}</span>
                              </div>
                              <div>
                                <button
                                  className="retro-btn"
                                  onClick={() => (isOwn ? rejoinRoom(room) : joinRoom(room))}
                                  disabled={(!isOwn && full) || joiningRoomId === room.id}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '0.65rem',
                                    background: isOwn ? 'var(--accent-pink)' : undefined,
                                    opacity: (!isOwn && full) || joiningRoomId === room.id ? 0.4 : 1,
                                    cursor: !isOwn && full ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  {isOwn
                                    ? joiningRoomId === room.id
                                      ? '...'
                                      : 'REJOIN'
                                    : full
                                    ? 'FULL'
                                    : joiningRoomId === room.id
                                    ? '...'
                                    : 'JOIN'}
                                </button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN: HOST TABLE & JOIN BY CODE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Host Quantum Arena Window */}
              <section className="retro-window" id="hostWindow">
                <div className="window-header">
                  <span>⚡ HOST QUANTUM ARENA</span>
                  <div className="window-controls">
                    <span className="window-btn min" />
                    <span className="window-btn max" />
                  </div>
                </div>

                <div className="window-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>
                    Initialize a multiplayer match room instantly. Share your room invite code with comrades or let online pilots join from the lobby.
                  </div>

                  <button
                    className="retro-btn"
                    onClick={createRoom}
                    disabled={hostBusy}
                    style={{
                      width: '100%',
                      padding: '12px 0',
                      fontSize: '0.82rem',
                      opacity: hostBusy ? 0.6 : 1,
                    }}
                  >
                    {hostBusy ? '// CREATING ARENA...' : '▶ HOST NEW TABLE'}
                  </button>
                </div>
              </section>

              {/* Join By Room Code Window */}
              <section className="retro-window" id="joinByCodeWindow">
                <div className="window-header">
                  <span>🔑 ACCESS VIA ROOM CODE</span>
                  <div className="window-controls">
                    <span className="window-btn min" />
                    <span className="window-btn max" />
                  </div>
                </div>

                <div className="window-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.4, fontFamily: 'var(--font-mono)' }}>
                    Enter a 6-character room access token to warp directly into the combat room:
                  </div>

                  <input
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && roomCodeInput.trim().length > 0 && !joiningByCode) {
                        joinByCode(roomCodeInput)
                      }
                    }}
                    placeholder="ENTER CODE"
                    maxLength={8}
                    style={{
                      background: 'rgba(5, 2, 18, 0.9)',
                      border: '1.5px solid var(--accent-cyan)',
                      borderRadius: 4,
                      color: '#ffe600',
                      padding: '12px 14px',
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '3px',
                      textAlign: 'center',
                      outline: 'none',
                      boxShadow: 'inset 0 0 10px rgba(0, 240, 255, 0.2)',
                    }}
                  />

                  <button
                    className="retro-btn"
                    onClick={() => joinByCode(roomCodeInput)}
                    disabled={!roomCodeInput.trim() || joiningByCode}
                    style={{
                      width: '100%',
                      padding: '10px 0',
                      fontSize: '0.8rem',
                      opacity: !roomCodeInput.trim() || joiningByCode ? 0.5 : 1,
                      cursor: !roomCodeInput.trim() || joiningByCode ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {joiningByCode ? '// WARPING...' : '⚔️ ACCESS ROOM'}
                  </button>
                </div>
              </section>

              {/* Error Alert Box */}
              {error && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 4,
                    background: 'rgba(255, 0, 85, 0.15)',
                    border: '1px solid #ff0055',
                    color: '#ff0055',
                    fontSize: '0.75rem',
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  ⚠️ {error}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  )
}