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
import { btnGold, btnOutline, card, COL, SEAT_COLORS, sectionLabel } from '../theme'

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

export function Game() {
  const { t } = useTranslation()
  const { user, activeMatch, setPlaying, setLastResult } = useApp()
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null)
  const [view, dispatch] = useReducer(applyEvent, null, () => initialView(activeMatch?.color ?? 'red'))
  const viewRef = useRef(view)
  viewRef.current = view
  const [connected, setConnected] = useState(false)
  const [moveLogs, setMoveLogs] = useState<Array<{ ck: PlayerColor; text: string }>>([])
  const [isRolling, setIsRolling] = useState(false)

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
        const e = state as unknown as { color: PlayerColor; captured: boolean; to: number }
        setMoveLogs((prev) => [
          { ck: e.color, text: e.captured ? `Captured a piece! → step ${e.to}` : `Moved to step ${e.to}` },
          ...prev.slice(0, 7),
        ])
      } else if (type === 'lobby_update') {
        // If a color swap moved *my* seat, resync the socket's own notion of
        // playerColor by re-joining with the new color (server derives move/roll
        // authorization from socket.data.playerColor, set once at join_game time).
        const e = state as unknown as { players: Array<{ username: string; color: PlayerColor }> }
        const mine = e.players.find((p) => p.username === user?.username)
        if (mine && mine.color !== viewRef.current.myColor) {
          dispatch({ type: 'my_color_changed', color: mine.color })
          socket.emit('join_game', activeMatch.gameId, mine.color)
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
    }
  }, [activeMatch, setLastResult])

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
    // Ensure lastResult is set so Results page renders real data
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
  const canRoll = isMyTurn && view.turnPhase === 'WAITING_FOR_ROLL' && !view.clash
  const turnLabel = view.status === 'waiting'
    ? t('game.waitingRoomTitle')
    : isMyTurn ? t('game.yourTurnShort') : `${view.currentTurn.toUpperCase()}'s turn`

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 36px',
          borderBottom: '1px solid rgba(93, 228, 199, 0.15)', background: 'rgba(20, 23, 34, 0.7)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            onClick={leaveGame}
            style={{
              cursor: 'pointer', padding: '9px 16px', borderRadius: 12, border: '1px solid rgba(93,228,199,0.25)',
              background: 'rgba(255,255,255,0.06)', fontSize: 13.5, fontWeight: 700, color: '#f0f4fc',
              fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
            }}
          >
            ← {t('game.leaveShort')}
          </div>
          <div style={{ fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontSize: 20, fontWeight: 800, color: '#f0f4fc' }}>
            {t('game.modePlayerCasual', { mode: view.players.length || 2 })}
          </div>
          <div style={{ fontSize: 12, color: '#a6accd' }}>
            {activeMatch.inviteCode && (
              <span style={{ fontWeight: 800, letterSpacing: '.1em', color: '#f0f4fc', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                {t('game.roomCode')} {activeMatch.inviteCode}
              </span>
            )}
            <span style={{ marginLeft: activeMatch.inviteCode ? 8 : 0, fontSize: 11, color: connected ? '#5de4c7' : '#d0679d', fontWeight: 700 }}>
              {connected ? '● Live' : '● Connecting…'}
            </span>
          </div>
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 999,
            background: 'linear-gradient(135deg, rgba(93,228,199,0.2), rgba(137,221,255,0.25))',
            border: '1px solid rgba(93,228,199,0.5)', fontWeight: 800, fontSize: '14px', color: '#f0f4fc',
            boxShadow: '0 0 20px rgba(93,228,199,0.35)', fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
          }}
        >
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#5de4c7', boxShadow: '0 0 8px #5de4c7' }} />
          {turnLabel}
        </div>
      </header>

      <div
        style={{
          flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr 290px', gap: 28, padding: '28px 36px',
          alignItems: 'start', maxWidth: 1320, margin: '0 auto', width: '100%',
        }}
      >
        {/* Players sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...sectionLabel, color: '#5de4c7' }}>{t('lobby.players')}</div>
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
                    display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16,
                    border: '1px solid ' + (isYou ? col.base : 'rgba(93,228,199,0.2)'),
                    background: occupied ? 'linear-gradient(145deg, rgba(27,30,46,0.85), rgba(20,23,35,0.92))' : 'rgba(255,255,255,.02)',
                    opacity: occupied ? 1 : 0.55,
                    boxShadow: isYou ? `0 0 16px ${col.base}44` : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 40, height: 40, flex: 'none', borderRadius: 12, display: 'grid', placeItems: 'center',
                      fontWeight: 900, fontSize: 14, color: '#13151f',
                      background: occupied ? `linear-gradient(135deg, ${col.base}, ${col.dark})` : 'transparent',
                      border: occupied ? 'none' : `1.5px dashed ${col.base}88`,
                      boxShadow: occupied ? `0 0 12px ${col.base}66` : 'none',
                      fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                    }}
                  >
                    {occupied ? playerMeta!.username.slice(0, 2).toUpperCase() : ''}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: occupied ? '#f0f4fc' : '#506477', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                      {occupied ? playerMeta!.username : t('game.emptySeat')}
                    </div>
                    <div style={{ color: '#a6accd', fontSize: 12 }}>{isYou ? t('common.you') : ck}</div>
                  </div>
                  {occupied && (
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: isReady ? '#5de4c7' : '#a6accd', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                      {isReady ? `✓ ${t('game.readyBadge')}` : t('game.notReadyBadge')}
                    </span>
                  )}
                </div>
              )
            }

            if (!playerMeta || playerMeta.status !== 'active') return null
            const isYou = !playerMeta.isBot && playerMeta.username === user?.username
            const name = playerMeta.username
            const sub = playerMeta.isBot ? t('common.bot') : isYou ? t('common.you') : 'Player'
            const goalCount = playerMeta.piecesInGoal ?? 0

            return (
              <div
                key={ck}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16,
                  border: '1px solid ' + (isActive ? col.base : 'rgba(93,228,199,0.2)'),
                  background: isActive ? `linear-gradient(145deg, ${col.base}25, rgba(20,23,35,0.9))` : 'linear-gradient(145deg, rgba(27,30,46,0.85), rgba(20,23,35,0.92))',
                  boxShadow: isActive ? `0 0 20px ${col.base}55` : 'none',
                }}
              >
                <div
                  style={{
                    width: 40, height: 40, flex: 'none', borderRadius: 12, display: 'grid', placeItems: 'center',
                    fontWeight: 900, fontSize: 14, color: '#13151f', background: `linear-gradient(135deg, ${col.base}, ${col.dark})`,
                    boxShadow: `0 0 12px ${col.base}66`,
                    fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                  }}
                >
                  {name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: '#f0f4fc', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{name}</div>
                  <div style={{ color: '#a6accd', fontSize: 12 }}>{sub}</div>
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
              width: '100%', maxWidth: 540, padding: 18, borderRadius: 24,
              background: 'linear-gradient(145deg, rgba(27,30,46,0.85), rgba(20,23,35,0.95))',
              boxShadow: '0 36px 70px -20px rgba(0,0,0,0.85), 0 0 30px rgba(93,228,199,0.15)',
              border: '1px solid rgba(93,228,199,0.25)',
            }}
          >
            <Board pieces={view.pieces} players={view.players} legalMoves={view.legalMoves} onPieceClick={movePiece} />
          </div>
        </div>

        {/* Controls sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {view.status === 'waiting' ? (
            <div style={{ ...card, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={sectionLabel}>{t('game.waitingRoomTitle')}</div>

              <div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10, fontWeight: 600 }}>{t('game.chooseColor')}</div>
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
                          width: 38, height: 38, borderRadius: 12, cursor: 'pointer',
                          background: `linear-gradient(135deg, ${col.base}, ${col.dark})`,
                          border: ck === view.myColor ? '2.5px solid #ffffff' : '2px solid transparent',
                          boxShadow: ck === view.myColor ? `0 0 16px ${col.base}` : 'none',
                          opacity: takenByOther ? 0.4 : 1,
                          transform: ck === view.myColor ? 'scale(1.1)' : 'scale(1)',
                          transition: 'all .15s ease',
                        }}
                      />
                    )
                  })}
                </div>
              </div>

              <button
                onClick={markReady}
                disabled={view.readyPlayers.includes(view.myColor)}
                style={{
                  ...btnGold, width: '100%', padding: 14,
                  opacity: view.readyPlayers.includes(view.myColor) ? 0.6 : 1,
                  cursor: view.readyPlayers.includes(view.myColor) ? 'default' : 'pointer',
                }}
              >
                {view.readyPlayers.includes(view.myColor) ? t('game.readyWaitingBtn') : t('game.readyBtn')}
              </button>

              <div style={{ fontSize: 13, color: '#00e676', textAlign: 'center', fontWeight: 700 }}>
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
              <div style={{ height: 100, display: 'grid', placeItems: 'center' }}>
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
                <div style={{ fontSize: 13.5, color: '#89ddff', textAlign: 'center', fontWeight: 700 }}>
                  Click a glowing piece to move
                </div>
              )}
              {!isMyTurn && (
                <div style={{ fontSize: 13, color: '#a6accd', textAlign: 'center' }}>
                  Waiting for {view.currentTurn}…
                </div>
              )}
            </div>
          )}

          <div style={{ ...card, padding: '18px 20px' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#f0f4fc', marginBottom: 10, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{t('game.moveLog')}</div>
            {moveLogs.length === 0 ? (
              <div style={{ fontSize: 13, color: '#506477' }}>Game events will appear here…</div>
            ) : (
              moveLogs.map((ml, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 13, color: '#cbd5e1' }}>
                  <span style={{ color: COL[ml.ck]?.base ?? '#ffcb6b', fontWeight: 800 }}>●</span>
                  <span>{ml.text}</span>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => navigate('/results')}
            style={{
              ...btnOutline, width: '100%', padding: 12, fontSize: 13.5, fontWeight: 700,
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
