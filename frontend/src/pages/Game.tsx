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

export function Game() {
  const { t } = useTranslation()
  const { activeMatch, setPlaying, setLastResult } = useApp()
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null)
  const [view, dispatch] = useReducer(applyEvent, null, () => initialView('red'))
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

    const socket = connectSocket(activeMatch.engineUrl, activeMatch.token)
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join_game', activeMatch.gameId, 'red')
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

    socket.on('state_update', (state) => {
      dispatch({ type: 'state_update', ...(state as object) })
    })

    socket.on('dice_rolled', (e) => {
      setIsRolling(false)
      dispatch({ type: 'dice_rolled', ...e })
      setMoveLogs((prev) => [
        { ck: viewRef.current.currentTurn, text: `Rolled a ${e.value}${e.bonusRoll ? ' (bonus)' : ''}` },
        ...prev.slice(0, 7),
      ])
    })

    socket.on('piece_moved', (e) => {
      dispatch({ type: 'piece_moved', ...e })
      setMoveLogs((prev) => [
        { ck: e.color, text: e.captured ? `Captured a piece! → step ${e.to}` : `Moved to step ${e.to}` },
        ...prev.slice(0, 7),
      ])
    })

    socket.on('game_started', (e) => dispatch({ type: 'game_started', ...(e as object) }))

    socket.on('game_ended', (e) => {
      dispatch({ type: 'game_ended', ...(e as object) })
      setLastResult({
        winner: e.winner,
        resultDetail: e.resultDetail,
        players: viewRef.current.players.map((p) => ({
          color: p.color, username: p.username, isBot: p.isBot, piecesInGoal: p.piecesInGoal,
        })),
      })
      setTimeout(() => navigate('/results'), 2500)
    })

    socket.on('clash_start', (e) => dispatch({ type: 'clash_start', ...(e as object) }))
    socket.on('clash_result', (e) => dispatch({ type: 'clash_result', ...(e as object) }))
    socket.on('player_exited', (e) => dispatch({ type: 'player_exited', ...(e as object) }))
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
  const clashInput = (key: string) => socketRef.current?.emit('clash_input', key)
  const clearClash = () => dispatch({ type: 'clash_clear' })

  const leaveGame = () => {
    socketRef.current?.emit('leave_game')
    // Ensure lastResult is set so Results page renders real data
    setLastResult({
      winner: viewRef.current.currentTurn,
      resultDetail: 'exit',
      players: viewRef.current.players.map((p) => ({
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
  const turnLabel = isMyTurn ? t('game.yourTurnShort') : `${view.currentTurn.toUpperCase()}'s turn`

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
            ← {t('game.leaveShort')}
          </div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 18, color: '#f4e9cf' }}>
            {t('game.modePlayerCasual', { mode: view.players.length || 2 })}
          </div>
          <div style={{ fontSize: 12, color: '#a99a83' }}>
            Match #{activeMatch.gameId.slice(0, 8)}
            <span style={{ marginLeft: 8, fontSize: 11, color: connected ? '#5fd08a' : '#e05050' }}>
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
            const isActive = view.currentTurn === ck
            const name = playerMeta ? playerMeta.username : ck[0].toUpperCase() + ck.slice(1)
            const sub = playerMeta?.isBot ? t('common.bot') : t('common.you')
            const goalCount = playerMeta?.piecesInGoal ?? 0
            if (!playerMeta) return null

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
            <Board pieces={view.pieces} legalMoves={view.legalMoves} onPieceClick={movePiece} />
          </div>
        </div>

        {/* Controls sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            {!isMyTurn && view.status === 'active' && (
              <div style={{ fontSize: 13, color: '#a99a83', textAlign: 'center' }}>
                Waiting for {view.currentTurn}…
              </div>
            )}
            {view.status === 'waiting' && (
              <div style={{ fontSize: 13, color: '#5fd08a', textAlign: 'center' }}>
                Waiting for players…
              </div>
            )}
          </div>

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
            onClick={() => navigate('/results')}
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
