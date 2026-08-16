import { GameState, PlayerColor, GameEvent } from './types';
import { RedisGameStore } from './redis';
import { ClashManager } from './clash';

const COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
const DISCONNECT_GRACE_MS = 30000; // 30 seconds to reconnect before forfeit

/**
 * First active seat in color order. Game creation always seeds
 * currentTurn as 'red', but colors can be swapped pre-game (see
 * LobbyManager.handleSelectColor) so red isn't guaranteed to be occupied
 * by the time the match starts — currentTurn must be corrected to an
 * actually-seated color or the game soft-locks on an inactive seat.
 */
export function firstActiveColor(state: GameState): PlayerColor | undefined {
  return COLORS.find(c => state.players.find(p => p.color === c)?.status === 'active');
}

/**
 * Advance turn to the next seated (active) player.
 * Mutates state in-place.
 */
export function advanceTurnInState(state: GameState): void {
  const currentIndex = COLORS.indexOf(state.currentTurn);
  let nextIndex = (currentIndex + 1) % 4;

  let loopCount = 0;
  while (loopCount < 4) {
    const p = state.players[nextIndex];
    // Only an *active* seat can hold the turn — 'inactive' means the seat was
    // never joined at all (e.g. the unused 2 colors in a 2-player match), and
    // was previously falling through this check, permanently stalling the
    // turn on a seat nobody controls.
    if (p.status === 'active') {
      break;
    }
    nextIndex = (nextIndex + 1) % 4;
    loopCount++;
  }

  if (loopCount >= 4) {
    state.status = 'finished';
  }
  state.currentTurn = COLORS[nextIndex];
  state.firstRollOfTurn = true;
}

/**
 * Handle a player disconnect with a grace period.
 * Instead of immediately exiting, marks the player as 'disconnected'
 * and schedules a forfeit after DISCONNECT_GRACE_MS.
 * If the player reconnects within the window, the disconnect is cleared.
 */
export async function handlePlayerDisconnect(
  store: RedisGameStore,
  emit: (event: GameEvent) => void,
  gameId: string,
  color: PlayerColor,
  clashManager?: ClashManager,
): Promise<void> {
  const state = await store.loadGameState(gameId);
  if (!state) return;

  // Check if already disconnected
  const existing = state.disconnectedPlayers.find(d => d.color === color);
  if (existing) return; // Already in grace period

  const deadline = Date.now() + DISCONNECT_GRACE_MS;
  state.disconnectedPlayers.push({
    color,
    disconnectedAt: Date.now(),
    reconnectDeadline: deadline,
  });

  // Mark player as disconnected (not exited — they can still reconnect)
  const player = state.players.find(p => p.color === color);
  if (player && player.status === 'active') {
    player.status = 'disconnected';
    player.isConnected = false;
  }

  // If it's this player's turn, advance to next active player
  if (state.currentTurn === color && state.status === 'active') {
    advanceTurnInState(state);
    // Clear any pending moves from the disconnected player
    state.pendingLegalMoves = [];
    state.pendingDiceValue = undefined;
  }

  // If there's an active clash, freeze it — no separate timeout needed
  if (clashManager && state.clash) {
    await clashManager.freezeClash(gameId, color);
  }

  await store.saveGameState(gameId, state);
  emit({ type: 'player_exited', gameId, color });

  // Unified timeout: handles both clash resolution and player forfeit
  setTimeout(async () => {
    const currentState = await store.loadGameState(gameId);
    if (!currentState) return;

    const disc = currentState.disconnectedPlayers.find(d => d.color === color);
    if (!disc) return; // Already reconnected

    // Check if deadline has passed
    if (Date.now() >= disc.reconnectDeadline) {
      // Resolve any frozen clash against this player
      if (currentState.clash && currentState.clash.waitingForReconnect === color) {
        const other = currentState.clash.attacker === color
          ? currentState.clash.defender
          : currentState.clash.attacker;
        // Resolve the clash immediately
        if (clashManager) {
          await clashManager.resolveClash(gameId, other, color);
        }
      }
      // Forfeit: permanently exit the player
      await handlePlayerExit(store, emit, gameId, color);
    }
  }, DISCONNECT_GRACE_MS + 1000);
}

