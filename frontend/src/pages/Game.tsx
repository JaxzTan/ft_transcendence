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
import { CyberButton, CyberModal } from '../components/CyberModal'
import { retroAudio } from '../utils/audio'
import '../styles/retrowave.css'

const SEAT_HUES: Record<PlayerColor, string> = {
  red: '#ff007f',
  green: '#00ff88',
  yellow: '#ffe600',
  blue: '#00f0ff',
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
      className="retro-die-cube"
      style={{
        width: 34,
        height: 34,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr 1fr',
        padding: 3,
        gap: 2,
        flex: 'none',
      }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{ display: 'grid', placeItems: 'center' }}>
          {on.includes(i) ? (
            <div
              className="retro-die-pip"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
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
  // CRT & AUDIO CONTROLS
  // ------------------------------------------------------------------------
  const [crtEnabled, setCrtEnabled] = useState(true)
  const [soundMuted, setSoundMuted] = useState(retroAudio.muted)
  const [isAbortModalOpen, setIsAbortModalOpen] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('retro_theme') || 'synthwave'
    document.documentElement.setAttribute('data-theme', savedTheme)
    document.body.setAttribute('data-theme', savedTheme)

    const savedCrt = localStorage.getItem('retro_crt')
    if (savedCrt === 'false') {
      setCrtEnabled(false)
    }
  }, [])

  const toggleSound = () => {
    retroAudio.muted = !retroAudio.muted
    setSoundMuted(retroAudio.muted)
    if (!retroAudio.muted) {
      retroAudio.playUiBeep(520, 0.06)
    }
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
  const [moveLogs, setMoveLogs] = useState<Array<{ ck: PlayerColor; text: string }>>([])
  const moveLogContainerRef = useRef<HTMLDivElement>(null)
  const [isRolling, setIsRolling] = useState(false)
  const isRollingRef = useRef(false)
  const [displayedLastRolls, setDisplayedLastRolls] = useState<Partial<Record<PlayerColor, number>>>({})
  const [turnSwapNotice, setTurnSwapNotice] = useState<string | null>(null)
  const prevTurnRef = useRef<PlayerColor | null>(null)

  useEffect(() => {
    if (moveLogContainerRef.current) {
      moveLogContainerRef.current.scrollTop = moveLogContainerRef.current.scrollHeight
    }
  }, [moveLogs.length])

  useEffect(() => {
    if (!view) return
    if (prevTurnRef.current && prevTurnRef.current !== view.currentTurn) {
      const nextTurnPlayer = view.players.find((p) => p.color === view.currentTurn)
      const isNextBot = nextTurnPlayer?.isBot ?? false
      const nextName = nextTurnPlayer?.username?.toUpperCase() || (isNextBot ? `AI BOT (${view.currentTurn.toUpperCase()})` : view.currentTurn.toUpperCase())
      const colorName = view.currentTurn.toUpperCase()

      retroAudio.playUiBeep(640, 0.08, 'sine')
      setTurnSwapNotice(`▶ TURN SWAP // ${nextName} [${colorName}] IS NOW IN CONTROL ◀`)

      const timer = setTimeout(() => {
        setTurnSwapNotice(null)
      }, 700)

      prevTurnRef.current = view.currentTurn
      return () => clearTimeout(timer)
    }
    prevTurnRef.current = view.currentTurn
  }, [view?.currentTurn, view?.players])

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
  const [roomCode, setRoomCode] = useState<string | null>(activeMatch?.inviteCode ?? null)

  // Fetch room code if not present in activeMatch
  useEffect(() => {
    if (!activeMatch?.gameId) return
    if (activeMatch.inviteCode) {
      setRoomCode(activeMatch.inviteCode)
      return
    }
    fetch('/api/games/mine', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((rooms: Array<{ id: string; roomCode?: string; inviteCode?: string }> | null) => {
        const room = rooms?.find((x) => x.id === activeMatch.gameId)
        if (room?.roomCode || room?.inviteCode) {
          setRoomCode(room.roomCode || room.inviteCode || null)
        }
      })
      .catch(() => undefined)
  }, [activeMatch?.gameId, activeMatch?.inviteCode])

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
      setIsRolling(false)
      isRollingRef.current = false
    })

    socket.on('game_joined', (state) => {
      dispatch({ type: 'game_joined', ...(state as object) })
    })

    const handleEngineEvent = (state: unknown) => {
      const type = (state as { type?: string }).type

      if (type === 'dice_rolled') {
        const e = state as unknown as { value: number; bonusRoll: boolean; forfeited?: boolean }
        const rollerColor = viewRef.current.currentTurn
        const roller = viewRef.current.players.find((p) => p.color === rollerColor)
        const rollerName = roller?.username || rollerColor
        retroAudio.playLaserSound()
        setIsRolling(true)
        setTimeout(() => {
          setIsRolling(false)
          isRollingRef.current = false
          dispatch({ type: 'dice_rolled', ...(state as object) })
          setDisplayedLastRolls((prev) => ({ ...prev, [rollerColor]: e.value }))
          setMoveLogs((prev) => [
            {
              ck: rollerColor,
              text: e.forfeited
                ? t('game.thirdSixForfeit', { name: rollerName })
                : `${t('game.rolledValue', { value: e.value })}${e.bonusRoll ? t('game.bonusSuffix') : ''}`,
            },
            ...prev.slice(0, 11),
          ])
        }, 750)
        return
      }

      dispatch({ type: 'state_update', ...(state as object) })

      if (type === 'piece_moved') {
        const e = state as unknown as {
          pieceId: string
          color: PlayerColor
          captured: boolean
          capturedPieceIds?: string[]
          to: number
          path: number[]
        }
        const path = e.path ?? []

        // Extract color of captured piece if a capture occurred
        let victimColor = ''
        if (e.captured) {
          if (e.capturedPieceIds && e.capturedPieceIds.length > 0) {
            victimColor = e.capturedPieceIds[0].split('-')[0].toUpperCase()
          } else {
            const victim = viewRef.current.pieces.find((p) => p.color !== e.color && p.step === e.to)
            if (victim) victimColor = victim.color.toUpperCase()
          }
          if (!victimColor) victimColor = 'OPPONENT'
        }

        // Set animatingPiece SYNCHRONOUSLY to path[0] so React batches this with dispatch({ type: 'state_update' })
        // This prevents the piece from flickering at e.to on frame 1.
        if (path.length > 0) {
          setAnimatingPiece({ pieceId: e.pieceId, step: path[0] })
        }

        const runStepAnimation = () => {
          retroAudio.playUiBeep(580, 0.06, 'sine')
          if (e.captured) {
            setMoveLogs((prev) => [
              { ck: e.color, text: t('game.capturedPiece', { color: victimColor }) },
              ...prev.slice(0, 11),
            ])
          }

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
        let endedPlayers = viewRef.current.players
          .filter((p) => p.status !== 'inactive')
          .map((p) => ({
            color: p.color, username: p.username, isBot: p.isBot, piecesInGoal: p.piecesInGoal,
          }))
        if (activeMatch?.mode === 'pvp' && activeMatch.playerCount && endedPlayers.length > activeMatch.playerCount) {
          endedPlayers = endedPlayers.slice(0, activeMatch.playerCount)
        }
        setLastResult({
          winner: e.winner,
          resultDetail: e.resultDetail,
          mode: activeMatch?.mode ?? 'pvp',
          playerCount: activeMatch?.playerCount ?? endedPlayers.length,
          players: endedPlayers,
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

    const buildAbandonedResult = () => {
      let players = viewRef.current.players
        .filter((p) => p.status !== 'inactive')
        .map((p) => ({
          color: p.color,
          username: localNames[p.color] || p.username || (p.isBot ? t('common.bot') : 'Pilot'),
          isBot: p.isBot,
          piecesInGoal: p.piecesInGoal ?? 0,
        }))

      if (players.length === 0 && Array.isArray(seats) && seats.length > 0) {
        const SEAT_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue']
        players = seats
          .map((s, idx) => {
            if (s.type === 'empty') return null
            const color = SEAT_COLORS[idx] || 'red'
            let username = 'Pilot'
            if (s.type === 'you') username = user?.username || 'You'
            else if (s.type === 'bot' || s.type === 'player') username = s.name
            return {
              color,
              username,
              isBot: s.type === 'bot',
              piecesInGoal: 0,
            }
          })
          .filter((p): p is { color: PlayerColor; username: string; isBot: boolean; piecesInGoal: number } => p !== null)
      }

      if (activeMatch?.mode === 'pvp' && activeMatch.playerCount && players.length > activeMatch.playerCount) {
        players = players.slice(0, activeMatch.playerCount)
      }

      return {
        winner: viewRef.current.winner || viewRef.current.currentTurn || 'red',
        resultDetail: 'abandoned',
        mode: activeMatch?.mode ?? 'pvp',
        playerCount: activeMatch?.playerCount ?? players.length,
        players,
        abandoned: true,
      }
    }

    socket.on('game_timeout', () => {
      setLastResult(buildAbandonedResult())
      setActiveMatch(null)
      navigate('/results')
    })
    socket.on('game_expired', () => {
      setLastResult(buildAbandonedResult())
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

    let players = viewRef.current.players
      .filter((p) => p.status !== 'inactive')
      .map((p) => ({
        color: p.color,
        username: localNames[p.color] || p.username || (p.isBot ? t('common.bot') : 'Pilot'),
        isBot: p.isBot,
        piecesInGoal: p.piecesInGoal ?? 0,
      }))

    if (players.length === 0 && Array.isArray(seats) && seats.length > 0) {
      const SEAT_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue']
      players = seats
        .map((s, idx) => {
          if (s.type === 'empty') return null
          const color = SEAT_COLORS[idx] || 'red'
          let username = 'Pilot'
          if (s.type === 'you') username = user?.username || 'You'
          else if (s.type === 'bot' || s.type === 'player') username = s.name
          return {
            color,
            username,
            isBot: s.type === 'bot',
            piecesInGoal: 0,
          }
        })
        .filter((p): p is { color: PlayerColor; username: string; isBot: boolean; piecesInGoal: number } => p !== null)
    }

    if (activeMatch?.mode === 'pvp' && activeMatch.playerCount && players.length > activeMatch.playerCount) {
      players = players.slice(0, activeMatch.playerCount)
    }

    setLastResult({
      winner: viewRef.current.winner || viewRef.current.currentTurn || 'red',
      resultDetail: 'abandoned',
      mode: activeMatch?.mode ?? 'pvp',
      playerCount: activeMatch?.playerCount ?? players.length,
      players,
      abandoned: true,
    })
    setActiveMatch(null)
    navigate('/results')
  }

  // Lock body/html scrollbars on Game page
  useEffect(() => {
    const prev = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      document.documentElement.style.overflow = prevHtml
    }
  }, [])

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
                <span>{t('game.noActiveSessionTitle')}</span>
              </div>
              <div className="window-body" style={{ textAlign: 'center', padding: '30px 24px' }}>
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
                  &gt;_ {t('game.returnToLobbyBtn')}
                </button>
              </div>
            </section>
          </div>
        </div>
      </>
    )
  }

  const isMyTurn = view.currentTurn === view.myColor
  const canRoll = isMyTurn && view.turnPhase === 'WAITING_FOR_ROLL' && !view.clash && !animatingPiece && !turnSwapNotice
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
      <div
        className={`crt-screen ${crtEnabled ? 'crt-curved' : ''}`}
        id="crtScreen"
        style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div
          className="crt-scanlines"
          id="crtOverlay"
          style={{ display: crtEnabled ? 'block' : 'none' }}
        />
        <div className="crt-flicker" />

        {/* Main Content Wrapper (Full Page Viewport with NO Left Navbar) */}
        <div
          className="app-wrapper game-page"
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
            padding: '8px 14px 10px',
          }}
        >
          {/* Hero Header & Live Turn Indicator */}
          <header className="hero-section" style={{ padding: '6px 0 14px', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <h1 className="hero-title" style={{ fontSize: '1.85rem', letterSpacing: '2px', marginBottom: 0, textAlign: 'center' }}>
                {t('game.heroTitle')}
              </h1>

              {/* Live Turn Announcement Pill & Room Code */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 22px',
                    borderRadius: 6,
                    background: isMyTurn ? 'rgba(255, 0, 127, 0.28)' : 'rgba(0, 240, 255, 0.18)',
                    border: isMyTurn ? '2px solid var(--accent-pink)' : '2px solid var(--accent-cyan)',
                    boxShadow: isMyTurn ? '0 0 18px rgba(255, 0, 127, 0.7)' : '0 0 12px rgba(0, 240, 255, 0.35)',
                    animation: isMyTurn ? 'pulse 1.6s infinite' : 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: isMyTurn ? '#ffe600' : 'var(--accent-cyan)',
                      boxShadow: isMyTurn ? '0 0 10px #ffe600' : '0 0 8px var(--accent-cyan)',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      color: isMyTurn ? '#ffe600' : '#ffffff',
                      letterSpacing: '0.8px',
                    }}
                  >
                    {turnLabel}
                  </span>
                </div>

                {roomCode && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      borderRadius: 6,
                      background: 'rgba(5, 2, 18, 0.75)',
                      border: '1.5px solid var(--accent-yellow)',
                      boxShadow: '0 0 10px rgba(255, 230, 0, 0.35)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      fontWeight: 'bold',
                      color: 'var(--accent-yellow)',
                      letterSpacing: '1px',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>ROOM:</span>
                    <span>{roomCode}</span>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Tactical Grid Layout */}
          <main
            className="dashboard-grid"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: '400px 1fr 360px',
              gap: 18,
              alignItems: 'stretch',
              width: '100%',
              overflow: 'hidden',
            }}
          >
            {/* COLUMN 1: PILOT ROSTER // TACTICAL STATUS & SYSTEM CONTROL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: '100%', height: '100%' }}>
              {/* Pilot Roster Window */}
              <section className="retro-window" id="playersWindow">
                <div className="window-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{t('game.pilotRosterTitle')}</span>
                  </div>
                  {roomCode && (
                    <div
                      style={{
                        fontSize: '0.68rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--accent-yellow)',
                        background: 'rgba(255, 230, 0, 0.12)',
                        border: '1px solid rgba(255, 230, 0, 0.4)',
                        padding: '2px 8px',
                        borderRadius: 3,
                        letterSpacing: '0.5px',
                      }}
                    >
                      CODE: {roomCode}
                    </div>
                  )}
                </div>

                <div className="window-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {t('game.seatPilotHeader')}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {t('game.lastRolled').toUpperCase()}
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
                      const isAvailable = !occupied

                      return (
                        <div
                          key={ck}
                          onClick={() => {
                            if (isAvailable && !isYou) {
                              selectColor(ck)
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 6,
                            border: isYou
                              ? `2px solid ${colorAccent}`
                              : occupied
                                ? `1px solid ${colorAccent}66`
                                : `1.5px dashed ${colorAccent}88`,
                            background: isYou
                              ? `${colorAccent}22`
                              : occupied
                                ? 'rgba(255, 255, 255, 0.04)'
                                : 'rgba(0, 0, 0, 0.3)',
                            boxShadow: isYou ? `0 0 14px ${colorAccent}66, inset 0 0 8px ${colorAccent}22` : 'none',
                            cursor: isAvailable && !isYou ? 'pointer' : 'default',
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
                                fontSize: '0.75rem',
                                color: colorAccent,
                                background: isAvailable ? `${colorAccent}15` : 'transparent',
                                border: `1px solid ${colorAccent}`,
                              }}
                            >
                              {ck.slice(0, 1).toUpperCase()}
                            </div>
                          )}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 'bold',
                                fontSize: '0.82rem',
                                color: isYou ? colorAccent : '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {isYou
                                  ? `${user?.username || 'You'} (${ck.toUpperCase()})`
                                  : occupied && playerMeta?.username
                                    ? `${playerMeta.username} (${ck.toUpperCase()})`
                                    : `[ + SELECT ${ck.toUpperCase()} ]`}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.65rem', color: isYou ? '#ffe600' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {isYou ? '▶ YOUR SELECTED SEAT' : isAvailable ? 'CLICK TO CHOOSE COLOR' : 'OCCUPIED'}
                            </div>
                          </div>

                          {occupied && (
                            <span
                              className="retro-badge"
                              style={{
                                padding: '2px 6px',
                                fontSize: '0.62rem',
                                border: isReady ? '1px solid #00ff88' : '1px solid #ff0055',
                                color: isReady ? '#00ff88' : '#ff0055',
                              }}
                            >
                              {isReady ? 'READY OK' : 'WAITING'}
                            </span>
                          )}

                          {isAvailable && !isYou && (
                            <span
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.62rem',
                                borderRadius: 3,
                                border: `1px solid ${colorAccent}`,
                                color: colorAccent,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 'bold',
                              }}
                            >
                              SELECT
                            </span>
                          )}
                        </div>
                      )
                    }

                    // Active game pilot card
                    if (!playerMeta) return null
                    const isDisconnected = playerMeta.status === 'disconnected'
                    const isHotseat = activeMatch.mode === 'hotseat'
                    const isYou = isHotseat
                      ? ck === view.myColor
                      : !playerMeta.isBot && playerMeta.username === user?.username
                    const name =
                      localNames[ck] ||
                      playerMeta.username ||
                      (playerMeta.isBot
                        ? t('common.bot')
                        : isYou
                          ? t('common.you')
                          : isHotseat
                            ? t('game.localPlayer')
                            : 'Pilot')
                    const lastRoll = displayedLastRolls[ck]

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
                            ? `1.5px solid ${colorAccent}`
                            : occupied
                              ? `1.5px solid ${colorAccent}44`
                              : '1.5px dashed rgba(255, 255, 255, 0.12)',
                          background: isActive
                            ? `var(--bg-card)`
                            : 'var(--bg-secondary)',
                          boxShadow: isActive
                            ? `0 0 20px ${colorAccent}aa, inset 0 0 12px ${colorAccent}44`
                            : 'none',
                          opacity: isDisconnected ? 0.55 : 1,
                          position: 'relative',
                          transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
                          boxSizing: 'border-box',
                        }}
                      >
                        {/* Active Turn Top-Right Badge */}
                        {isActive && (
                          <span
                            style={{
                              position: 'absolute',
                              top: -7,
                              right: 8,
                              background: colorAccent,
                              color: '#0d0221',
                              fontSize: '0.55rem',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 900,
                              padding: '1px 6px',
                              borderRadius: 3,
                              letterSpacing: '0.5px',
                              boxShadow: `0 0 10px ${colorAccent}`,
                            }}
                          >
                            ▶ IN CONTROL ◀
                          </span>
                        )}

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
                              color: 'var(--text-main)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {isActive && (
                              <span style={{ color: colorAccent, fontWeight: 'bold', fontSize: '0.75rem' }}>▶</span>
                            )}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {name}
                            </span>
                          </div>
                        </div>

                        {/* Fixed slot for MiniDie to prevent callsign layout jitter */}
                        <div style={{ width: 36, height: 28, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {lastRoll !== undefined && lastRoll > 0 && (
                            <MiniDie value={lastRoll} />
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {view.status === 'waiting' && activeMatch?.mode === 'pvp' && (
                    <div style={{ borderTop: '1px solid rgba(255, 0, 127, 0.25)', paddingTop: 10, marginTop: 4 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', marginBottom: 8, fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                        {t('game.inviteComms')}
                      </div>
                      {friends.length === 0 ? (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {t('game.noFriendsToInvite')}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto' }}>
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
                                  border: '1px solid rgba(0, 240, 255, 0.2)',
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
                                  {st === 'busy' ? '...' : st === 'sent' ? t('game.inviteSent') : `+ ${t('game.inviteBtn')}`}
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

              {/* Ready / Start Match Button */}
              {view.status === 'waiting' && (
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(() => {
                    const activeCount = view.players.filter((p) => p.status === 'active').length
                    const alreadyReady = view.readyPlayers.includes(view.myColor)
                    const soloRoom = activeCount < 2
                    const disabled = alreadyReady || soloRoom
                    return (
                      <button
                        className="retro-btn"
                        onClick={() => {
                          retroAudio.playUiBeep(1100, 0.1)
                          socketRef.current?.emit('player_ready')
                        }}
                        disabled={disabled}
                        style={{
                          width: '100%',
                          padding: '14px 0',
                          fontSize: '0.85rem',
                          fontFamily: 'var(--font-heading)',
                          letterSpacing: '1px',
                          background: alreadyReady ? 'rgba(0, 255, 136, 0.22)' : 'var(--btn-bg)',
                          borderColor: alreadyReady ? '#00ff88' : 'var(--accent-pink)',
                          color: alreadyReady ? '#00ff88' : '#ffffff',
                          boxShadow: alreadyReady ? '0 0 16px rgba(0, 255, 136, 0.4)' : '0 0 15px var(--accent-pink)',
                          opacity: disabled ? 0.6 : 1,
                          cursor: disabled ? 'default' : 'pointer',
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 10,
                        }}
                      >
                        <span>{alreadyReady ? `[${t('game.readyBadge').toUpperCase()}]` : soloRoom ? t('game.readyNeedsOpponent') : 'READY'}</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.85, fontFamily: 'var(--font-mono)' }}>
                          ({view.readyPlayers.length}/{activeCount})
                        </span>
                      </button>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* COLUMN 2: QUANTUM LUDO MATRIX / BOARD */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                minHeight: 0,
                minWidth: 0,
              }}
            >
              {(() => {
                const currentTurnPlayer = view.players.find((p) => p.color === view.currentTurn)
                const isBotTurn = currentTurnPlayer?.isBot ?? false
                const activeLegalMoves = isRolling || isBotTurn ? [] : view.legalMoves

                return (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      maxHeight: 'calc(100vh - 130px)',
                      maxWidth: 'min(100%, calc(100vh - 130px))',
                      aspectRatio: '1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: 'auto',
                    }}
                  >
                    <Board
                      pieces={view.pieces}
                      players={view.players}
                      legalMoves={activeLegalMoves}
                      onPieceClick={isRolling || isBotTurn ? () => { } : movePiece}
                      animating={animatingPiece}
                      fx={captureFx}
                    />
                  </div>
                )
              })()}
            </div>

            {/* COLUMN 3: TACTICAL CONTROLS & LOGS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: '100%' }}>
              {/* IN-GAME DICE CONTROLS WINDOW */}
              <section className="retro-window" id="diceControlWindow">
                  <div className="window-header">
                    <span>{t('game.diceSystemTitle')}</span>
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
                    {/* Active Turn Pilot Banner */}
                    {(() => {
                      const activeTurnPlayer = view.players.find((p) => p.color === view.currentTurn)
                      const isBot = activeTurnPlayer?.isBot ?? false
                      const activeName = activeTurnPlayer?.username?.toUpperCase() || (isBot ? `AI BOT (${view.currentTurn.toUpperCase()})` : view.currentTurn.toUpperCase())
                      const turnColorHex = SEAT_HUES[view.currentTurn] || '#00f0ff'

                      return (
                        <div
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            background: isMyTurn ? 'rgba(255, 0, 127, 0.2)' : `${turnColorHex}18`,
                            border: isMyTurn ? '1.5px solid var(--accent-pink)' : `1.5px solid ${turnColorHex}`,
                            boxShadow: isMyTurn ? '0 0 12px rgba(255, 0, 127, 0.5)' : `0 0 8px ${turnColorHex}44`,
                            borderRadius: 4,
                            textAlign: 'center',
                            fontSize: '0.74rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 'bold',
                            color: '#ffffff',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {isMyTurn
                            ? `▶ ${t('game.yourTurn').toUpperCase()} ◀`
                            : `▶ ${t('game.botTurn', { name: activeName }).toUpperCase()} ◀`}
                        </div>
                      )
                    })()}

                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.72rem',
                        color: isMyTurn ? '#ffe600' : 'var(--text-muted)',
                      }}
                    >
                      {isRolling
                        ? t('game.statusRolling')
                        : canRoll
                          ? t('game.statusRollNow')
                          : view.turnPhase === 'WAITING_FOR_MOVE'
                            ? t('game.statusSelectPiece')
                            : t('game.statusRivalTurn', { name: view.currentTurn.toUpperCase() })}
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
                        fontFamily: 'var(--font-heading)',
                        letterSpacing: '1px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        background: canRoll && !isRolling ? 'var(--btn-bg)' : 'rgba(25, 10, 56, 0.5)',
                        borderColor: canRoll && !isRolling ? 'var(--accent-pink)' : 'rgba(255, 255, 255, 0.2)',
                        boxShadow: canRoll && !isRolling ? '0 0 15px var(--accent-pink)' : 'none',
                        cursor: canRoll && !isRolling ? 'pointer' : 'default',
                        opacity: canRoll && !isRolling ? 1 : 0.5,
                        boxSizing: 'border-box',
                      }}
                    >
                      {isRolling ? t('game.rolling').toUpperCase() : t('game.rollDiceBtn')}
                    </button>

                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        color: 'var(--accent-cyan)',
                        textAlign: 'center',
                      }}
                    >
                      [ {t('game.spaceToRoll')} ]
                    </div>
                  </div>
              </section>

              {/* Arena System Control & Sector Specs */}
              <section className="retro-window" id="sectorControlWindow">
                <div className="window-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{t('game.systemControlTitle')}</span>
                  </div>
                </div>

                <div className="window-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 14px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                    {t('game.combatKeybindsRules')}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>DICE ROLL:</span>
                      <span style={{ color: '#fff', fontFamily: 'var(--font-mono)', background: 'rgba(0, 240, 255, 0.15)', padding: '2px 6px', borderRadius: 3, border: '1px solid var(--accent-cyan)' }}>{t('game.spaceToRoll')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>SELECT PIECE:</span>
                      <span style={{ color: '#fff', fontFamily: 'var(--font-mono)', background: 'rgba(255, 0, 127, 0.15)', padding: '2px 6px', borderRadius: 3, border: '1px solid var(--accent-pink)' }}>LEFT CLICK</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{t('game.victoryGoal')}</span>
                      <span style={{ color: '#ffe600', fontFamily: 'var(--font-mono)' }}>{t('game.fourPiecesGoal')}</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />

                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                    {t('game.audioPreferences')}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                    <button
                      className="retro-badge"
                      style={{
                        cursor: 'pointer',
                        padding: '8px 10px',
                        background: soundMuted ? 'rgba(255, 0, 85, 0.12)' : 'rgba(0, 255, 136, 0.12)',
                        border: soundMuted ? '1px solid #ff0055' : '1px solid #00ff88',
                        color: soundMuted ? '#ff0055' : '#00ff88',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        textAlign: 'center',
                        justifyContent: 'center',
                      }}
                      onClick={toggleSound}
                    >
                      {soundMuted ? t('game.audioOff') : t('game.audioOn')}
                    </button>
                  </div>
                </div>
              </section>

              {/* MISSION TELEMETRY LOG WINDOW */}
              <section className="retro-window" id="moveLogWindow" style={{ height: 180, maxHeight: 180, flex: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="window-header" style={{ flex: 'none' }}>
                  <span>{t('game.reconLogsTitle')}</span>
                </div>

                <div
                  ref={moveLogContainerRef}
                  className="window-body"
                  style={{
                    flex: 1,
                    height: '100%',
                    maxHeight: '100%',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '10px 12px',
                    background: 'rgba(5, 2, 15, 0.75)',
                    boxSizing: 'border-box',
                  }}
                >
                  {moveLogs.length === 0 ? (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {t('game.noReconLogged')}
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

              {/* RETURN TO LOBBY BUTTON (Only for online PvP matches) */}
              {activeMatch?.mode !== 'pve' && activeMatch?.mode !== 'hotseat' && (
                <CyberButton
                  label={t('game.returnToLobbyBtn')}
                  shortcut="<"
                  variant="cyan"
                  onClick={() => {
                    retroAudio.playUiBeep(440, 0.05)
                    navigate('/gamelobby')
                  }}
                  style={{ width: '100%', justifyContent: 'center' }}
                />
              )}

              {/* ABORT MISSION / END GAME BUTTON */}
              {(() => {
                const isBotOrHotseat = activeMatch?.mode === 'pve' || activeMatch?.mode === 'hotseat'
                return (
                  <CyberButton
                    label={isBotOrHotseat ? 'ABORT SIMULATION' : t('game.abortMatchBtn')}
                    shortcut="ESC"
                    variant="danger"
                    onClick={() => setIsAbortModalOpen(true)}
                    style={{ width: '100%', justifyContent: 'center' }}
                  />
                )
              })()}

            </div>
          </main>
        </div>
      </div>

      {/* Cyberpunk Glitch Confirmation Modal */}
      <CyberModal
        isOpen={isAbortModalOpen}
        title="PROTOCOL TERMINATION"
        versionTag={activeMatch?.gameId ? `ARENA.${activeMatch.gameId.slice(0, 8)}` : 'v001.e1349837856'}
        message={
          activeMatch?.mode === 'pve' || activeMatch?.mode === 'hotseat'
            ? 'You are about to terminate this tactical simulation. Combat records for this session will be halted.'
            : 'You are about to withdraw and forfeit this ranked arena match. Match telemetry will be finalized as a defeat.'
        }
        subMessage="Do you want to confirm protocol abort?"
        onCancel={() => setIsAbortModalOpen(false)}
        onProceed={() => {
          setIsAbortModalOpen(false)
          endGame()
        }}
        cancelLabel="CANCEL"
        proceedLabel="CONFIRM ABORT"
        cancelShortcut="ESC"
        proceedShortcut="↵"
        isDanger
      />

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
