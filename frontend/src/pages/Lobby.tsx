import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { postApi } from '../api'
import { UserAvatar } from '../components/UserAvatar'
import type { PlayerColor } from '../game/types'
import { navigate, useRoute } from '../router'
import { useApp, type PlayerCount } from '../store'
import { SEAT_COLORS, type ColorKey } from '../theme'
import { retroAudio } from '../utils/audio'
import '../styles/retrowave.css'

const COLOR_KEYS: Record<ColorKey, string> = {
  red: 'lobby.colorRed',
  green: 'lobby.colorGreen',
  yellow: 'lobby.colorYellow',
  blue: 'lobby.colorBlue',
}

const SEAT_HUES: Record<ColorKey, string> = {
  red: '#ff007f',
  green: '#00ff88',
  yellow: '#ffe600',
  blue: '#00f0ff',
}

export function Lobby() {
  const { t } = useTranslation()
  const { query } = useRoute()
  const { user, seats, addBot, removeBot, addPlayer, removePlayer, renamePlayer, resetSeats, setActiveMatch } = useApp()
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [editingSeat, setEditingSeat] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const [crtEnabled] = useState(() => {
    return localStorage.getItem('crt_enabled') !== 'false'
  })

  useEffect(() => {
    resetSeats()
  }, [resetSeats])

  const playerCount = (Number(query.get('mode')) as PlayerCount) || 4
  const allowAddPlayers = query.get('bots') !== '0'
  const isLocal = query.get('local') === '1'
  const isSolo = playerCount === 1

  const visible = seats.slice(0, playerCount)
  const botCount = visible.filter((s) => s.type === 'bot').length
  const emptyCount = visible.filter((s) => s.type === 'empty').length

  const canStart = isSolo
    ? true
    : allowAddPlayers
      ? botCount >= 1
      : visible.filter((s) => s.type === 'you' || s.type === 'player').length >= 2

  const onStart = async () => {
    if (!canStart || starting) return
    retroAudio.playUiBeep(880, 0.1)
    setStartError(null)
    setStarting(true)
    try {
      const gameMode = allowAddPlayers ? 'pve' : (isLocal || isSolo || playerCount === 2) ? 'hotseat' : 'pvp'
      const filledCount = visible.filter((s) => s.type === 'you' || s.type === 'player').length
      const res = await postApi<{
        gameId: string
        token: string
        engineUrl: string
        color: PlayerColor
        inviteCode?: string
        mode: 'pvp' | 'pve' | 'hotseat'
        playerCount: number
      }>('/api/match/create', {
        mode: gameMode,
        playerCount: gameMode === 'hotseat' ? filledCount : playerCount,
        botCount: allowAddPlayers ? visible.filter((s) => s.type === 'bot').length : 0,
        clashEnabled: true,
      })
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Failed to create match')
      setStarting(false)
    }
  }

  return (
    <>
      {/* Animated 3D Synthwave Background */}
      <div className="grid-background">
        <div className="synthwave-sun" />
        <div className="grid-horizon" />
        <div className="perspective-grid" />
        <div className="win95-starfield" />
        <div className="terminal-vector-core" />
      </div>

      {/* CRT FX Overlay */}
      <div className={`crt-screen ${crtEnabled ? 'crt-curved' : ''}`} id="crtScreen">
        <div
          className="crt-scanlines"
          id="crtOverlay"
          style={{ display: crtEnabled ? 'block' : 'none' }}
        />
        <div className="crt-flicker" />

        {/* Main Content Container */}
        <div
          className="app-wrapper"
          style={{
            marginLeft: 'auto',
            marginRight: 'auto',
            maxWidth: 1440,
            width: '100%',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            padding: '16px 20px',
            boxSizing: 'border-box',
          }}
        >
          {/* Hero Header - Identical 1-to-1 design & dimensions as Game.tsx */}
          <header className="hero-section" style={{ padding: '16px 0 14px', textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <h1 className="hero-title" style={{ fontSize: '1.6rem', marginBottom: 4, textAlign: 'center' }}>
                {isSolo ? '// SOLO PRACTICE BAY //' : '// ARENA MATCH CONFIGURATION //'}
              </h1>

              {/* Live Pill Announcement Bar */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 20px',
                  borderRadius: 4,
                  background: 'rgba(0, 240, 255, 0.15)',
                  border: '1px solid var(--accent-cyan)',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'var(--accent-cyan)',
                    boxShadow: '0 0 6px var(--accent-cyan)',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.75rem',
                    color: '#ffffff',
                    letterSpacing: '0.5px',
                  }}
                >
                  {isSolo ? 'SOLO RUN MODE' : 'ARENA LOBBY READY'}
                </span>
              </div>

              {/* Status Marquee Subtitle Bar */}
              <div
                style={{
                  width: '100%',
                  maxWidth: 740,
                  padding: '8px 14px',
                  background: 'rgba(0, 0, 0, 0.6)',
                  border: '1px solid rgba(0, 240, 255, 0.35)',
                  borderRadius: 4,
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                  color: 'var(--accent-cyan)',
                }}
              >
                {isSolo
                  ? '>>> TEST YOUR LUCK AGAINST ARENA HAZARDS <<<'
                  : '>>> CONFIGURE PILOT SEATS, BOTS & TACTICAL PARAMETERS <<<'}
              </div>
            </div>
          </header>

          {/* Main Grid */}
          <main
            className="dashboard-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1.25fr 0.85fr',
              gap: 20,
              alignItems: 'stretch',
              width: '100%',
              margin: '0 auto',
            }}
          >
            {/* LEFT COLUMN: SEAT ASSIGNMENT WINDOW & BACK BUTTON */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <section className="retro-window" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="window-header">
                  <span>// SEAT ROSTER & PILOT ASSIGNMENTS ({playerCount - emptyCount}/{playerCount})</span>
                  <div className="window-controls">
                    <span className="window-btn min" />
                    <span className="window-btn max" />
                  </div>
                </div>

                <div className="window-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 14, flex: 1 }}>
                  {visible.map((seat, i) => {
                    const ck = SEAT_COLORS[i]
                    const hue = SEAT_HUES[ck]
                    const colorName = t(COLOR_KEYS[ck]).toUpperCase()

                    return (
                      <div
                        key={i}
                        style={{
                          position: 'relative',
                          borderRadius: 6,
                          background: 'rgba(10, 2, 28, 0.85)',
                          border: `1.5px solid ${hue}`,
                          boxShadow: `0 0 10px ${hue}25`,
                          display: 'flex',
                          flexDirection: 'column',
                          height: 138,
                          overflow: 'hidden',
                          boxSizing: 'border-box',
                        }}
                      >
                        {/* Color Header Stripe */}
                        <div style={{ height: 3, background: hue }} />

                        <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          {/* SEAT BADGE HEADER */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: hue, fontWeight: 'bold' }}>
                              // SEAT 0{i + 1}: {colorName}
                            </span>
                          </div>

                          {/* SEAT CONTENT */}
                          {seat.type === 'you' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, justifyContent: 'space-between', marginTop: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <UserAvatar
                                  username={user?.username || ''}
                                  size={36}
                                  fallbackStyle={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 6,
                                    background: hue,
                                    color: '#0d0221',
                                    fontWeight: 'bold',
                                    display: 'grid',
                                    placeItems: 'center',
                                  }}
                                  style={{ borderRadius: 6, border: `1px solid ${hue}` }}
                                />
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#ffffff', fontFamily: 'var(--font-heading)' }}>
                                    {user?.username.toUpperCase() || t('common.you')}
                                  </div>
                                  <div style={{ color: hue, fontSize: '0.65rem', fontFamily: 'var(--font-mono)' }}>
                                    [HOST / PILOT 01]
                                  </div>
                                </div>
                              </div>
                              <div style={{ fontSize: '0.65rem', color: '#00ff88', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                                &gt;&gt; STATE: READY // HOST
                              </div>
                            </div>
                          )}

                          {seat.type === 'bot' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, justifyContent: 'space-between', marginTop: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div
                                    style={{
                                      width: 34,
                                      height: 34,
                                      borderRadius: 6,
                                      background: `${hue}25`,
                                      border: `1px solid ${hue}`,
                                      color: hue,
                                      fontWeight: 'bold',
                                      display: 'grid',
                                      placeItems: 'center',
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: '0.72rem',
                                    }}
                                  >
                                    AI
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#ffffff', fontFamily: 'var(--font-heading)' }}>
                                      {seat.name}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'var(--font-mono)' }}>
                                      [AI BOT]
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => {
                                    retroAudio.playUiBeep(320, 0.05)
                                    removeBot(i)
                                  }}
                                  style={{
                                    cursor: 'pointer',
                                    background: 'rgba(255, 0, 85, 0.15)',
                                    border: '1px solid #ff0055',
                                    color: '#ff0055',
                                    borderRadius: 4,
                                    width: 24,
                                    height: 24,
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontSize: '0.72rem',
                                  }}
                                  title="Remove Bot"
                                >
                                  ✕
                                </button>
                              </div>
                              <div style={{ fontSize: '0.65rem', color: hue, fontFamily: 'var(--font-mono)' }}>
                                &gt;&gt; STATE: AI READY
                              </div>
                            </div>
                          )}

                          {seat.type === 'player' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, justifyContent: 'space-between', marginTop: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                                  <div
                                    style={{
                                      width: 34,
                                      height: 34,
                                      borderRadius: 6,
                                      background: `${hue}25`,
                                      border: `1px solid ${hue}`,
                                      color: hue,
                                      fontWeight: 'bold',
                                      display: 'grid',
                                      placeItems: 'center',
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: '0.72rem',
                                    }}
                                  >
                                    P{i + 1}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    {editingSeat === i ? (
                                      <input
                                        autoFocus
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onBlur={() => {
                                          renamePlayer(i, editName.trim() || seat.name)
                                          setEditingSeat(null)
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            renamePlayer(i, editName.trim() || seat.name)
                                            setEditingSeat(null)
                                          }
                                        }}
                                        style={{
                                          width: '90%',
                                          background: 'rgba(0,0,0,0.8)',
                                          border: `1px solid ${hue}`,
                                          borderRadius: 4,
                                          color: '#ffffff',
                                          padding: '2px 6px',
                                          fontSize: '0.78rem',
                                          fontFamily: 'var(--font-mono)',
                                        }}
                                      />
                                    ) : (
                                      <div
                                        onClick={() => {
                                          setEditingSeat(i)
                                          setEditName(seat.name)
                                        }}
                                        style={{ fontWeight: 800, fontSize: '0.82rem', color: '#ffffff', fontFamily: 'var(--font-heading)', cursor: 'pointer' }}
                                        title="Click to rename pilot"
                                      >
                                        {seat.name} ✎
                                      </div>
                                    )}
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'var(--font-mono)' }}>
                                      [HOTSEAT PILOT]
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => {
                                    retroAudio.playUiBeep(320, 0.05)
                                    removePlayer(i)
                                  }}
                                  style={{
                                    cursor: 'pointer',
                                    background: 'rgba(255, 0, 85, 0.15)',
                                    border: '1px solid #ff0055',
                                    color: '#ff0055',
                                    borderRadius: 4,
                                    width: 24,
                                    height: 24,
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontSize: '0.72rem',
                                  }}
                                  title="Remove Player"
                                >
                                  ✕
                                </button>
                              </div>
                              <div style={{ fontSize: '0.65rem', color: '#00ff88', fontFamily: 'var(--font-mono)' }}>
                                &gt;&gt; STATE: STANDBY
                              </div>
                            </div>
                          )}

                          {seat.type === 'empty' && (
                            <div
                              onClick={() => {
                                retroAudio.playUiBeep(520, 0.05)
                                if (allowAddPlayers) addBot(i)
                                else addPlayer(i)
                              }}
                              style={{
                                flex: 1,
                                border: `1.5px dashed ${hue}66`,
                                borderRadius: 4,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                                cursor: 'pointer',
                                background: 'rgba(0,0,0,0.4)',
                                transition: 'all 0.2s ease',
                                marginTop: 4,
                              }}
                            >
                              <div
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: '50%',
                                  border: `1.5px dashed ${hue}`,
                                  color: hue,
                                  display: 'grid',
                                  placeItems: 'center',
                                  fontSize: '1rem',
                                  fontWeight: 'bold',
                                }}
                              >
                                +
                              </div>
                              <div style={{ fontSize: '0.68rem', color: hue, fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                                {allowAddPlayers ? '+ ADD AI BOT' : '+ ADD HUMAN PILOT'}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* RETURN TO GAME LOBBY BUTTON */}
              <button
                className="retro-btn"
                style={{
                  width: '100%',
                  padding: '10px 0',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.5px',
                  background: 'rgba(0, 240, 255, 0.12)',
                  border: '1px solid var(--accent-cyan)',
                  color: 'var(--accent-cyan)',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  retroAudio.playUiBeep(440, 0.05)
                  navigate('/gamelobby')
                }}
              >
                &lt; RETURN TO GAME LOBBY
              </button>
            </div>

            {/* RIGHT COLUMN: LAUNCH CONTROL WINDOW */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* LAUNCH CONTROL WINDOW */}
              <section className="retro-window" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="window-header">
                  <span>// ARENA LAUNCH CONTROL</span>
                  <div className="window-controls">
                    <span className="window-btn min" />
                    <span className="window-btn max" />
                  </div>
                </div>

                <div className="window-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20, flex: 1, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>// ACTIVE PILOTS:</span>
                      <span style={{ color: '#ffffff', fontWeight: 'bold' }}>
                        {playerCount - emptyCount} / {playerCount}
                      </span>
                    </div>

                    {!isSolo && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>// BOT UNITS:</span>
                        <span style={{ color: '#00ff88', fontWeight: 'bold' }}>
                          {botCount} UNIT{botCount === 1 ? '' : 'S'}
                        </span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>// ARENA MODE:</span>
                      <span style={{ color: '#ffe600', fontWeight: 'bold' }}>
                        {isSolo ? 'SOLO PRACTICE' : isLocal ? 'LOCAL HOTSEAT' : 'PVE ARENA'}
                      </span>
                    </div>

                    {/* Status Info Box */}
                    <div
                      style={{
                        padding: '12px 14px',
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(0, 240, 255, 0.3)',
                        borderRadius: 4,
                        textAlign: 'center',
                        fontSize: '0.72rem',
                        fontFamily: 'var(--font-mono)',
                        color: canStart ? '#00ff88' : '#ffe600',
                        marginTop: 6,
                      }}
                    >
                      {canStart
                        ? '>>> ALL SYSTEM CHECKS PASSED. ARENA READY FOR LAUNCH <<<'
                        : '>>> ASSIGN AT LEAST 1 BOT/PILOT TO INITIALIZE MATCH <<<'}
                    </div>
                  </div>

                  <div>
                    {/* LAUNCH BUTTON */}
                    <button
                      onClick={onStart}
                      disabled={!canStart || starting}
                      className="retro-btn"
                      style={{
                        width: '100%',
                        padding: '14px 0',
                        fontSize: '0.88rem',
                        fontFamily: 'var(--font-heading)',
                        letterSpacing: '1px',
                        background: canStart ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: canStart ? '1px solid #00ff88' : '1px solid rgba(255, 255, 255, 0.2)',
                        color: canStart ? '#00ff88' : 'var(--text-muted)',
                        cursor: canStart ? 'pointer' : 'not-allowed',
                        boxShadow: canStart ? '0 0 15px rgba(0, 255, 136, 0.4)' : 'none',
                      }}
                    >
                      {starting
                        ? '// INITIALIZING ARENA...'
                        : canStart
                          ? (isSolo ? '// START SOLO PRACTICE //' : '// LAUNCH ARENA MATCH //')
                          : '// ADD BOT TO START //'}
                    </button>

                    {startError && (
                      <div style={{ textAlign: 'center', color: '#ff0055', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', marginTop: 8 }}>
                        {startError}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