/**
 * Handle a player reconnecting within the grace period.
 */
export async function handlePlayerReconnect(
  store: RedisGameStore,
  gameId: string,
  color: PlayerColor,
): Promise<void> {
  const state = await store.loadGameState(gameId);
  if (!state) return;

  const discIndex = state.disconnectedPlayers.findIndex(d => d.color === color);
  if (discIndex === -1) return; // Not in grace period

  const disc = state.disconnectedPlayers[discIndex];
  if (Date.now() > disc.reconnectDeadline) {
    // Too late — player is already forfeited
    return;
  }

  // Remove from disconnect list
  state.disconnectedPlayers.splice(discIndex, 1);

  // Restore player to active
  const player = state.players.find(p => p.color === color);
  if (player) {
    player.status = 'active';
    player.isConnected = true;
  }

  await store.saveGameState(gameId, state);
}

/**
 * Handle a player clicking "ready".
 * When all joined players are ready, transitions game to 'active'.
 */
export async function handlePlayerReady(
  store: RedisGameStore,
  emit: (event: GameEvent) => void,
  gameId: string,
  color: PlayerColor,
): Promise<void> {
  const state = await store.loadGameState(gameId);
  if (!state || state.status !== 'waiting') return;

  // Add to ready list if not already there
  if (!state.readyPlayers.includes(color)) {
    state.readyPlayers.push(color);
  }

  await store.saveGameState(gameId, state);

  // Check if game should start (delegate to lobby manager if available).
  // Requires >= 2 active seats — a lone host marking themselves ready must
  // not be able to flip a pvp match to 'active' with nobody else in the room.
  const activeCount = state.players.filter(p => p.status === 'active').length;
  const allReady = activeCount >= 2 &&
    state.players.filter(p => p.status === 'active').every(p => state.readyPlayers.includes(p.color));

  if (allReady) {
    state.currentTurn = firstActiveColor(state) ?? state.currentTurn;
    state.status = 'active';
    await store.saveGameState(gameId, state);
    emit({ type: 'game_started', gameId });
  }
}

/**
 * Permanently exit a player (forfeit).
 * Sets all pieces to -1, marks player as exited.
 */
export async function handlePlayerExit(
  store: RedisGameStore,
  emit: (event: GameEvent) => void,
  gameId: string,
  color: PlayerColor,
): Promise<void> {
  const state = await store.loadGameState(gameId);
  if (!state) return;

  // Remove from disconnect list if present
  state.disconnectedPlayers = state.disconnectedPlayers.filter(d => d.color !== color);

  for (const piece of state.pieces.filter(p => p.color === color)) {
    piece.step = -1;
  }
  
  const player = state.players.find(p => p.color === color);
  if (player) {
    player.status = 'exited';
    player.isConnected = false;
    player.isFinished = true;
  }

  if (state.currentTurn === color && state.status === 'active') {
    advanceTurnInState(state);
  }
  
	// Clear any pending clash state on exit
	if (state.clash) {
		delete state.clash;
	}

	await store.saveGameState(gameId, state);
	emit({ type: 'player_exited', gameId, color });

	// Waiting-room cleanup: a guest leaving a PvP lobby must leave their
	// Redis match-hash seat, otherwise the room counts 2 seated forever and
	// the 5-minute idle-abort (server.ts checkExpiredLobbies) never restarts
	// its countdown for the host. The host's own seat is never cleared —
	// that keeps their room rejoinable from the open-rooms list.
	if (state.status === 'waiting') {
		await store.clearMatchSeat(gameId, color);
	}
}
