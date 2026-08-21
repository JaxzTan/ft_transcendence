import { useEffect, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Board } from '../components/Board'
import { Die } from '../components/Die'
import { ClashOverlay } from '../game/ClashOverlay'
import { applyEvent, initialView } from '../game/reducer'
import type { PlayerColor } from '../game/types'
import { navigate } from '../router'
import { connectSocket } from '../socket'
import { getApi, postApi } from '../api'
import { useApp } from '../store'
import { SEAT_COLORS } from '../theme'
import { UserAvatar } from '../components/UserAvatar'
import { RetroNavbar } from '../components/RetroNavbar'
import { retroAudio } from '../utils/audio'
import '../styles/retrowave.css'

function Pips({ count, color }: { count: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: i < count ? color : 'rgba(255, 255, 255, 0.05)',
            border: `1.5px solid ${i < count ? color : 'rgba(255, 255, 255, 0.2)'}`,
            boxShadow: i < count ? `0 0 6px ${color}` : 'none',
            transition: 'all 0.2s ease',
          }}
        />
      ))}
    </div>
  )
}

/** Pip indexes (3x3 grid, row-major) lit per face value - mirrors Die.tsx. */
const MINI_PIP_MAP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

/** Compact 3x3 mini-die face for the "Last Rolled" box in the player rows. */
function MiniDie({ value }: { value: number }) {
  const on = MINI_PIP_MAP[value] || []
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 8,
        background: 'linear-gradient(135deg, #1f0d3d, #0d0221)',
        boxShadow: '0 0 8px rgba(0, 240, 255, 0.3), inset 0 0 4px rgba(255, 0, 127, 0.3)',
        border: '1.5px solid var(--accent-cyan)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr 1fr',
        padding: 4,
        gap: 2,
        flex: 'none',
      }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{ display: 'grid', placeItems: 'center' }}>
          {on.includes(i) ? (
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#ffe600',
                boxShadow: '0 0 4px #ffe600',
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}

// Matches the backend's SLOT_COLORS — hotseat seat index i always maps to
// this color, regardless of the Lobby seat-picker's own (unrelated) display order.
const SLOT_COLORS: PlayerColor[] = ['blue', 'red', 'green', 'yellow']

export function Game() {
  const { t } = useTranslation()
  const { user, activeMatch, seats, setPlaying, setLastResult, setActiveMatch } = useApp()

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

  // Custom names typed into the Lobby seat-setup for local (hotseat) seats —
  // seat 0 is always the logged-in host (uses their real username instead),
  // so only look at seats[1..].
  const localNames: Partial<Record<PlayerColor, string>> = {}
  seats.forEach((seat, i) => {
    if (i === 0) return
    if (seat.type === 'player') localNames[SLOT_COLORS[i]] = seat.name
  })
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null)
  const [view, dispatch] = useReducer(applyEvent, null, () => initialView(activeMatch?.color ?? 'red'))
  const viewRef = useRef(view)
  viewRef.current = view
  const [connected, setConnected] = useState(false)
  const [moveLogs, setMoveLogs] = useState<Array<{ ck: PlayerColor; text: string }>>([])
  const [isRolling, setIsRolling] = useState(false)
  const isRollingRef = useRef(false)
  const [codeCopied, setCodeCopied] = useState(false)

  // Box-by-box move animation: while set, Board renders this piece at `step`
  // instead of its real (already-updated) logical position — see the
  // piece_moved handler below, which steps through the server's `path`.
  const [animatingPiece, setAnimatingPiece] = useState<{ pieceId: string; step: number } | null>(null)
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const STEP_ANIM_MS = 180
  // Capture burst FX: a short cosmetic ring + sparks on the landing square
  // when a piece is captured. Set at the end of the mover's walk, cleared
  // after the burst plays out — purely visual, no game state involved.
  const [captureFx, setCaptureFx] = useState<{ color: string; to: number } | null>(null)
  const captureFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Friend-invite picker (waiting room, PvP only): lets the host invite an
  // accepted friend into THIS room (POST /api/game/:id/invite).
  const [friends, setFriends] = useState<Array<{ id: string; username: string }>>([])
  const [inviteStates, setInviteStates] = useState<Record<string, 'idle' | 'busy' | 'sent'>>({})

  const copyRoomCode = () => {
    if (!activeMatch?.inviteCode) return
    retroAudio.playUiBeep(720, 0.06)
    navigator.clipboard.writeText(activeMatch.inviteCode).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 1500)
    })
  }

  // Set presence status
  useEffect(() => {
    setPlaying(true)
    return () => setPlaying(false)
  }, [setPlaying])

  // Load accepted friends when waiting in a PvP room so the host can invite.
  useEffect(() => {
    if (view.status !== 'waiting' || activeMatch?.mode !== 'pvp') return
    getApi<Array<{ id: string; username: string }>>('/api/friends')
      .then((data) => setFriends(Array.isArray(data) ? data : []))
      .catch(() => setFriends([]))
  }, [view.status, activeMatch?.mode, activeMatch?.gameId])

  // Connect to engine via Socket.IO
  useEffect(() => {
    if (!activeMatch) return

    const socket = connectSocket(activeMatch.token)
    socketRef.current = socket

    // Refresh-safety: very old cached activeMatch objects (pre mode/playerCount
    // in the create response) may lack mode after a browser refresh. Re-derive
    // it from the match record so hotseat/PvE boundaries can never collapse
    // into a generic PvP rejoin.
    if (activeMatch && !activeMatch.mode) {
      fetch('/api/games/mine', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((rooms: Array<{ id: string; gameType?: string }> | null) => {
          const room = rooms?.find((x) => x.id === activeMatch.gameId)
          if (room?.gameType) {
            const mode = (room.gameType === 'PVP' ? 'pvp' : room.gameType === 'PVE' ? 'pve' : 'hotseat') as 'pvp' | 'pve' | 'hotseat'
            setActiveMatch({ ...activeMatch, mode, playerCount: activeMatch.playerCount ?? 4 })
          }
        })
        .catch(() => undefined)
    }

    socket.on('connect', () => {
      setConnected(true)
      // Hotseat: one physical device controls every seat — the engine has no
      // separate accounts to join with, so this single socket must join_game
      // for every local color up front.
      if (activeMatch.mode === 'hotseat') {
        for (const ck of Object.keys(localNames) as PlayerColor[]) {
          socket.emit('join_game', activeMatch.gameId, ck, undefined, localNames[ck])
        }
      }
      socket.emit('join_game', activeMatch.gameId, activeMatch.color)
      if (viewRef.current.clash) socket.emit('reconnect_clash')
    })

    socket.on('connect_error', (err: Error) => {
      console.error('[socket] connect_error', err.message)
    })

    socket.on('disconnect', () => {
      setConnected(false)
      setIsRolling(false)
      isRollingRef.current = false
    })

    socket.on('game_joined', (state) => {
      dispatch({ type: 'game_joined', ...(state as object) })
    })

    const handleEngineEvent = (state: unknown) => {
      const type = (state as { type?: string }).type
      dispatch({ type: 'state_update', ...(state as object) })

      if (type === 'dice_rolled') {
        const e = state as unknown as { value: number; bonusRoll: boolean; forfeited?: boolean }
        const roller = viewRef.current.players.find((p) => p.color === viewRef.current.currentTurn)
        retroAudio.playLaserSound()
        setIsRolling(true)
        setTimeout(() => {
          setIsRolling(false)
          isRollingRef.current = false
        }, 750)

        setMoveLogs((prev) => [
          {
            ck: viewRef.current.currentTurn,
            text: e.forfeited
              ? t('game.thirdSixForfeit', { name: roller?.username || viewRef.current.currentTurn })
              : `${t('game.rolledValue', { value: e.value })}${e.bonusRoll ? t('game.bonusSuffix') : ''}`,
          },
          ...prev.slice(0, 11),
        ])
      } else if (type === 'piece_moved') {
        const e = state as unknown as { pieceId: string; color: PlayerColor; captured: boolean; to: number; path: number[] }
        const path = e.path ?? []

        // Set animatingPiece SYNCHRONOUSLY to path[0] so React batches this with dispatch({ type: 'state_update' })
        // This prevents the piece from flickering at e.to on frame 1.
        if (path.length > 0) {
          setAnimatingPiece({ pieceId: e.pieceId, step: path[0] })
        }

        const runStepAnimation = () => {
          retroAudio.playUiBeep(580, 0.06, 'sine')
          setMoveLogs((prev) => [
            ck: e.color, text: e.captured ? t('game.capturedPiece', { to: e.to }), ,
            ...prev.slice(0, 11),
          ])

          if (path.length > 1) {
            if (animTimerRef.current) clearInterval(animTimerRef.current)
            let i = 0
            animTimerRef.current = setInterval(() => {
              i++
              if (i >= path.length) {
                if (animTimerRef.current) clearInterval(animTimerRef.current)
                animTimerRef.current = null
                setAnimatingPiece(null)
                return
              }
              setAnimatingPiece({ pieceId: e.pieceId, step: path[i] })
            }, STEP_ANIM_MS)
          } else {
            setAnimatingPiece(null)
          }

          if (e.captured) {
            retroAudio.playExplosionSound()
            if (captureFxTimerRef.current) clearTimeout(captureFxTimerRef.current)
            captureFxTimerRef.current = setTimeout(() => {
              setCaptureFx({ color: e.color, to: e.to })
              setTimeout(() => setCaptureFx(null), 600)
            }, (path.length || 1) * STEP_ANIM_MS)
          }
        }

        if (isRollingRef.current) {
          setTimeout(runStepAnimation, 750)
        } else {
          runStepAnimation()
        }
      } else if (type === 'lobby_update') {
        const e = state as unknown as { players: Array<{ username: string; color: PlayerColor }> }
        const mine = e.players.find((p) => p.username === user?.username)
        if (mine && mine.color !== viewRef.current.myColor) {
          dispatch({ type: 'my_color_changed', color: mine.color })
          socket.emit('join_game', activeMatch.gameId, mine.color)
          setActiveMatch({ ...activeMatch, color: mine.color })
        }
      } else if (type === 'game_ended') {
        const e = state as unknown as { winner: PlayerColor; resultDetail: string }
        retroAudio.playUiBeep(1100, 0.3, 'sawtooth')
        setLastResult({
          winner: e.winner,
          resultDetail: e.resultDetail,
          mode: activeMatch?.mode ?? 'pvp',
          playerCount: activeMatch?.playerCount ?? 4,
          players: viewRef.current.players
            .filter((p) => p.status === 'active')
            .map((p) => ({
              color: p.color, username: p.username, isBot: p.isBot, piecesInGoal: p.piecesInGoal,
            })),
        })
        setTimeout(() => navigate('/results'), 2500)
      }
    }

    socket.on('state_update', handleEngineEvent)
    socket.on('dice_rolled', handleEngineEvent)
    socket.on('piece_moved', handleEngineEvent)
    socket.on('game_started', handleEngineEvent)
    socket.on('game_ended', handleEngineEvent)
    socket.on('player_exited', handleEngineEvent)
    socket.on('player_disconnected', handleEngineEvent)
    socket.on('player_reconnected', handleEngineEvent)
    socket.on('clash_start', handleEngineEvent)
    socket.on('clash_result', handleEngineEvent)
    socket.on('clash_frozen', handleEngineEvent)
    socket.on('lobby_update', handleEngineEvent)

    socket.on('player_aborted', (e: { color: PlayerColor; username: string }) => {
      setMoveLogs((prev) => [
        { ck: e.color, text: t('game.playerAborted', { name: e.username }) },
        ...prev.slice(0, 11),
      ])
    })

    socket.on('game_timeout', () => {
      setLastResult({
        winner: viewRef.current.currentTurn,
        resultDetail: 'abandoned',
        mode: activeMatch?.mode ?? 'pvp',
        playerCount: activeMatch?.playerCount ?? 4,
        players: [],
        abandoned: true,
      })
      setActiveMatch(null)
      navigate('/results')
    })
    socket.on('game_expired', () => {
      setLastResult({
        winner: viewRef.current.currentTurn,
        resultDetail: 'abandoned',
        mode: activeMatch?.mode ?? 'pvp',
        playerCount: activeMatch?.playerCount ?? 4,
        players: [],
        abandoned: true,
      })
      setActiveMatch(null)
      navigate('/results')
    })

    socket.on('error', (msg: string) => {
      console.error('[engine]', msg)
      setIsRolling(false)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      if (animTimerRef.current) clearInterval(animTimerRef.current)
      animTimerRef.current = null
      if (captureFxTimerRef.current) clearTimeout(captureFxTimerRef.current)
      captureFxTimerRef.current = null
      setAnimatingPiece(null)
      setCaptureFx(null)
    }
  }, [activeMatch, setLastResult])

  useEffect(() => {
    if (!activeMatch || activeMatch.mode !== 'hotseat') return
    if (view.status !== 'active' || view.currentTurn === viewRef.current.myColor) return
    const seat = viewRef.current.players.find((p) => p.color === view.currentTurn)
    if (!seat || seat.isBot || seat.status !== 'active') return
    dispatch({ type: 'my_color_changed', color: view.currentTurn })
    socketRef.current?.emit('join_game', activeMatch.gameId, view.currentTurn, undefined, localNames[view.currentTurn])
  }, [view.currentTurn, view.status, activeMatch])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const v = viewRef.current
      if (v.status !== 'active') return
      if (v.currentTurn !== v.myColor) return
      if (v.turnPhase !== 'WAITING_FOR_ROLL') return
      if (v.clash || v.legalMoves.length > 0) return
      if (isRollingRef.current) return
      e.preventDefault()
      isRollingRef.current = true
      setIsRolling(true)
      retroAudio.playUiBeep(980, 0.08, 'sawtooth')
      socketRef.current?.emit('roll_dice')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const rollDice = () => {
    if (!canRoll || isRolling || isRollingRef.current) return
    isRollingRef.current = true
    setIsRolling(true)
    retroAudio.playUiBeep(980, 0.08, 'sawtooth')
    socketRef.current?.emit('roll_dice')
  }

  const movePiece = (pieceId: string) => {
    if (isRolling || isRollingRef.current) return
    retroAudio.playUiBeep(640, 0.05)
    socketRef.current?.emit('move_piece', pieceId)
  }

  const markReady = () => {
    retroAudio.playUiBeep(1100, 0.1)
    socketRef.current?.emit('player_ready')
  }

  const selectColor = (color: PlayerColor) => {
    retroAudio.playUiBeep(720, 0.05)
    socketRef.current?.emit('select_color', color)
  }

  const clashInput = (key: string) => socketRef.current?.emit('clash_input', key)
  const clearClash = () => dispatch({ type: 'clash_clear' })

  const inviteFriend = async (friendId: string) => {
    if (!activeMatch || inviteStates[friendId] === 'busy') return
    retroAudio.playUiBeep(800, 0.06)
    setInviteStates((prev) => ({ ...prev, [friendId]: 'busy' }))
    try {
      await postApi(`/api/game/${activeMatch.gameId}/invite`, { friendId })
      setInviteStates((prev) => ({ ...prev, [friendId]: 'sent' }))
    } catch {
      setInviteStates((prev) => ({ ...prev, [friendId]: 'idle' }))
    }
  }

  const endGame = () => {
    retroAudio.playExplosionSound()
    socketRef.current?.emit('end_game')
    setLastResult({
      winner: viewRef.current.currentTurn,
      resultDetail: 'abandoned',
      mode: activeMatch?.mode ?? 'pvp',
      playerCount: activeMatch?.playerCount ?? 4,
      players: [],
      abandoned: true,
    })
    setActiveMatch(null)
    navigate('/results')
  }

  // If no match credentials exist, redirect back to lobby
  if (!activeMatch) {
    return (
      <>
        <div className="grid-background">
          <div className="synthwave-sun" />
          <div className="grid-horizon" />
          <div className="perspective-grid" />
          <div className="win95-starfield" />
          <div className="terminal-vector-core" />
        </div>

        <div className={`crt-screen ${crtEnabled ? 'crt-curved' : ''}`} id="crtScreen">
          <div className="crt-scanlines" id="crtOverlay" style={{ display: crtEnabled ? 'block' : 'none' }} />
          <div className="crt-flicker" />

          <div className="app-wrapper" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <section className="retro-window" style={{ maxWidth: 460, width: '90%', margin: '0 auto' }}>
              <div className="window-header">
                <span>⚠️ SYSTEM ALERT // NO ACTIVE SESSION</span>
                <div className="window-controls">
                  <span className="window-btn min" />
                  <span className="window-btn max" />
                </div>
              </div>
              <div className="window-body" style={{ textAlign: 'center', padding: '30px 24px' }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>📡</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.85rem', color: 'var(--accent-yellow)', marginBottom: 10 }}>
                  NO MATCH CREDENTIALS DETECTED
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 24, lineHeight: 1.5 }}>
                  Please initialize or join a tactical Ludo arena from the Game Lobby first.
                </div>
                <button
                  className="retro-btn"
                  style={{ width: '100%', padding: '12px 0', fontSize: '0.8rem' }}
                  onClick={() => {
                    retroAudio.playUiBeep(600, 0.05)
                    navigate('/gamelobby')
                  }}
                >
                  &gt;_ RETURN TO GAME LOBBY
                </button>
              </div>
            </section>
          </div>
        </div>
      </>
    )
  }

  const isMyTurn = view.currentTurn === view.myColor
  const canRoll = isMyTurn && view.turnPhase === 'WAITING_FOR_ROLL' && !view.clash && !animatingPiece
  const turnLabel = view.status === 'waiting'
    ? t('game.waitingRoomTitle').toUpperCase()
    : isMyTurn ? t('game.yourTurnShort').toUpperCase() : `${view.currentTurn.toUpperCase()}'S TURN`

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
            activeRoute="/game"
            crtEnabled={crtEnabled}
            toggleCrt={toggleCrt}
          />

          {/* Hero Telemetry & Badge Bar */}
          <header className="hero-section" style={{ padding: '16px 0 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 className="hero-title" style={{ fontSize: '1.45rem', marginBottom: 4 }}>
                  RETROLUDO // COMBAT ARENA
                </h1>
                <p className="hero-subtitle" style={{ fontSize: '0.75rem', marginBottom: 0 }}>
                  TACTICAL DEPLOYMENT // MODE: {activeMatch.mode.toUpperCase()} ({view.players.length || 4}P)
                </p>
              </div>

              {/* Live Turn Announcement Pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 18px',
                  borderRadius: 4,
                  background: isMyTurn ? 'rgba(255, 0, 127, 0.25)' : 'rgba(0, 240, 255, 0.15)',
                  border: isMyTurn ? '2px solid var(--accent-pink)' : '1px solid var(--accent-cyan)',
                  boxShadow: isMyTurn ? '0 0 15px rgba(255, 0, 127, 0.6)' : 'none',
                  animation: isMyTurn ? 'pulse 1.6s infinite' : 'none',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: isMyTurn ? '#ffe600' : 'var(--accent-cyan)',
                    boxShadow: isMyTurn ? '0 0 8px #ffe600' : '0 0 6px var(--accent-cyan)',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.75rem',
                    color: isMyTurn ? '#ffe600' : '#ffffff',
                    letterSpacing: '0.5px',
                  }}
                >
                  {turnLabel}
                </span>
              </div>
            </div>

            {/* Badge Bar with Room Code and Telemetry */}
            <div className="badge-bar" style={{ marginTop: 12 }}>
              {activeMatch.inviteCode && (
                <button
                  className="retro-badge"
                  style={{
                    cursor: 'pointer',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--accent-cyan)',
                    color: 'var(--accent-cyan)',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onClick={copyRoomCode}
                  title="Click to copy Room Code"
                >
                  // ROOM: {activeMatch.inviteCode} [{codeCopied ? 'COPIED ✓' : 'COPY'}]
                </button>
              )}
              <span
                className="retro-badge"
                style={{
                  border: connected ? '1px solid #00ff88' : '1px solid #ff0055',
                  color: connected ? '#00ff88' : '#ff0055',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                // SIGNAL: {connected ? '● LIVE COMMS' : '○ RECONNECTING...'}
              </span>
              <span
                className="retro-badge"
                style={{
                  border: '1px solid var(--accent-yellow)',
                  color: 'var(--accent-yellow)',
                }}
              >
                // ASSIGNED SEAT: {view.myColor.toUpperCase()}
              </span>
              <span
                className="retro-badge"
                style={{
                  border: '1px dashed rgba(255, 255, 255, 0.2)',
                  color: 'var(--text-muted)',
                  opacity: 0.7,
                }}
              >
                // PHASE: {view.turnPhase}
              </span>
            </div>
          </header>

          {/* Main Tactical Grid Layout */}
          <main
            className="dashboard-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '310px 1fr 310px',
              gap: 18,
              alignItems: 'start',
              width: '100%',
              margin: '0 auto',
            }}
          >
            {/* COLUMN 1: PILOT ROSTER // TACTICAL STATUS */}
            <section className="retro-window" id="playersWindow">
              <div className="window-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>👥 PILOT ROSTER</span>
                </div>
                <div className="window-controls">
                  <span className="window-btn min" />
                  <span className="window-btn max" />
                </div>
              </div>

              <div className="window-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                    SEAT // PILOT CALLSIGN
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    ROLL / GOALS
                  </span>
                </div>

                {SEAT_COLORS.map((ck) => {
                  const playerMeta = view.players.find((p) => p.color === ck)
                  const occupied = playerMeta && (view.status !== 'waiting' || playerMeta.status === 'active')
                  const isActive = view.currentTurn === ck

                  // Color neon accent map
                  const colorAccent =
                    ck === 'red'
                      ? '#ff007f'
                      : ck === 'green'
                        ? '#00ff88'
                        : ck === 'yellow'
                          ? '#ffe600'
                          : '#00f0ff'

                  if (view.status === 'waiting') {
                    const isYou = ck === view.myColor
                    const isReady = view.readyPlayers.includes(ck)
                    return (
                      <div
                        key={ck}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 4,
                          border: isYou
                            ? `1.5px solid ${colorAccent}`
                            : occupied
                              ? `1px solid ${colorAccent}66`
                              : '1px dashed rgba(255, 255, 255, 0.15)',
                          background: isYou
                            ? 'rgba(255, 0, 127, 0.18)'
                            : occupied
                              ? 'rgba(25, 10, 56, 0.65)'
                              : 'rgba(10, 5, 25, 0.35)',
                          boxShadow: isYou ? `0 0 10px ${colorAccent}44` : 'none',
                          opacity: occupied ? 1 : 0.5,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {occupied && playerMeta?.username ? (
                          <UserAvatar
                            username={playerMeta.username}
                            size={34}
                            fallbackStyle={{
                              width: 34,
                              height: 34,
                              flex: 'none',
                              borderRadius: 4,
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 'bold',
                              fontSize: '0.75rem',
                              color: '#0d0221',
                              background: colorAccent,
                              border: `1px solid ${colorAccent}`,
                            }}
                            style={{ borderRadius: 4, border: `1px solid ${colorAccent}` }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              flex: 'none',
                              borderRadius: 4,
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 'bold',
                              fontSize: '0.7rem',
                              color: colorAccent,
                              background: 'transparent',
                              border: `1.5px dashed ${colorAccent}88`,
                            }}
                          >
                            ?
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 'bold',
                              fontSize: '0.82rem',
                              color: occupied ? '#ffffff' : 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {occupied ? playerMeta!.username : t('game.emptySeat')}
                          </div>
                          <div style={{ color: colorAccent, fontSize: '0.68rem', textTransform: 'uppercase' }}>
                            {ck} {isYou ? '• (YOU)' : ''}
                          </div>
                        </div>
                        {occupied && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 'bold',
                              color: isReady ? '#00ff88' : 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {isReady ? `✓ READY` : 'STANDBY'}
                          </span>
                        )}
                      </div>
                    )
                  }

                  if (!playerMeta || playerMeta.status === 'exited') return null
                  const isDisconnected = playerMeta.status === 'disconnected'
                  const isHotseat = activeMatch.mode === 'hotseat'
                  const isYou = isHotseat
                    ? ck === view.myColor
                    : !playerMeta.isBot && playerMeta.username === user?.username
                  const name = playerMeta.username
                  const sub = isDisconnected
                    ? t('game.reconnecting')
                    : playerMeta.isBot
                      ? t('common.bot')
                      : isYou
                        ? t('common.you')
                        : isHotseat
                          ? t('game.localPlayer')
                          : 'Pilot'
                  const goalCount = playerMeta.piecesInGoal ?? 0
                  const lastRoll = view.lastRolls[ck]

                  return (
                    <div
                      key={ck}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 4,
                        border: isActive
                          ? `2px solid ${colorAccent}`
                          : `1px solid ${colorAccent}44`,
                        background: isActive
                          ? `linear-gradient(135deg, ${colorAccent}33, rgba(25, 10, 56, 0.9))`
                          : 'rgba(25, 10, 56, 0.65)',
                        boxShadow: isActive ? `0 0 15px ${colorAccent}66, inset 0 0 10px ${colorAccent}22` : 'none',
                        opacity: isDisconnected ? 0.55 : 1,
                        position: 'relative',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {!playerMeta.isBot && !isHotseat ? (
                        <UserAvatar
                          username={name}
                          size={36}
                          fallbackStyle={{
                            width: 36,
                            height: 36,
                            flex: 'none',
                            borderRadius: 4,
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            color: '#0d0221',
                            background: colorAccent,
                          }}
                          style={{ borderRadius: 4, border: `1.5px solid ${colorAccent}` }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            flex: 'none',
                            borderRadius: 4,
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            color: '#0d0221',
                            background: colorAccent,
                            border: `1.5px solid ${colorAccent}`,
                          }}
                        >
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 'bold',
                            fontSize: '0.84rem',
                            color: '#ffffff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {name}
                        </div>
                        <div style={{ color: colorAccent, fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{ck.toUpperCase()}</span>
                          <span>// {sub.toUpperCase()}</span>
                        </div>
                      </div>
                      <Pips count={goalCount} color={colorAccent} />
                      <div style={{ flex: 'none' }}>
                        {lastRoll ? (
                          <MiniDie value={lastRoll} />
                        ) : (
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 8,
                              border: '1px dashed rgba(255, 255, 255, 0.2)',
                              display: 'grid',
                              placeItems: 'center',
                              color: 'var(--text-muted)',
                              fontSize: '0.8rem',
                              flex: 'none',
                            }}
                          >
                            –
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* COLUMN 2: QUANTUM LUDO MATRIX / BOARD */}
            <section className="retro-window" id="boardWindow" style={{ width: '100%' }}>
              <div className="window-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🎲 QUANTUM LUDO MATRIX</span>
                </div>
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
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px 14px',
                  background: 'rgba(10, 2, 28, 0.65)',
                }}
              >
                {/* Tactical Board Status Marquee */}
                <div
                  style={{
                    width: '100%',
                    maxWidth: 520,
                    padding: '8px 12px',
                    marginBottom: 14,
                    background: 'rgba(0, 0, 0, 0.6)',
                    border: '1px solid rgba(0, 240, 255, 0.35)',
                    borderRadius: 4,
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    color: isMyTurn ? '#ffe600' : 'var(--accent-cyan)',
                  }}
                >
                  {view.status === 'waiting'
                    ? '>>> WAITING FOR PILOTS TO READY UP <<<'
                    : isRolling
                      ? '>>> 🎲 ROLLING DICE... <<<'
                      : isMyTurn && view.turnPhase === 'WAITING_FOR_ROLL'
                        ? '>>> YOUR TURN: PRESS SPACEBAR OR ROLL DICE <<<'
                        : isMyTurn && view.turnPhase === 'WAITING_FOR_MOVE'
                          ? '>>> SELECT HIGHLIGHTED PIECE TO ADVANCE <<<'
                          : `>>> WAITING FOR PILOT ${view.currentTurn.toUpperCase()}... <<<`}
                </div>

                {/* Cyber Frame Board Container */}
                <div
                  style={{
                    width: '100%',
                    maxWidth: 530,
                    padding: 14,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, rgba(25, 10, 56, 0.95), rgba(13, 2, 33, 0.95))',
                    border: '2px solid var(--accent-pink)',
                    boxShadow: '0 0 25px rgba(255, 0, 127, 0.35), inset 0 0 20px rgba(0, 240, 255, 0.2)',
                  }}
                >
                  <Board
                    pieces={view.pieces}
                    players={view.players}
                    legalMoves={isRolling ? [] : view.legalMoves}
                    onPieceClick={isRolling ? () => { } : movePiece}
                    animating={animatingPiece}
                    fx={captureFx}
                  />
                </div>
              </div>
            </section>

            {/* COLUMN 3: TACTICAL CONTROLS & LOGS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {view.status === 'waiting' ? (
                /* WAITING ROOM SETUP WINDOW */
                <section className="retro-window" id="waitingSetupWindow">
                  <div className="window-header">
                    <span>⏳ WAITING BAY SETUP</span>
                    <div className="window-controls">
                      <span className="window-btn min" />
                      <span className="window-btn max" />
                    </div>
                  </div>

                  <div className="window-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                        // SELECT SEAT COLOR:
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                        {SEAT_COLORS.map((ck) => {
                          const colAccent =
                            ck === 'red'
                              ? '#ff007f'
                              : ck === 'green'
                                ? '#00ff88'
                                : ck === 'yellow'
                                  ? '#ffe600'
                                  : '#00f0ff'
                          const takenByOther = view.players.some(
                            (p) => p.color === ck && p.status === 'active' && ck !== view.myColor
                          )
                          const isSelected = ck === view.myColor
                          return (
                            <button
                              key={ck}
                              onClick={() => selectColor(ck)}
                              title={ck.toUpperCase()}
                              disabled={takenByOther}
                              style={{
                                flex: 1,
                                height: 34,
                                borderRadius: 4,
                                cursor: takenByOther ? 'not-allowed' : 'pointer',
                                background: isSelected ? colAccent : 'rgba(25, 10, 56, 0.8)',
                                border: isSelected ? `2px solid #ffffff` : `1px solid ${colAccent}`,
                                boxShadow: isSelected ? `0 0 12px ${colAccent}` : 'none',
                                color: isSelected ? '#0d0221' : colAccent,
                                fontWeight: 'bold',
                                fontSize: '0.65rem',
                                fontFamily: 'var(--font-mono)',
                                opacity: takenByOther ? 0.35 : 1,
                              }}
                            >
                              {ck.slice(0, 3).toUpperCase()}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {(() => {
                      const activeCount = view.players.filter((p) => p.status === 'active').length
                      const alreadyReady = view.readyPlayers.includes(view.myColor)
                      const soloRoom = activeCount < 2
                      const disabled = alreadyReady || soloRoom
                      return (
                        <button
                          className="retro-btn"
                          onClick={markReady}
                          disabled={disabled}
                          style={{
                            width: '100%',
                            padding: '12px 0',
                            fontSize: '0.8rem',
                            background: alreadyReady ? 'rgba(0, 255, 136, 0.2)' : 'var(--btn-bg)',
                            borderColor: alreadyReady ? '#00ff88' : 'var(--accent-pink)',
                            color: alreadyReady ? '#00ff88' : '#ffffff',
                            opacity: disabled ? 0.6 : 1,
                            cursor: disabled ? 'default' : 'pointer',
                          }}
                        >
                          {alreadyReady
                            ? '✓ READY (WAITING)'
                            : soloRoom
                              ? 'WAITING OPPONENT'
                              : '▶ READY TO LAUNCH'}
                        </button>
                      )
                    })()}

                    <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                      // READY PILOTS:{' '}
                      <span style={{ color: '#ffe600', fontWeight: 'bold' }}>
                        {view.readyPlayers.length}
                      </span>{' '}
                      /{' '}
                      <span style={{ color: '#ffffff' }}>
                        {view.players.filter((p) => p.status === 'active').length}
                      </span>
                    </div>

                    {activeMatch?.mode === 'pvp' && (
                      <div style={{ borderTop: '1px solid rgba(255, 0, 127, 0.25)', paddingTop: 12 }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                          // INVITE COMMS:
                        </div>
                        {friends.length === 0 ? (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            No online friends available to invite.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 110, overflowY: 'auto' }}>
                            {friends.map((f) => {
                              const st = inviteStates[f.id] ?? 'idle'
                              return (
                                <div
                                  key={f.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 8px',
                                    background: 'rgba(0, 0, 0, 0.4)',
                                    borderRadius: 3,
                                  }}
                                >
                                  <span style={{ fontSize: '0.75rem', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                                    {f.username}
                                  </span>
                                  <button
                                    className="retro-btn"
                                    onClick={() => inviteFriend(f.id)}
                                    disabled={st !== 'idle'}
                                    style={{ padding: '3px 8px', fontSize: '0.62rem' }}
                                  >
                                    {st === 'busy' ? '...' : st === 'sent' ? 'SENT ✓' : '+ INVITE'}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              ) : (
                /* IN-GAME DICE CONTROLS WINDOW */
                <section className="retro-window" id="diceControlWindow">
                  <div className="window-header">
                    <span>⚡ TACTICAL DICE SYSTEM</span>
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
                      alignItems: 'center',
                      gap: 12,
                      padding: '16px 14px',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.72rem',
                        color: isMyTurn ? '#ffe600' : 'var(--text-muted)',
                      }}
                    >
                      {isRolling
                        ? '// ROLLING...'
                        : canRoll
                          ? '// PILOT TURN: ROLL NOW'
                          : view.turnPhase === 'WAITING_FOR_MOVE'
                            ? '// SELECT HIGHLIGHTED PIECE'
                            : `// WAITING FOR ${view.currentTurn.toUpperCase()}`}
                    </div>

                    <div style={{ height: 90, display: 'grid', placeItems: 'center' }}>
                      <Die value={view.diceValue ?? 0} rolling={isRolling} />
                    </div>

                    <button
                      className="retro-btn"
                      onClick={rollDice}
                      disabled={!canRoll || isRolling}
                      style={{
                        width: '100%',
                        padding: '12px 0',
                        fontSize: '0.85rem',
                        background: canRoll && !isRolling ? 'var(--btn-bg)' : 'rgba(25, 10, 56, 0.5)',
                        borderColor: canRoll && !isRolling ? 'var(--accent-pink)' : 'rgba(255, 255, 255, 0.2)',
                        boxShadow: canRoll && !isRolling ? '0 0 15px var(--accent-pink)' : 'none',
                        cursor: canRoll && !isRolling ? 'pointer' : 'default',
                        opacity: canRoll && !isRolling ? 1 : 0.5,
                      }}
                    >
                      {isRolling ? 'ROLLING...' : '🎲 ROLL DICE'}
                    </button>

                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        color: 'var(--accent-cyan)',
                        textAlign: 'center',
                      }}
                    >
                      [ SHORTCUT: PRESS SPACEBAR ]
                    </div>
                  </div>
                </section>
              )}

              {/* MISSION TELEMETRY LOG WINDOW */}
              <section className="retro-window" id="moveLogWindow">
                <div className="window-header">
                  <span>📟 MISSION TELEMETRY</span>
                  <div className="window-controls">
                    <span className="window-btn min" />
                    <span className="window-btn max" />
                  </div>
                </div>

                <div
                  className="window-body"
                  style={{
                    maxHeight: 180,
                    minHeight: 140,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '10px 12px',
                    background: 'rgba(5, 2, 15, 0.75)',
                  }}
                >
                  {moveLogs.length === 0 ? (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Telemetric events will stream here...
                    </div>
                  ) : (
                    moveLogs.map((ml, i) => {
                      const dotColor =
                        ml.ck === 'red'
                          ? '#ff007f'
                          : ml.ck === 'green'
                            ? '#00ff88'
                            : ml.ck === 'yellow'
                              ? '#ffe600'
                              : '#00f0ff'
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            gap: 8,
                            fontSize: '0.72rem',
                            color: '#ffffff',
                            fontFamily: 'var(--font-mono)',
                            lineHeight: 1.3,
                          }}
                        >
                          <span style={{ color: dotColor, fontWeight: 'bold' }}>●</span>
                          <span>{ml.text}</span>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>

              {/* ABORT MISSION / END GAME BUTTON */}
              <button
                className="retro-btn"
                onClick={endGame}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  fontSize: '0.72rem',
                  background: 'rgba(255, 0, 85, 0.15)',
                  border: '1px solid #ff0055',
                  color: '#ff0055',
                  letterSpacing: '0.5px',
                }}
              >
                ⚠️ ABORT MATCH // END GAME
              </button>
            </div>
          </main>
        </div>
      </div>

      {/* QTE Clash overlay */}
      {view.clash && (
        <ClashOverlay
          clash={view.clash}
          result={view.clashResult}
          myColor={view.myColor}
          onKeyPress={clashInput}
          onComplete={clearClash}
        />
      )}
    </>
  )
}
