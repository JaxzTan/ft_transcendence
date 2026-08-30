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
  safeZones: boolean
  clashMode: boolean
  /** userId of the room host — only they can change game rules pre-launch. */
  hostId?: string
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
    safeZones: true,
    clashMode: true,
    lastRolls: {},
  }
}

export function applyEvent(state: GameViewState, event: { type: string } & Record<string, unknown>): GameViewState {
  switch (event.type) {
    case 'game_joined':
    case 'state_update': {
      const s = event as unknown as GameState & { type: string }
      let players = s.players ?? state.players
      if (s.status === 'waiting' || (!s.status && state.status === 'waiting')) {
        // In waiting room, each user can only occupy ONE active seat.
        // If a user changed seats, clear older duplicate entries.
        const seen = new Set<string>()
        const reversed = [...players].reverse()
        players = reversed
          .map((p) => {
            if (p.status === 'active' && p.username) {
              if (seen.has(p.username)) {
                return { ...p, username: '', displayName: '', status: 'inactive' as const }
              }
              seen.add(p.username)
            }
            return p
          })
          .reverse()
      }
      return {
        ...state,
        pieces: s.pieces ?? state.pieces,
        players,
        currentTurn: s.currentTurn ?? state.currentTurn,
        turnPhase: s.turnPhase ?? state.turnPhase,
        status: s.status ?? state.status,
        legalMoves: s.pendingLegalMoves ?? state.legalMoves,
        diceValue: s.pendingDiceValue ?? state.diceValue,
        clash: s.clash ?? state.clash,
        readyPlayers: s.readyPlayers ?? state.readyPlayers,
        safeZones: s.safeZones ?? state.safeZones,
        clashMode: s.clashMode ?? state.clashMode,
        hostId: (s as GameState & { hostId?: string }).hostId ?? state.hostId,
      }
    }
    case 'lobby_update': {
      const payload = (event.players as Array<{ username: string; color: PlayerColor; ready: boolean }>) ?? []
      // The engine only includes active/disconnected seats in this payload.
      // Any seat omitted from the payload is empty and must be reset to inactive.
      const players = state.players.map((p) => {
        const seat = payload.find((e) => e.color === p.color)
        if (!seat) return { ...p, username: '', displayName: '', status: 'inactive' as const }
        // An exited seat must never be resurrected by a roster refresh — the
        // engine pruned the player (pieces cleared). Keep the exit sticky.
        if (p.status === 'exited') return p
        return { ...p, username: seat.username, displayName: seat.username, status: 'active' as const }
      })
      return {
        ...state,
        players,
        readyPlayers: payload.filter((p) => p.ready).map((p) => p.color),
        hostId: (event.hostId as string | undefined) ?? state.hostId,
      }
    }
    case 'modifiers_updated':
      return { ...state, clashMode: Boolean(event.clashEnabled), safeZones: Boolean(event.safeZones) }
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
    case 'clash_start': {
      const c = event as unknown as ClashState
      // Server may send clash_start without press counts (older payloads);
      // default to 0 so the bars render black/empty until real clash_press events.
      // target defaults to CLASH_TARGET (42) so the bar still calibrates if the
      // payload omits it — the overlay otherwise falls back to its own constant.
      return {
        ...state,
        clash: {
          ...c,
          target: c.target ?? 42,
          attackerPresses: c.attackerPresses ?? 0,
          defenderPresses: c.defenderPresses ?? 0,
        },
        clashResult: null,
      }
    }
    case 'clash_phase': {
      const e = event as unknown as { phase: ClashState['phase']; countdownDeadline: number; pressDeadline: number }
      if (!state.clash) return state
      return { ...state, clash: { ...state.clash, phase: e.phase, countdownDeadline: e.countdownDeadline, pressDeadline: e.pressDeadline } }
    }
    case 'clash_result':
      // KEEP the clash object through the 3s result card — the overlay is
      // rendered only while `view.clash` is truthy. If we null it here, the
      // overlay (and its onComplete timer) unmounts instantly, `clash_clear`
      // never fires, and `clashResult` stays set forever => canRoll is locked
      // until a refresh. clash_clear() (onComplete after the card) clears both.
      return { ...state, clashResult: event as unknown as ClashResult }
    case 'clash_press': {
      const e = event as unknown as { color: PlayerColor; presses: number }
      if (!state.clash) return state
      const clash = { ...state.clash }
      if (e.color === clash.attacker) clash.attackerPresses = e.presses
      else if (e.color === clash.defender) clash.defenderPresses = e.presses
      return { ...state, clash }
    }
    case 'clash_clear':
      return { ...state, clash: null, clashResult: null }
    case 'player_exited':
      // Mirror the engine's handlePlayerExit: the player's pieces are cleared
      // (step -1) so nothing is left to render. Status alone is not enough —
      // a later lobby_update that re-includes the seat would flip it back to
      // 'active' and the stale pieces would reappear on the board.
      return {
        ...state,
        pieces: state.pieces.map((pc) =>
          pc.color === (event.color as PlayerColor)
            ? { ...pc, step: -1, isInBase: false, isInGoal: false }
            : pc,
        ),
        players: state.players.map((p) =>
          p.color === (event.color as PlayerColor) ? { ...p, status: 'exited' } : p,
        ),
      }
    case 'player_disconnected':
      return {
        ...state,
        // Keep all data/pieces — the player is temporarily away, not gone.
        players: state.players.map((p) =>
          p.color === (event.color as PlayerColor) ? { ...p, status: 'disconnected' } : p,
        ),
      }
    case 'player_reconnected':
      return {
        ...state,
        players: state.players.map((p) =>
          p.color === (event.color as PlayerColor) ? { ...p, status: 'active' } : p,
        ),
      }
    default:
      return state
  }
}

function applyMove(state: GameViewState, move: MoveResult): GameViewState {
  const pieces = state.pieces.map((p) => {
    // CAPTURED-FIRST precedence: a clash REPULSE sends the MOVER (also in
    // capturedPieceIds) to prison instead of the landing square. Normal moves
    // never place the mover in capturedPieceIds, so non-clash behavior is unchanged.
    if (move.captured && move.capturedPieceIds?.includes(p.id)) return { ...p, step: 0, isInGoal: false, isInBase: true }
    if (p.id === move.pieceId) return { ...p, step: move.to, isInGoal: move.to === 57, isInBase: false }
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
