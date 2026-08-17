// Reduces engine Socket.IO events into a renderable GameViewState.
// The reducer is a renderer — it never decides outcomes.
// The engine is authoritative; the reducer just keeps the UI in sync.

import type { ClashState, GameState, LegalMove, MoveResult, PlayerColor } from './types'

export type ClashResult = {
  winner: PlayerColor
  loser: PlayerColor
  winnerPresses: number
  loserPresses: number
}

export type GameViewState = {
  pieces: GameState['pieces']
  players: GameState['players']
  currentTurn: PlayerColor
  turnPhase: GameState['turnPhase']
  diceValue: number | null
  legalMoves: LegalMove[]
  winner: PlayerColor | null
  status: GameState['status']
  clash: ClashState | null
  clashResult: ClashResult | null
  myColor: PlayerColor
  readyPlayers: PlayerColor[]
  /** Last dice value rolled by each color (populated from dice_rolled events). */
  lastRolls: Partial<Record<PlayerColor, number>>
}

export function initialView(myColor: PlayerColor): GameViewState {
  return {
    pieces: [],
    players: [],
    currentTurn: 'blue',
    turnPhase: 'WAITING_FOR_ROLL',
    diceValue: null,
    legalMoves: [],
    winner: null,
    status: 'waiting',
    clash: null,
    clashResult: null,
    myColor,
    readyPlayers: [],
    lastRolls: {},
  }
}

export function applyEvent(state: GameViewState, event: { type: string } & Record<string, unknown>): GameViewState {
  switch (event.type) {
    case 'game_joined':
    case 'state_update': {
      const s = event as unknown as GameState & { type: string }
      return {
        ...state,
        pieces: s.pieces ?? state.pieces,
        players: s.players ?? state.players,
        currentTurn: s.currentTurn ?? state.currentTurn,
        turnPhase: s.turnPhase ?? state.turnPhase,
        status: s.status ?? state.status,
        legalMoves: s.pendingLegalMoves ?? state.legalMoves,
        diceValue: s.pendingDiceValue ?? state.diceValue,
        clash: s.clash ?? state.clash,
        readyPlayers: s.readyPlayers ?? state.readyPlayers,
      }
    }
    case 'lobby_update': {
      const payload = (event.players as Array<{ username: string; color: PlayerColor; ready: boolean }>) ?? []
      // The engine only includes non-inactive seats in this payload (see
      // emitLobbyUpdate in engine.ts), so presence here means the seat has
      // joined. Without marking it active, a player who joined before
      // another one never sees that seat's status flip, so their local
      // activeCount stays stuck below 2 and their Ready button never enables.
      const players = state.players.map((p) => {
        const seat = payload.find((e) => e.color === p.color)
        return seat ? { ...p, username: seat.username, status: 'active' as const } : p
      })
      return {
        ...state,
        players,
        readyPlayers: payload.filter((p) => p.ready).map((p) => p.color),
      }
    }
    case 'my_color_changed':
      return { ...state, myColor: event.color as PlayerColor }
    case 'game_started':
      return { ...state, status: 'active', lastRolls: {} }
    case 'dice_rolled': {
      const legalMoves = (event.legalMoves as LegalMove[]) ?? []
      // Key the roll to the PRE-event turn (state.currentTurn): the engine
      // advances currentTurn before emitting on no-move/3×6 forfeit paths, so
      // the event's own currentTurn may already be the NEXT player while the
      // value belongs to the player who actually rolled.
      const roller = state.currentTurn
      return {
        ...state,
        diceValue: event.value as number,
        legalMoves,
        turnPhase: legalMoves.length > 0 ? 'WAITING_FOR_MOVE' : 'WAITING_FOR_ROLL',
        currentTurn: (event.currentTurn as PlayerColor) ?? state.currentTurn,
        lastRolls: { ...state.lastRolls, [roller]: event.value as number },
      }
    }
    case 'piece_moved':
      return applyMove(state, event as unknown as MoveResult)
    case 'game_ended':
      return { ...state, status: 'finished', winner: event.winner as PlayerColor }
    case 'clash_start':
      return { ...state, clash: event as unknown as ClashState, clashResult: null }
    case 'clash_result':
      return { ...state, clashResult: event as unknown as ClashResult, clash: null }
    case 'clash_clear':
      return { ...state, clash: null, clashResult: null }
    case 'player_exited':
      return {
        ...state,
        players: state.players.map((p) =>
          p.color === (event.color as PlayerColor) ? { ...p, status: 'exited' } : p,
        ),
      }
    default:
      return state
  }
}

function applyMove(state: GameViewState, move: MoveResult): GameViewState {
  const pieces = state.pieces.map((p) => {
    if (p.id === move.pieceId) return { ...p, step: move.to, isInGoal: move.to === 57, isInBase: false }
    if (move.captured && move.capturedPieceIds?.includes(p.id)) return { ...p, step: 0, isInGoal: false, isInBase: true }
    return p
  })

  const players = state.players.map((p) => {
    if (p.color === move.color) {
      const inGoal = pieces.filter((pc) => pc.color === move.color && pc.isInGoal).length
      return { ...p, piecesInGoal: inGoal }
    }
    return p
  })

  return {
    ...state,
    pieces,
    players,
    diceValue: move.diceValue,
    legalMoves: [],
    turnPhase: 'WAITING_FOR_ROLL',
    currentTurn: move.bonusRoll ? move.color : nextTurn(state.players, move.color),
  }
}

function nextTurn(players: GameState['players'], from: PlayerColor): PlayerColor {
  const order: PlayerColor[] = ['blue', 'red', 'green', 'yellow']
  const idx = order.indexOf(from)
  for (let i = 1; i <= 4; i++) {
    const c = order[(idx + i) % 4]
    const p = players.find((x) => x.color === c)
    if (p && p.status === 'active') return c
  }
  return from
}
