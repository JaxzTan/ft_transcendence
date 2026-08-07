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
}

export function initialView(myColor: PlayerColor): GameViewState {
  return {
    pieces: [],
    players: [],
    currentTurn: 'red',
    turnPhase: 'WAITING_FOR_ROLL',
    diceValue: null,
    legalMoves: [],
    winner: null,
    status: 'waiting',
    clash: null,
    clashResult: null,
    myColor,
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
      }
    }
    case 'game_started':
      return { ...state, status: 'active' }
    case 'dice_rolled': {
      const legalMoves = (event.legalMoves as LegalMove[]) ?? []
      return {
        ...state,
        diceValue: event.value as number,
        legalMoves,
        turnPhase: legalMoves.length > 0 ? 'WAITING_FOR_MOVE' : 'WAITING_FOR_ROLL',
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
    if (move.captured && p.id === move.capturedPieceId) return { ...p, step: 0, isInGoal: false, isInBase: true }
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
  const order: PlayerColor[] = ['red', 'green', 'yellow', 'blue']
  const idx = order.indexOf(from)
  for (let i = 1; i <= 4; i++) {
    const c = order[(idx + i) % 4]
    const p = players.find((x) => x.color === c)
    if (p && p.status === 'active') return c
  }
  return from
}
