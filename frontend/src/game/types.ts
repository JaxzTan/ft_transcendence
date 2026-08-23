// Mirror of the ludo-engine TypeScript types. Engine is single source of truth.

export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue'
export type PlayerStatus = 'active' | 'exited' | 'inactive' | 'disconnected'
export type TurnPhase = 'WAITING_FOR_ROLL' | 'WAITING_FOR_MOVE'
export type ClashPhase = 'announce' | 'countdown' | 'pressing'
export type PieceId = string

export interface Piece {
  id: PieceId
  color: PlayerColor
  step: number
  isInGoal: boolean
  isInBase: boolean
}

export interface PlayerMeta {
  color: PlayerColor
  status: PlayerStatus
  username: string
  displayName?: string
  isBot: boolean
  isConnected: boolean
  pieces: Piece[]
  piecesInGoal: number
  hasRolled: boolean
  consecutiveSixes: number
  bonusRoll: boolean
  isFinished: boolean
  finishedAt?: string
}

export interface LegalMove {
  pieceId: PieceId
  from: number
  to: number
  isCapture: boolean
  isHomeEntry: boolean
}

export interface MoveResult {
  ply: number
  color: PlayerColor
  diceValue: number
  pieceId: PieceId
  from: number
  path: number[]
  to: number
  captured: boolean
  capturedPieceIds?: PieceId[]
  enteredHome: boolean
  bonusRoll: boolean
  clashOutcome?: 'attacker_won' | 'defender_won'
}

export interface ClashState {
  attacker: PlayerColor
  defender: PlayerColor
  attackerKey: string
  defenderKey: string
  target: number
  duration: number
  startedAt: number
  announceDeadline: number
  countdownDeadline: number
  pressDeadline: number
  phase: ClashPhase
  attackerPresses: number
  defenderPresses: number
  disconnectTimestamp?: number
  reconnectDeadline?: number
  waitingForReconnect?: PlayerColor
}

export interface DisconnectState {
  color: PlayerColor
  disconnectedAt: number
  reconnectDeadline: number
}

export interface GameState {
  id: string
  pieces: Piece[]
  players: PlayerMeta[]
  currentTurn: PlayerColor
  consecutiveSixes: number
  moveCounter: number
  turnPhase: TurnPhase
  pendingLegalMoves: LegalMove[]
  pendingDiceValue?: number
  disconnectedPlayers: DisconnectState[]
  status: 'waiting' | 'active' | 'finished'
  winner?: PlayerColor
  resultDetail?: string
  resultSubmitted?: boolean
  botBusy?: boolean
  clash?: ClashState
  clashMode: boolean
  readyPlayers: PlayerColor[]
  resultCardUntil?: number
}
