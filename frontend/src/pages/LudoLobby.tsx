import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi, postApi } from '../api'
import { UserAvatar } from '../components/UserAvatar'
import { RetroNavbar } from '../components/RetroNavbar'
import type { PlayerColor } from '../game/types'
import { navigate } from '../router'
import { useApp } from '../store'
import { COL } from '../theme'
import { retroAudio } from '../utils/audio'
import '../styles/retrowave.css'

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
      .catch(() => { })
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

  const badgeStyle = (badge: 'ranked' | 'semiRanked' | 'casual' | 'invite'): React.CSSProperties => {
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
          <RetroNavbar
            activeRoute="/gamelobby"
            crtEnabled={crtEnabled}
            toggleCrt={toggleCrt}
          />

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

          {/* Main Tactical Single-Column / Stacked Layout */}
          <main
            className="dashboard-grid"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              width: '100%',
              margin: '0 auto',
            }}
          >
            {/* TACTICAL COMBAT PASSES CONTAINER (BORDERLESS TICKET PASSES) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              {/* ════════════════════════════════════════════════════════════════════════════
                  LEVEL 1: HOST NEW TABLE TICKET
                 ════════════════════════════════════════════════════════════════════════════ */}
              <div
                className="retro-ticket-pass"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(90deg, rgba(255, 0, 127, 0.16) 0%, rgba(15, 6, 32, 0.95) 100%)',
                  border: '1.5px solid #ff007f',
                  boxShadow: '0 0 16px rgba(255, 0, 127, 0.2), inset 0 0 12px rgba(255, 0, 127, 0.08)',
                  borderRadius: 10,
                  padding: '22px 24px',
                  minHeight: 88,
                  gap: 20,
                  flexWrap: 'wrap',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1, minWidth: 280 }}>
                  <div
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(255, 0, 127, 0.25)',
                      border: '1px solid #ff007f',
                      borderRadius: 6,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 900,
                      fontSize: '0.88rem',
                      color: '#ff007f',
                      whiteSpace: 'nowrap',
                      letterSpacing: '1px',
                    }}
                  >
                    {t('ludoLobbyPasses.level1')}
                  </div>
                  <div style={{ width: 1, height: 46, borderRight: '2px dashed rgba(255, 0, 127, 0.4)' }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '1.02rem',
                        fontWeight: 900,
                        color: '#ffffff',
                        letterSpacing: '1.5px',
                        marginBottom: 5,
                      }}
                    >
                      {t('ludoLobbyPasses.hostNewTable')}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {t('ludoLobbyPasses.hostNewTableDesc')}
                    </div>
                  </div>
                </div>

                <button
                  className="retro-btn"
                  onClick={createRoom}
                  disabled={hostBusy}
                  style={{
                    width: 185,
                    height: 48,
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    background: 'var(--accent-pink)',
                    borderColor: '#ff007f',
                    boxShadow: '0 0 14px rgba(255, 0, 127, 0.4)',
                    opacity: hostBusy ? 0.6 : 1,
                    flexShrink: 0,
                  }}
                >
                  {hostBusy ? `▶ ${t('ludoLobbyPasses.creating')}` : `▶ ${t('ludoLobbyPasses.hostNewTable')}`}
                </button>
              </div>

              {/* ════════════════════════════════════════════════════════════════════════════
                  LEVEL 2: HOTSEAT MODE TICKET
                 ════════════════════════════════════════════════════════════════════════════ */}
              <div
                className="retro-ticket-pass"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(90deg, rgba(255, 230, 0, 0.14) 0%, rgba(15, 6, 32, 0.95) 100%)',
                  border: '1.5px solid #ffe600',
                  boxShadow: '0 0 16px rgba(255, 230, 0, 0.18), inset 0 0 12px rgba(255, 230, 0, 0.08)',
                  borderRadius: 10,
                  padding: '22px 24px',
                  minHeight: 88,
                  gap: 20,
                  flexWrap: 'wrap',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1, minWidth: 280 }}>
                  <div
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(255, 230, 0, 0.2)',
                      border: '1px solid #ffe600',
                      borderRadius: 6,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 900,
                      fontSize: '0.88rem',
                      color: '#ffe600',
                      whiteSpace: 'nowrap',
                      letterSpacing: '1px',
                    }}
                  >
                    {t('ludoLobbyPasses.level2')}
                  </div>
                  <div style={{ width: 1, height: 46, borderRight: '2px dashed rgba(255, 230, 0, 0.4)' }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '1.02rem',
                        fontWeight: 900,
                        color: '#ffffff',
                        letterSpacing: '1.5px',
                        marginBottom: 5,
                      }}
                    >
                      {t('ludoLobbyPasses.hotseatMode')}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {t('ludoLobbyPasses.hotseatModeDesc')}
                    </div>
                  </div>
                </div>

                <button
                  className="retro-btn"
                  onClick={() => {
                    retroAudio.playUiBeep(640, 0.05)
                    navigate('/gamelobby/table?mode=4&bots=0&local=1')
                  }}
                  style={{
                    width: 185,
                    height: 48,
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    background: 'rgba(255, 230, 0, 0.2)',
                    borderColor: '#ffe600',
                    color: '#ffe600',
                    boxShadow: '0 0 12px rgba(255, 230, 0, 0.3)',
                    flexShrink: 0,
                  }}
                >
                  ▶ {t('ludoLobbyPasses.launchHotseat')}
                </button>
              </div>

              {/* ════════════════════════════════════════════════════════════════════════════
                  LEVEL 3: BOT MODE TICKET
                 ════════════════════════════════════════════════════════════════════════════ */}
              <div
                className="retro-ticket-pass"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(90deg, rgba(0, 255, 136, 0.14) 0%, rgba(15, 6, 32, 0.95) 100%)',
                  border: '1.5px solid #00ff88',
                  boxShadow: '0 0 16px rgba(0, 255, 136, 0.18), inset 0 0 12px rgba(0, 255, 136, 0.08)',
                  borderRadius: 10,
                  padding: '22px 24px',
                  minHeight: 88,
                  gap: 20,
                  flexWrap: 'wrap',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1, minWidth: 280 }}>
                  <div
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(0, 255, 136, 0.2)',
                      border: '1px solid #00ff88',
                      borderRadius: 6,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 900,
                      fontSize: '0.88rem',
                      color: '#00ff88',
                      whiteSpace: 'nowrap',
                      letterSpacing: '1px',
                    }}
                  >
                    {t('ludoLobbyPasses.level3')}
                  </div>
                  <div style={{ width: 1, height: 46, borderRight: '2px dashed rgba(0, 255, 136, 0.4)' }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '1.02rem',
                        fontWeight: 900,
                        color: '#ffffff',
                        letterSpacing: '1.5px',
                        marginBottom: 5,
                      }}
                    >
                      {t('ludoLobbyPasses.botMode')}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {t('ludoLobbyPasses.botModeDesc')}
                    </div>
                  </div>
                </div>

                <button
                  className="retro-btn"
                  onClick={() => {
                    retroAudio.playUiBeep(640, 0.05)
                    navigate('/gamelobby/table?mode=4&bots=1')
                  }}
                  style={{
                    width: 185,
                    height: 48,
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    background: 'rgba(0, 255, 136, 0.2)',
                    borderColor: '#00ff88',
                    color: '#00ff88',
                    boxShadow: '0 0 12px rgba(0, 255, 136, 0.3)',
                    flexShrink: 0,
                  }}
                >
                  ▶ {t('ludoLobbyPasses.playVsBots')}
                </button>
              </div>

              {/* ════════════════════════════════════════════════════════════════════════════
                  LEVEL 4 (LAST): ACCESS VIA ROOM CODE TICKET
                 ════════════════════════════════════════════════════════════════════════════ */}
              <div
                className="retro-ticket-pass"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(90deg, rgba(0, 240, 255, 0.16) 0%, rgba(15, 6, 32, 0.95) 100%)',
                  border: '1.5px solid var(--accent-cyan)',
                  boxShadow: '0 0 16px rgba(0, 240, 255, 0.2), inset 0 0 12px rgba(0, 240, 255, 0.08)',
                  borderRadius: 10,
                  padding: '22px 24px',
                  minHeight: 88,
                  gap: 20,
                  flexWrap: 'wrap',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1, minWidth: 280 }}>
                  <div
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(0, 240, 255, 0.2)',
                      border: '1px solid var(--accent-cyan)',
                      borderRadius: 6,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 900,
                      fontSize: '0.88rem',
                      color: 'var(--accent-cyan)',
                      whiteSpace: 'nowrap',
                      letterSpacing: '1px',
                    }}
                  >
                    {t('ludoLobbyPasses.level4')}
                  </div>
                  <div style={{ width: 1, height: 46, borderRight: '2px dashed rgba(0, 240, 255, 0.4)' }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '1.02rem',
                        fontWeight: 900,
                        color: '#ffffff',
                        letterSpacing: '1.5px',
                        marginBottom: 5,
                      }}
                    >
                      {t('ludoLobbyPasses.accessViaCode')}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {t('ludoLobbyPasses.accessViaCodeDesc')}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
                  <input
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && roomCodeInput.trim().length > 0 && !joiningByCode) {
                        joinByCode(roomCodeInput)
                      }
                    }}
                    placeholder={t('ludoLobbyPasses.enterCodePlaceholder')}
                    maxLength={8}
                    style={{
                      width: 140,
                      height: 48,
                      background: 'rgba(5, 2, 18, 0.9)',
                      border: '1.5px solid var(--accent-cyan)',
                      borderRadius: 6,
                      color: '#ffe600',
                      padding: '0 12px',
                      fontSize: '0.92rem',
                      fontWeight: 'bold',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '2px',
                      textAlign: 'center',
                      outline: 'none',
                      boxShadow: 'inset 0 0 8px rgba(0, 240, 255, 0.2)',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    className="retro-btn"
                    onClick={() => joinByCode(roomCodeInput)}
                    disabled={!roomCodeInput.trim() || joiningByCode}
                    style={{
                      width: 185,
                      height: 48,
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.82rem',
                      background: 'rgba(0, 240, 255, 0.2)',
                      borderColor: 'var(--accent-cyan)',
                      color: 'var(--accent-cyan)',
                      opacity: !roomCodeInput.trim() || joiningByCode ? 0.5 : 1,
                      cursor: !roomCodeInput.trim() || joiningByCode ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {joiningByCode ? `▶ ${t('ludoLobbyPasses.warping')}` : `▶ ${t('ludoLobbyPasses.accessRoom')}`}
                  </button>
                </div>
              </div>
            </div>

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
                // ERROR: {error}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════════
                BELOW THEM: OPEN QUANTUM ROOMS
               ════════════════════════════════════════════════════════════════════════════ */}
            <section className="retro-window" id="roomsWindow">
              <div className="window-header" style={{ background: '#190a38', borderBottom: '1px solid rgba(0, 240, 255, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{t('ludoLobbyPasses.openQuantumRooms')} ({filteredRooms.length})</span>
                </div>
              </div>

              <div className="window-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Filter Sub-Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                    {t('ludoLobbyPasses.filterSector')}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="retro-btn"
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.68rem',
                        background: roomFilter === 'all' ? 'var(--accent-pink)' : undefined,
                      }}
                      onClick={() => {
                        retroAudio.playUiBeep(520, 0.05)
                        setRoomFilter('all')
                      }}
                    >
                      {t('ludoLobbyPasses.filterAll')}
                    </button>
                    <button
                      className="retro-btn"
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.68rem',
                        background: roomFilter === 'classic' ? 'var(--accent-pink)' : undefined,
                      }}
                      onClick={() => {
                        retroAudio.playUiBeep(520, 0.05)
                        setRoomFilter('classic')
                      }}
                    >
                      {t('ludoLobbyPasses.filterClassic4p')}
                    </button>
                    <button
                      className="retro-btn"
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.68rem',
                        background: roomFilter === 'duel' ? 'var(--accent-pink)' : undefined,
                      }}
                      onClick={() => {
                        retroAudio.playUiBeep(520, 0.05)
                        setRoomFilter('duel')
                      }}
                    >
                      {t('ludoLobbyPasses.filterDuel2p')}
                    </button>
                  </div>
                </div>

                {/* Room Table */}
                <div
                  style={{
                    border: '1px solid rgba(0, 240, 255, 0.25)',
                    borderRadius: 6,
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
                      padding: '10px 14px',
                      background: 'rgba(25, 10, 56, 0.9)',
                      borderBottom: '1px solid rgba(0, 240, 255, 0.25)',
                      fontSize: '0.68rem',
                      fontWeight: 'bold',
                      color: 'var(--accent-cyan)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <div>{t('ludoLobbyPasses.colSectorCode')}</div>
                    <div>{t('ludoLobbyPasses.colHostCallsign')}</div>
                    <div>{t('ludoLobbyPasses.colCapacity')}</div>
                    <div>{t('ludoLobbyPasses.colStakes')}</div>
                    <div>{t('ludoLobbyPasses.colAction')}</div>
                  </div>

                  {/* Room Rows */}
                  <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {rooms === null ? (
                      <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--accent-yellow)', fontSize: '0.78rem' }}>
                        SCANNING OPEN SECTORS...
                      </div>
                    ) : filteredRooms.length === 0 ? (
                      <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {t('ludoLobbyPasses.noOpenRooms')}
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
                              padding: '12px 14px',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                              alignItems: 'center',
                              background: isOwn ? 'rgba(255, 0, 127, 0.12)' : 'transparent',
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 'bold',
                                fontSize: '0.82rem',
                                color: '#ffe600',
                                fontFamily: 'var(--font-mono)',
                                letterSpacing: '0.5px',
                              }}
                            >
                              {room.roomCode}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <UserAvatar
                                username={room.host}
                                size={28}
                                fallbackStyle={{
                                  width: 28,
                                  height: 28,
                                  flex: 'none',
                                  borderRadius: 4,
                                  display: 'grid',
                                  placeItems: 'center',
                                  fontWeight: 'bold',
                                  fontSize: '0.7rem',
                                  color: '#0d0221',
                                  background: hue,
                                }}
                                style={{ borderRadius: 4, border: `1px solid ${hue}` }}
                              />
                              <div style={{ minWidth: 0 }}>
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
                                  {room.host}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                                  {room.maxSeats}P • {room.mode}
                                </div>
                              </div>
                            </div>
                            <div
                              style={{
                                fontWeight: 'bold',
                                fontSize: '0.82rem',
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
                                  padding: '5px 12px',
                                  fontSize: '0.7rem',
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
          </main>
        </div>
      </div>
    </>
  )
}