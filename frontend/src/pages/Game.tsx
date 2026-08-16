import { useEffect, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Board } from '../components/Board'
import { Die } from '../components/Die'
import { ClashOverlay } from '../game/ClashOverlay'
import { applyEvent, initialView } from '../game/reducer'
import type { PlayerColor } from '../game/types'
import { navigate } from '../router'
import { connectSocket } from '../socket'
import { useApp } from '../store'
import { COL, SEAT_COLORS, btnGold, card, sectionLabel } from '../theme'

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

// Matches the backend's SLOT_COLORS — hotseat seat index i always maps to
// this color, regardless of the Lobby seat-picker's own (unrelated) display order.
const SLOT_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue']

export function Game() {
  const { t } = useTranslation()
  const { user, activeMatch, seats, setPlaying, setLastResult, setActiveMatch } = useApp()

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
  const [codeCopied, setCodeCopied] = useState(false)
  // Box-by-box move animation: while set, Board renders this piece at `step`
  // instead of its real (already-updated) logical position — see the
  // piece_moved handler below, which steps through the server's `path`.
  const [animatingPiece, setAnimatingPiece] = useState<{ pieceId: string; step: number } | null>(null)
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const STEP_ANIM_MS = 220

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

  // Connect to engine via Socket.IO
  useEffect(() => {
    if (!activeMatch) return

    const socket = connectSocket(activeMatch.token)
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      // Hotseat: one physical device controls every seat — the engine has no
      // separate accounts to join with, so this single socket must join_game
      // for every local color up front (else an un-joined seat stays 'inactive'
      // forever and advanceTurnInState skips it, effectively stranding the
      // game on whoever joined first). Join the others first, own color last,
      // so socket.data.playerColor (server-side move/roll authorization,
      // overwritten by each join_game call) ends up on red — the color that
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
    const handleEngineEvent = (state: unknown) => {
      const type = (state as { type?: string }).type
      dispatch({ type: 'state_update', ...(state as object) })

      if (type === 'dice_rolled') {
        setIsRolling(false)
        const e = state as unknown as { value: number; bonusRoll: boolean }
        setMoveLogs((prev) => [
          { ck: viewRef.current.currentTurn, text: `Rolled a ${e.value}${e.bonusRoll ? ' (bonus)' : ''}` },
          ...prev.slice(0, 7),
        ])
      } else if (type === 'piece_moved') {
        const e = state as unknown as { pieceId: string; color: PlayerColor; captured: boolean; to: number; path: number[] }
        setMoveLogs((prev) => [
          { ck: e.color, text: e.captured ? `Captured a piece! → step ${e.to}` : `Moved to box ${e.to}` },
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
    socket.on('clash_start', handleEngineEvent)
    socket.on('clash_result', handleEngineEvent)
    socket.on('clash_frozen', handleEngineEvent)
    socket.on('lobby_update', handleEngineEvent)

    socket.on('game_timeout', () => navigate('/home'))
    socket.on('game_expired', () => navigate('/home'))

    socket.on('error', (msg: string) => {
      console.error('[engine]', msg)
      setIsRolling(false)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      if (animTimerRef.current) clearInterval(animTimerRef.current)
      animTimerRef.current = null
      setAnimatingPiece(null)
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

  const rollDice = () => {
    setIsRolling(true)
    socketRef.current?.emit('roll_dice')
  }
  const movePiece = (pieceId: string) => socketRef.current?.emit('move_piece', pieceId)
  const markReady = () => socketRef.current?.emit('player_ready')
  const selectColor = (color: PlayerColor) => socketRef.current?.emit('select_color', color)
  const clashInput = (key: string) => socketRef.current?.emit('clash_input', key)
  const clearClash = () => dispatch({ type: 'clash_clear' })

  const leaveGame = () => {
    socketRef.current?.emit('leave_game')
    navigate('/lobby')
  }

  // Forfeit the game entirely: removes the player's pieces, counts them as
  // having left/aborted, and gives them no score. The engine drops their seat
  // (pieces → -1, status exited); the game continues for the remaining players.
  const endGame = () => {
    socketRef.current?.emit('resign')
    setLastResult({
      winner: viewRef.current.currentTurn,
      resultDetail: 'exit',
      players: viewRef.current.players
        .filter((p) => p.status === 'active')
        .map((p) => ({
          color: p.color, username: p.username, isBot: p.isBot, piecesInGoal: p.piecesInGoal,
        })),
    })
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

  const isMyTurn = view.currentTurn === view.myColor
  const canRoll = isMyTurn && view.turnPhase === 'WAITING_FOR_ROLL' && !view.clash && !animatingPiece
  const turnLabel = view.status === 'waiting'
    ? t('game.waitingRoomTitle')
    : isMyTurn ? t('game.yourTurnShort') : `${view.currentTurn.toUpperCase()}'s turn`

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
          flex: 1, display: 'grid', gridTemplateColumns: '250px 1fr 280px', gap: 24, padding: '26px 30px',
          alignItems: 'start', maxWidth: 1300, margin: '0 auto', width: '100%',
        }}
      >
        {/* Players sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...sectionLabel, color: '#a99a83' }}>{t('lobby.players')}</div>
          {SEAT_COLORS.map((ck) => {
            const col = COL[ck]
            const playerMeta = view.players.find((p) => p.color === ck)
            const occupied = playerMeta && (view.status !== 'waiting' || playerMeta.status === 'active')
            const isActive = view.currentTurn === ck

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
                  <div
                    style={{
                      width: 38, height: 38, flex: 'none', borderRadius: 10, display: 'grid', placeItems: 'center',
                      fontWeight: 800, fontSize: 13, color: '#12100a',
                      background: occupied ? `linear-gradient(180deg,${col.base},${col.dark})` : 'transparent',
                      border: occupied ? 'none' : `1.5px dashed ${col.base}88`,
                    }}
                  >
                    {occupied ? playerMeta!.username.slice(0, 2).toUpperCase() : ''}
                  </div>
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

            if (!playerMeta || playerMeta.status !== 'active') return null
            const isHotseat = activeMatch.mode === 'hotseat'
            // Hotseat: every seat is controlled by the same device, so "isYou"
            // means "whoever's turn this device is currently authorized to
            // play" (view.myColor) rather than a username match — the other
            // local seat has its own typed-in name (see localNames) but still
            // isn't a separate real account.
            const isYou = isHotseat ? ck === view.myColor : !playerMeta.isBot && playerMeta.username === user?.username
            const name = playerMeta.username
            const sub = playerMeta.isBot ? t('common.bot') : isYou ? t('common.you') : isHotseat ? t('game.localPlayer') : 'Player'
            const goalCount = playerMeta.piecesInGoal ?? 0

            return (
              <div
                key={ck}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: 12, borderRadius: 13,
                  border: '1px solid ' + (isActive ? col.base : '#3a2c1d'),
                  background: isActive ? `linear-gradient(180deg,${col.base}22,#1a130d)` : 'linear-gradient(180deg,#241b13,#1a130d)',
                  boxShadow: isActive ? `0 0 0 1px ${col.base}55` : 'none',
                }}
              >
                <div
                  style={{
                    width: 38, height: 38, flex: 'none', borderRadius: 10, display: 'grid', placeItems: 'center',
                    fontWeight: 800, fontSize: 13, color: '#12100a', background: `linear-gradient(180deg,${col.base},${col.dark})`,
                  }}
                >
                  {name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#f0e2c4' }}>{name}</div>
                  <div style={{ color: '#a99a83', fontSize: 12 }}>{sub}</div>
                </div>
                <Pips count={goalCount} color={col.base} />
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
            <Board pieces={view.pieces} players={view.players} legalMoves={view.legalMoves} onPieceClick={movePiece} animating={animatingPiece} />
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
                  {SEAT_COLORS.map((ck) => {
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
            </div>
          ) : (
            <div style={{ ...card, padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={sectionLabel}>
                {isRolling ? t('game.rolling') : canRoll ? t('game.yourRoll') : view.turnPhase === 'WAITING_FOR_MOVE' ? 'Pick a piece' : 'Dice'}
              </div>
              <div style={{ height: 96, display: 'grid', placeItems: 'center' }}>
                <Die value={view.diceValue ?? 0} rolling={isRolling} />
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
    </div>
  )
}
