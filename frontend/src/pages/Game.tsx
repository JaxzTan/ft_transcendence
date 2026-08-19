import { useEffect, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Board } from '../components/Board'
import { Die } from '../components/Die'
import { RulesModal } from '../components/RulesModal'
import { ClashOverlay } from '../game/ClashOverlay'
import { applyEvent, initialView } from '../game/reducer'
import type { PlayerColor } from '../game/types'
import { navigate } from '../router'
import { connectSocket } from '../socket'
import { getApi, postApi } from '../api'
import { RULES_ON_START_KEY, useApp } from '../store'
import { COL, SEAT_COLORS, btnGold, card, sectionLabel } from '../theme'
import { UserAvatar } from '../components/UserAvatar'

function Pips({ count, color }: { count: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i < count ? color : 'transparent',
            border: '1.5px solid ' + (i < count ? color : '#4a3826'),
            boxSizing: 'border-box',
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
function MiniDie({ value, rolling }: { value: number; rolling?: boolean }) {
  const on = MINI_PIP_MAP[value] || []
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 11,
        background: 'linear-gradient(150deg,#fbf5e6,#e4d8bf)',
        boxShadow: 'inset 0 1px 2px rgba(255,255,255,.8),inset 0 -2px 3px rgba(140,120,80,.35),0 2px 4px rgba(0,0,0,.45)',
        border: '1px solid #cbb99a',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr 1fr',
        padding: 4,
        gap: 2,
        flex: 'none',
        animation: rolling ? 'shake .3s ease-in-out infinite' : 'none',
      }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{ display: 'grid', placeItems: 'center' }}>
          {on.includes(i) ? (
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%,#5a4a2e,#241a0c)',
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
  const { user, activeMatch, seats, setPlaying, setLastResult, setActiveMatch, settingOn } = useApp()

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
  // Mirrors `canRoll` (computed further down, from displayTurn) for the
  // spacebar shortcut's mount-once effect — see canRoll's assignment below.
  const canRollRef = useRef(false)
  const [connected, setConnected] = useState(false)
  const [moveLogs, setMoveLogs] = useState<Array<{ ck: PlayerColor; text: string }>>([])
  const [isRolling, setIsRolling] = useState(false)
  const isRollingRef = useRef(false)
  // Color of whichever player's die is currently mid-spin — drives the shake
  // on both the big "your roll" Die and that player's sidebar MiniDie, for
  // your own rolls AND opponent/bot rolls alike (same event path for all
  // three modes: hotseat, pve, pvp — see handleDiceRolled below).
  const [rollingColor, setRollingColor] = useState<PlayerColor | null>(null)
  const diceSpinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Bots keep the original quick spin; human rollers (including opponents in
  // pvp/hotseat) get a longer, more readable spin.
  const DICE_SPIN_BOT_MS = 500
  const DICE_SPIN_HUMAN_MS = 1000
  const [codeCopied, setCodeCopied] = useState(false)
  // Box-by-box move animation: while set, Board renders this piece at `step`
  // instead of its real (already-updated) logical position — see the
  // piece_moved handler below, which steps through the server's `path`.
  const [animatingPiece, setAnimatingPiece] = useState<{ pieceId: string; step: number } | null>(null)
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const STEP_ANIM_MS = 220
  // Capture burst FX: a short cosmetic ring + sparks on the landing square
  // when a piece is captured. Set at the end of the mover's walk, cleared
  // after the burst plays out — purely visual, no game state involved.
  const [captureFx, setCaptureFx] = useState<{ color: string; to: number } | null>(null)
  const captureFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ghost render of the eaten piece(s): board state already reflects the
  // capture the instant the event arrives, so without this the eaten piece
  // just vanishes before the mover visually gets there. Keep it drawn at its
  // pre-capture cell, then pop it out in sync with the capture burst FX below.
  const [fadingPieces, setFadingPieces] = useState<Array<{ id: string; ck: PlayerColor; step: number; popping: boolean }>>([])
  // Friend-invite picker (waiting room, PvP only): lets the host invite an
  // accepted friend into THIS room (POST /api/game/:id/invite).
  const [friends, setFriends] = useState<Array<{ id: string; username: string }>>([])
  const [inviteStates, setInviteStates] = useState<Record<string, 'idle' | 'busy' | 'sent'>>({})
  // Turn indicator/controls lag the real turn so a turn change reads as a
  // beat instead of an instant snap when the previous player finishes. Bots
  // keep the original beat; a turn landing on a human gets a longer, more
  // readable one.
  const TURN_CHANGE_DELAY_BOT_MS = 500
  const TURN_CHANGE_DELAY_HUMAN_MS = 1000
  const [displayTurn, setDisplayTurn] = useState(view.currentTurn)
  useEffect(() => {
    if (displayTurn === view.currentTurn) return
    const nextPlayer = view.players.find((p) => p.color === view.currentTurn)
    const delay = nextPlayer?.isBot ? TURN_CHANGE_DELAY_BOT_MS : TURN_CHANGE_DELAY_HUMAN_MS
    const timer = setTimeout(() => setDisplayTurn(view.currentTurn), delay)
    return () => clearTimeout(timer)
  }, [view.currentTurn, displayTurn, view.players])

  // Auto-pop the rules once per match, right as it goes active, if the
  // Lobby's Rules toggle was on when this match was created. Keyed off
  // gameId (not a plain "have we shown it" boolean) so navigating between
  // matches in the same session shows it again for each new one.
  const [rulesOpen, setRulesOpen] = useState(false)
  const rulesShownForGameRef = useRef<string | null>(null)
  useEffect(() => {
    if (view.status !== 'active') return
    if (!settingOn(RULES_ON_START_KEY)) return
    if (rulesShownForGameRef.current === activeMatch?.gameId) return
    rulesShownForGameRef.current = activeMatch?.gameId ?? null
    setRulesOpen(true)
  }, [view.status, activeMatch?.gameId, settingOn])

  const copyRoomCode = () => {
    if (!activeMatch?.inviteCode) return
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
      // for every local color up front (else an un-joined seat stays 'inactive'
      // forever and advanceTurnInState skips it, effectively stranding the
      // game on whoever joined first). Join the others first, own color last,
      // so socket.data.playerColor (server-side move/roll authorization,
      // overwritten by each join_game call) ends up on blue — the color that
      // actually goes first.
      if (activeMatch.mode === 'hotseat') {
        for (const ck of Object.keys(localNames) as PlayerColor[]) {
          socket.emit('join_game', activeMatch.gameId, ck, undefined, localNames[ck])
        }
      }
      socket.emit('join_game', activeMatch.gameId, activeMatch.color)
      // Socket.IO re-fires 'connect' on every reconnect, so this also covers
      // rejoining after a drop; if a clash was frozen mid-QTE, resume it too.
      if (viewRef.current.clash) socket.emit('reconnect_clash')
    })

    socket.on('connect_error', (err: Error) => {
      console.error('[socket] connect_error', err.message)
    })

    socket.on('disconnect', () => {
      setConnected(false)
      setIsRolling(false)
      isRollingRef.current = false
      setRollingColor(null)
      if (diceSpinTimerRef.current) {
        clearTimeout(diceSpinTimerRef.current)
        diceSpinTimerRef.current = null
      }
    })

    socket.on('game_joined', (state) => {
      dispatch({ type: 'game_joined', ...(state as object) })
    })

    // The engine publishes events through Redis pub/sub, and redis-broadcaster.ts
    // now forwards each one under its own Socket.IO event name (e.g. `dice_rolled`,
    // `piece_moved`, `game_started`, `game_ended`, `player_exited`, `clash_start`,
    // `clash_result`, `clash_frozen`, `lobby_update`). We register a single
    // `handleEngineEvent` on all of those names (plus `state_update` for safety).
    // Every payload carries its own `type`; spreading it after the literal
    // 'state_update' below lets it win, so the reducer still resolves the correct
    // case. Side effects for each type live here too.
    // Dice rolls get a dedicated handler (not routed through handleEngineEvent
    // below) so the die can hold a guaranteed minimum spin — otherwise a fast
    // round-trip (or a same-tab bot roll) applies the new value/log line
    // instantly with no visible animation. The game-state dispatch itself is
    // NOT delayed for this (see below): a bot can resolve its own roll ->
    // move in under a millisecond, and delaying the dice_rolled dispatch let
    // a fast-following piece_moved (dispatched immediately, already carrying
    // the correct advanced turn) get overwritten by this roll's now-stale
    // snapshot once the delay timer finally fired — permanently freezing the
    // turn indicator on the wrong player. Capturing `roller` synchronously
    // off viewRef, before any dispatch, matches how the reducer's own
    // dice_rolled case resolves the roller (see reducer.ts comment).
    const handleDiceRolled = (state: unknown) => {
      const roller = viewRef.current.currentTurn
      dispatch({ type: 'state_update', ...(state as object) })

      const e = state as unknown as { value: number; bonusRoll: boolean; forfeited?: boolean }
      const rollerMeta = viewRef.current.players.find((p) => p.color === roller)
      setMoveLogs((prev) => [
        {
          ck: roller,
          text: e.forfeited
            ? t('game.thirdSixForfeit', { name: rollerMeta?.username || roller })
            : `${t('game.rolledValue', { value: e.value })}${e.bonusRoll ? t('game.bonusSuffix') : ''}`,
        },
        ...prev.slice(0, 7),
      ])

      // Cosmetic-only from here on: hold the shake for a guaranteed minimum
      // duration. Guarded by roller so a stale timer from an earlier roll
      // can never clear a newer roll's spin — but even if it raced, all it
      // could ever affect is the shake animation, never game state.
      setRollingColor(roller)
      if (diceSpinTimerRef.current) clearTimeout(diceSpinTimerRef.current)
      const spinMs = rollerMeta?.isBot ? DICE_SPIN_BOT_MS : DICE_SPIN_HUMAN_MS
      diceSpinTimerRef.current = setTimeout(() => {
        diceSpinTimerRef.current = null
        setRollingColor((cur) => (cur === roller ? null : cur))
        setIsRolling(false)
        isRollingRef.current = false
      }, spinMs)
    }

    const handleEngineEvent = (state: unknown) => {
      const type = (state as { type?: string }).type

      // Snapshot captured pieces' pre-move cells BEFORE dispatching — the
      // dispatch below applies the engine's already-final state (captured
      // piece back in base), so viewRef.current.pieces is our last chance to
      // see where they were standing.
      if (type === 'piece_moved') {
        const e = state as unknown as { capturedPieceIds?: string[] }
        const captured = (e.capturedPieceIds ?? [])
          .map((id) => viewRef.current.pieces.find((p) => p.id === id))
          .filter((p): p is NonNullable<typeof p> => !!p)
          .map((p) => ({ id: p.id, ck: p.color as PlayerColor, step: p.step, popping: false }))
        if (captured.length > 0) setFadingPieces(captured)
      }

      dispatch({ type: 'state_update', ...(state as object) })

      if (type === 'piece_moved') {
        const e = state as unknown as { pieceId: string; color: PlayerColor; captured: boolean; to: number; path: number[] }
        setMoveLogs((prev) => [
          { ck: e.color, text: e.captured ? t('game.capturedPiece', { to: e.to }) : t('game.movedPiece', { to: e.to }) },
          ...prev.slice(0, 7),
        ])
        // Board state (turn, legal moves, captures) already reflects the final
        // move above — this only walks the *visual* piece through the server's
        // path box by box instead of snapping straight to the destination.
        if (animTimerRef.current) clearInterval(animTimerRef.current)
        const path = e.path ?? []
        if (path.length > 0) {
          let i = 0
          setAnimatingPiece({ pieceId: e.pieceId, step: path[0] })
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
        }
        // Capture/goal burst: show the ring/sparks exactly when the mover
        // visually arrives (mirrors the server's own bot pacing math), then
        // auto-clear. Goal entry (piece reaches step 57, the center
        // triangle) gets the same celebratory burst as a capture does.
        if (e.captured || e.to === 57) {
          if (captureFxTimerRef.current) clearTimeout(captureFxTimerRef.current)
          captureFxTimerRef.current = setTimeout(() => {
            setCaptureFx({ color: e.color, to: e.to })
            if (e.captured) {
              setFadingPieces((prev) => prev.map((f) => ({ ...f, popping: true })))
              setTimeout(() => setFadingPieces([]), 320)
            }
            setTimeout(() => setCaptureFx(null), 600)
          }, path.length * STEP_ANIM_MS)
        }
      } else if (type === 'lobby_update') {
        // If a color swap moved *my* seat, resync the socket's own notion of
        // playerColor by re-joining with the new color (server derives move/roll
        // authorization from socket.data.playerColor, set once at join_game time).
        const e = state as unknown as { players: Array<{ username: string; color: PlayerColor }> }
        const mine = e.players.find((p) => p.username === user?.username)
        if (mine && mine.color !== viewRef.current.myColor) {
          dispatch({ type: 'my_color_changed', color: mine.color })
          socket.emit('join_game', activeMatch.gameId, mine.color)
          // Persist the swap so a refresh/rejoin re-joins with the color the
          // player actually picked, not the one assigned when the match was
          // created (activeMatch is what seeds initialView() and the
          // post-reconnect join_game call — see below).
          setActiveMatch({ ...activeMatch, color: mine.color })
        }
      } else if (type === 'game_ended') {
        const e = state as unknown as { winner: PlayerColor; resultDetail: string }
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
    socket.on('dice_rolled', handleDiceRolled)
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

    // Another PvP player pressed End Game — log a translatable line.
    socket.on('player_aborted', (e: { color: PlayerColor; username: string }) => {
      setMoveLogs((prev) => [
        { ck: e.color, text: t('game.playerAborted', { name: e.username }) },
        ...prev.slice(0, 7),
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
      if (diceSpinTimerRef.current) clearTimeout(diceSpinTimerRef.current)
      diceSpinTimerRef.current = null
      setAnimatingPiece(null)
      setCaptureFx(null)
      setFadingPieces([])
    }
  }, [activeMatch, setLastResult])

  // Hotseat: keep the single socket's server-side authorization (playerColor)
  // pointed at whoever's turn it currently is, so the same device can roll for
  // every local seat in turn. Re-emitting join_game is the only way to update
  // that — see the eager multi-join above for why the same mechanism applies.
  useEffect(() => {
    if (!activeMatch || activeMatch.mode !== 'hotseat') return
    if (view.status !== 'active' || view.currentTurn === viewRef.current.myColor) return
    const seat = viewRef.current.players.find((p) => p.color === view.currentTurn)
    if (!seat || seat.isBot || seat.status !== 'active') return
    dispatch({ type: 'my_color_changed', color: view.currentTurn })
    socketRef.current?.emit('join_game', activeMatch.gameId, view.currentTurn, undefined, localNames[view.currentTurn])
  }, [view.currentTurn, view.status, activeMatch])

  // Spacebar = roll dice (alternative to the Roll button). Guarded by the
  // exact same gate as the button (canRollRef, mirroring canRoll) plus an
  // input-field check so typing in a text box never rolls. Idempotent: a
  // second press while a roll is in flight is ignored.
  //
  // Deliberately keyed off canRoll/displayTurn rather than the raw
  // view.currentTurn: displayTurn lags the real turn by a beat (see
  // TURN_CHANGE_DELAY_* above) so the turn change reads as a beat instead of
  // an instant snap. Gating on the raw currentTurn let spacebar jump the gun
  // and start rolling before that beat finished — before the turn indicator
  // even said it was your turn yet — while the button correctly stayed
  // disabled for that same window. This keeps both input paths in sync.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (!canRollRef.current) return
      if (isRollingRef.current) return
      e.preventDefault()
      isRollingRef.current = true
      setIsRolling(true)
      setRollingColor(viewRef.current.myColor)
      socketRef.current?.emit('roll_dice')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const rollDice = () => {
    if (!canRoll || isRolling || isRollingRef.current) return
    isRollingRef.current = true
    setIsRolling(true)
    setRollingColor(view.myColor)
    socketRef.current?.emit('roll_dice')
  }
  // Target-piece selection is locked out until the die has fully stopped
  // spinning (rollingColor cleared) — applies uniformly whether the roll
  // belongs to the human player or a bot, since rollingColor is set for
  // whichever color just rolled either way (see handleDiceRolled above).
  const movePiece = (pieceId: string) => {
    if (rollingColor !== null) return
    socketRef.current?.emit('move_piece', pieceId)
  }
  const markReady = () => socketRef.current?.emit('player_ready')
  const selectColor = (color: PlayerColor) => socketRef.current?.emit('select_color', color)
  const clashInput = (key: string) => socketRef.current?.emit('clash_input', key)
  const clearClash = () => dispatch({ type: 'clash_clear' })

  const inviteFriend = async (friendId: string) => {
    if (!activeMatch || inviteStates[friendId] === 'busy') return
    setInviteStates((prev) => ({ ...prev, [friendId]: 'busy' }))
    try {
      await postApi(`/api/game/${activeMatch.gameId}/invite`, { friendId })
      setInviteStates((prev) => ({ ...prev, [friendId]: 'sent' }))
    } catch {
      setInviteStates((prev) => ({ ...prev, [friendId]: 'idle' }))
    }
  }

  // "Go to Lobby" is PURE navigation: it leaves the game screen but does NOT
  // mutate the engine state. The unmount socket.disconnect() puts the human in
  // the grace/pause path (seat preserved) — Resume Last Game reconnects the
  // exact same turn state. Definitive exit is only via End Game / end_game.
  const leaveGame = () => {
    navigate('/lobby')
  }

  // "End Game" definitively terminates the match for this player. Emits the
  // engine's end_game event: bot-mode games are aborted + wiped (unreachable
  // via Resume); PvP prunes just this seat and the game continues if >= 2
  // humans remain. No result is posted for aborted games, and the match is
  // cleared so Resume Last Game can never resurrect it.
  const endGame = () => {
    socketRef.current?.emit('end_game')
    // Abandoned outcome: no result is posted for aborts, so the quitter gets
    // the "Game Abandoned" card (no rating change) instead of a silent kick.
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
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#12100a', color: '#f0e2c4' }}>
        <div style={{ ...card, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>No active match found</div>
          <div style={{ color: '#a99a83', marginBottom: 20 }}>Please set up a game from the lobby first.</div>
          <button onClick={() => navigate('/lobby')} style={{ ...btnGold, padding: '12px 24px' }}>
            Go to Lobby
          </button>
        </div>
      </div>
    )
  }

  const isMyTurn = displayTurn === view.myColor
  const canRoll = isMyTurn && view.turnPhase === 'WAITING_FOR_ROLL' && !view.clash && !animatingPiece
  // Keep the spacebar shortcut in sync with the Roll button's own gate —
  // it's declared in a mount-once effect below, so it reads this via a ref
  // rather than closing over the (stale, first-render) canRoll value.
  canRollRef.current = canRoll
  const turnLabel = view.status === 'waiting'
    ? t('game.waitingRoomTitle')
    : isMyTurn ? t('game.yourTurnShort') : `${displayTurn.toUpperCase()}'s turn`

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 30px', borderBottom: '1px solid #2e2115' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            onClick={leaveGame}
            style={{
              cursor: 'pointer', padding: '9px 16px', borderRadius: 10, border: '1px solid #3a2c1d',
              background: '#1a130d', fontSize: 13, fontWeight: 700, color: '#c9bda3',
            }}
          >
            ← {t('game.goToLobby')}
          </div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 18, color: '#f4e9cf' }}>
            {t('game.modePlayerCasual', { mode: view.players.length || 2 })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#a99a83' }}>
            {activeMatch.inviteCode && (
              <>
                <span style={{ fontWeight: 800, letterSpacing: '.1em', color: '#c9bda3' }}>
                  {t('game.roomCode')} {activeMatch.inviteCode}
                </span>
                <div
                  onClick={copyRoomCode}
                  title={t('game.copyRoomCode')}
                  style={{
                    cursor: 'pointer', padding: '3px 9px', borderRadius: 7, border: '1px solid #3a2c1d',
                    background: codeCopied ? '#22432f' : '#140e0b', fontSize: 11, fontWeight: 700,
                    color: codeCopied ? '#5fd08a' : '#c9bda3',
                  }}
                >
                  {codeCopied ? t('game.copiedBtn') : t('game.copyBtn')}
                </div>
              </>
            )}
            <span style={{ fontSize: 11, color: connected ? '#5fd08a' : '#e05050' }}>
              {connected ? '● Live' : '● Connecting…'}
            </span>
          </div>
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 999,
            background: '#22432f', border: '1px solid #2e4a38', fontWeight: 700, fontSize: '13.5px', color: '#dff0e0',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5fd08a' }} />
          {turnLabel}
        </div>
      </header>

      <div
        style={{
          flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr 280px', gap: 24, padding: '26px 30px',
          alignItems: 'start', maxWidth: 1300, margin: '0 auto', width: '100%',
        }}
      >
        {/* Players sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Sidebar header: Players label + "Last Rolled" column header, aligned over the dice column */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12 }}>
            <div style={{ ...sectionLabel, color: '#a99a83' }}>{t('lobby.players')}</div>
            <div style={{ ...sectionLabel, color: '#a99a83', fontSize: 10 }}>{t('game.lastRolled')}</div>
          </div>
          {SEAT_COLORS.map((ck) => {
            const col = COL[ck]
            const playerMeta = view.players.find((p) => p.color === ck)
            const occupied = playerMeta && (view.status !== 'waiting' || playerMeta.status === 'active')
            const isActive = displayTurn === ck

            if (view.status === 'waiting') {
              const isYou = ck === view.myColor
              const isReady = view.readyPlayers.includes(ck)
              return (
                <div
                  key={ck}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: 12, borderRadius: 13,
                    border: '1px solid ' + (isYou ? col.base : '#3a2c1d'),
                    background: occupied ? 'linear-gradient(180deg,#241b13,#1a130d)' : 'rgba(255,255,255,.02)',
                    opacity: occupied ? 1 : 0.55,
                  }}
                >
                  {occupied && playerMeta?.username ? (
                    <UserAvatar
                      username={playerMeta.username}
                      size={38}
                      fallbackStyle={{
                        width: 38, height: 38, flex: 'none', borderRadius: 10, display: 'grid', placeItems: 'center',
                        fontWeight: 800, fontSize: 13, color: '#12100a',
                        background: `linear-gradient(180deg,${col.base},${col.dark})`,
                      }}
                      style={{ borderRadius: 10 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 38, height: 38, flex: 'none', borderRadius: 10, display: 'grid', placeItems: 'center',
                        fontWeight: 800, fontSize: 13, color: '#12100a',
                        background: 'transparent',
                        border: `1.5px dashed ${col.base}88`,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: occupied ? '#f0e2c4' : '#8a7c66' }}>
                      {occupied ? playerMeta!.username : t('game.emptySeat')}
                    </div>
                    <div style={{ color: '#a99a83', fontSize: 12 }}>{isYou ? t('common.you') : ck}</div>
                  </div>
                  {occupied && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: isReady ? '#5fd08a' : '#a99a83' }}>
                      {isReady ? `✓ ${t('game.readyBadge')}` : t('game.notReadyBadge')}
                    </span>
                  )}
                </div>
              )
            }

            // active = full row, disconnected = dimmed "Reconnecting…", exited =
            // removed from the roster (matches the board, whose pieces are gone).
            if (!playerMeta || playerMeta.status === 'exited' || playerMeta.status === 'inactive') return null
            const isDisconnected = playerMeta.status === 'disconnected'
            const isHotseat = activeMatch.mode === 'hotseat'
            // Hotseat: every seat is controlled by the same device, so "isYou"
            // means "whoever's turn this device is currently authorized to
            // play" (view.myColor) rather than a username match — the other
            // local seat has its own typed-in name (see localNames) but still
            // isn't a separate real account.
            const isYou = isHotseat ? ck === view.myColor : !playerMeta.isBot && playerMeta.username === user?.username
            const name = playerMeta.username
            const sub = isDisconnected ? t('game.reconnecting') : playerMeta.isBot ? t('common.bot') : isYou ? t('common.you') : isHotseat ? t('game.localPlayer') : 'Player'
            const goalCount = playerMeta.piecesInGoal ?? 0
            const lastRoll = view.lastRolls[ck]

            return (
              <div
                key={ck}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: 12, borderRadius: 13,
                  border: '1px solid ' + (isActive ? col.base : '#3a2c1d'),
                  background: isActive ? `linear-gradient(180deg,${col.base}22,#1a130d)` : 'linear-gradient(180deg,#241b13,#1a130d)',
                  boxShadow: isActive ? `0 0 0 1px ${col.base}55` : 'none',
                  opacity: isDisconnected ? 0.55 : 1,
                }}
              >
                {!playerMeta.isBot && !isHotseat ? (
                  <UserAvatar
                    username={name}
                    size={38}
                    fallbackStyle={{
                      width: 38, height: 38, flex: 'none', borderRadius: 10, display: 'grid', placeItems: 'center',
                      fontWeight: 800, fontSize: 13, color: '#12100a', background: `linear-gradient(180deg,${col.base},${col.dark})`,
                    }}
                    style={{ borderRadius: 10 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 38, height: 38, flex: 'none', borderRadius: 10, display: 'grid', placeItems: 'center',
                      fontWeight: 800, fontSize: 13, color: '#12100a', background: `linear-gradient(180deg,${col.base},${col.dark})`,
                    }}
                  >
                    {name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#f0e2c4' }}>{name}</div>
                  <div style={{ color: '#a99a83', fontSize: 12 }}>{sub}</div>
                </div>
                <Pips count={goalCount} color={col.base} />
                {/* Last Rolled column — fixed right edge, aligns under the sidebar header */}
                <div style={{ flex: 'none' }}>
                  {lastRoll ? (
                    <MiniDie value={lastRoll} rolling={rollingColor === ck} />
                  ) : rollingColor === ck ? (
                    <MiniDie value={1} rolling />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 11, border: '1px dashed #4a3826', display: 'grid', placeItems: 'center', color: '#8a7c66', fontSize: 14, flex: 'none' }}>–</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Board */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: '100%', maxWidth: 540, padding: 16, borderRadius: 20,
              background: 'linear-gradient(145deg,#3a2a1a,#241811)',
              boxShadow: '0 34px 66px -26px #000,inset 0 2px 0 rgba(255,255,255,.06)',
              border: '1px solid #4a3826',
            }}
          >
            <Board pieces={view.pieces} players={view.players} legalMoves={rollingColor ? [] : view.legalMoves} onPieceClick={movePiece} animating={animatingPiece} fx={captureFx} fading={fadingPieces} />
          </div>
        </div>

        {/* Controls sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {view.status === 'waiting' ? (
            <div style={{ ...card, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={sectionLabel}>{t('game.waitingRoomTitle')}</div>

              <div>
                <div style={{ fontSize: 12.5, color: '#a99a83', marginBottom: 8 }}>{t('game.chooseColor')}</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {SEAT_COLORS.slice(0, activeMatch?.playerCount ?? 4).map((ck) => {
                    const col = COL[ck]
                    const takenByOther = view.players.some((p) => p.color === ck && p.status === 'active' && ck !== view.myColor)
                    return (
                      <div
                        key={ck}
                        onClick={() => selectColor(ck)}
                        title={ck}
                        style={{
                          width: 34, height: 34, borderRadius: 10, cursor: 'pointer',
                          background: `linear-gradient(180deg,${col.base},${col.dark})`,
                          border: ck === view.myColor ? '2px solid #f0e2c4' : '2px solid transparent',
                          boxShadow: ck === view.myColor ? `0 0 0 2px ${col.base}` : 'none',
                          opacity: takenByOther ? 0.55 : 1,
                        }}
                      />
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
                    onClick={markReady}
                    disabled={disabled}
                    style={{
                      ...btnGold, width: '100%', padding: 14,
                      opacity: disabled ? 0.6 : 1,
                      cursor: disabled ? 'default' : 'pointer',
                    }}
                  >
                    {alreadyReady ? t('game.readyWaitingBtn') : soloRoom ? t('game.readyNeedsOpponent') : t('game.readyBtn')}
                  </button>
                )
              })()}

              <div style={{ fontSize: 13, color: '#5fd08a', textAlign: 'center' }}>
                {t('game.readyCount', {
                  ready: view.readyPlayers.length,
                  total: view.players.filter((p) => p.status === 'active').length,
                })}
              </div>

              {activeMatch?.mode === 'pvp' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #3a2c1d', paddingTop: 14 }}>
                  <div style={{ fontSize: 12.5, color: '#a99a83', fontWeight: 700 }}>{t('game.inviteFriend')}</div>
                  {friends.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#8a7c66' }}>{t('game.noFriendsToInvite')}</div>
                  ) : (
                    friends.map((f) => {
                      const st = inviteStates[f.id] ?? 'idle'
                      return (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13.5, color: '#f0e2c4' }}>{f.username}</div>
                          <button
                            onClick={() => inviteFriend(f.id)}
                            disabled={st !== 'idle'}
                            style={{
                              border: '1px solid ' + (st === 'sent' ? '#2e4a38' : '#3a2c1d'),
                              borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700,
                              color: st === 'sent' ? '#5fd08a' : '#c9bda3',
                              background: st === 'sent' ? 'rgba(34,67,47,.3)' : '#1a130d',
                              cursor: st === 'idle' ? 'pointer' : 'default',
                              flex: 'none',
                            }}
                          >
                            {st === 'busy' ? t('game.invitingBtn') : st === 'sent' ? t('game.inviteSent') : t('game.inviteBtn')}
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...card, padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={sectionLabel}>
                {rollingColor ? t('game.rolling') : canRoll ? t('game.yourRoll') : view.turnPhase === 'WAITING_FOR_MOVE' ? 'Pick a piece' : 'Dice'}
              </div>
              <div style={{ height: 96, display: 'grid', placeItems: 'center' }}>
                <Die value={view.diceValue ?? 0} rolling={rollingColor !== null} />
              </div>
              <button
                onClick={rollDice}
                disabled={!canRoll || isRolling}
                style={{
                  ...btnGold, width: '100%', padding: 14,
                  opacity: canRoll && !isRolling ? 1 : 0.5, cursor: canRoll && !isRolling ? 'pointer' : 'default',
                }}
              >
                {isRolling ? t('game.rolling') : t('game.rollDice')}
              </button>
              {view.turnPhase === 'WAITING_FOR_MOVE' && isMyTurn && (
                <div style={{ fontSize: 13, color: '#a99a83', textAlign: 'center' }}>
                  Click a highlighted piece to move
                </div>
              )}
              {!isMyTurn && (
                <div style={{ fontSize: 13, color: '#a99a83', textAlign: 'center' }}>
                  Waiting for {view.currentTurn}…
                </div>
              )}
            </div>
          )}

          <div style={{ ...card, padding: '18px 20px' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#f0e2c4', marginBottom: 10 }}>{t('game.moveLog')}</div>
            {moveLogs.length === 0 ? (
              <div style={{ fontSize: 13, color: '#a99a83' }}>Game events will appear here…</div>
            ) : (
              moveLogs.map((ml, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 13, color: '#c9bda3' }}>
                  <span style={{ color: COL[ml.ck]?.base ?? '#f0d18a', fontWeight: 800 }}>●</span>
                  <span>{ml.text}</span>
                </div>
              ))
            )}
          </div>

          <button
            onClick={endGame}
            style={{
              border: '1px solid #2e4a38', borderRadius: 12, padding: 12, font: "700 13.5px 'Hanken Grotesk'",
              color: '#8fbf9f', cursor: 'pointer', background: 'rgba(34,67,47,.3)',
            }}
          >
            {t('game.endGameDemo')}
          </button>
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

      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
    </div>
  )
}
