import { LudoEngine } from '../engine';
import { RedisGameStore } from '../redis';
import { LudoBot } from '../bot';
import { firstActiveColor } from '../player-handler';
import { GameSocket, isBotUserId, BOT_PREFIX } from './auth';
import type { PlayerColor } from '../types';

// Shared seat order — its original home. server.ts imports it for rematch
// room creation (the seat order must match the original match).
export const SLOT_COLORS: PlayerColor[] = ['blue', 'red', 'green', 'yellow'];

/**
 * JoinManager owns the join_game flow — historically the largest single
 * handler in the socket layer. It serializes each game's join critical
 * section against Redis, resolves the seat a socket should bind to, creates
 * the game if it doesn't exist yet, handles reconnects, and auto-starts
 * PvE/hotseat matches.
 */
export class JoinManager {
  // Serializes each game's join_game critical section (load → mutate → save
  // against Redis). Hotseat fires several join_game calls back-to-back on
  // connect (one per local seat); without this, their async load/save cycles
  // interleave and the last save wins, silently dropping the earlier joins.
  private joinLocks = new Map<string, Promise<unknown>>();

  constructor(
    private store: RedisGameStore,
    private engine: LudoEngine,
    private userIdMap: Map<string, Map<PlayerColor, string>>,
    private getOrCreateBot: (gameId: string, color: PlayerColor, engine: LudoEngine, store: RedisGameStore) => LudoBot,
    private scheduleBotTurn?: (gameId: string) => void,
  ) {}

  private withGameLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.joinLocks.get(gameId) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    this.joinLocks.set(gameId, run.catch(() => undefined));
    return run;
  }

  handleJoinGame(socket: GameSocket, gameId: string, playerColor: PlayerColor, userId?: string, displayName?: string): void {
    const effectiveGameId = socket.data.gameId || gameId;
    const effectiveUserId = socket.data.userId || userId;
    const effectiveUsername = displayName || socket.data.username;
    const isHotseat = socket.data.mode === 'hotseat';
    const effectiveColor = (!isHotseat && socket.data.tokenColor) || playerColor;

    this.withGameLock(effectiveGameId, async () => {
      try {
        socket.join(effectiveGameId);
        socket.data.gameId = effectiveGameId;
        socket.data.playerColor = effectiveColor;

        if (effectiveUserId) {
          if (!this.userIdMap.has(effectiveGameId)) {
            this.userIdMap.set(effectiveGameId, new Map());
          }
          this.userIdMap.get(effectiveGameId)!.set(effectiveColor, effectiveUserId);
        }

        let state = await this.store.loadGameState(effectiveGameId);
        if (!state) {
          const creationMatchData = await this.store.getMatchData(effectiveGameId);
          const playerCount = parseInt(creationMatchData?.playerCount || '4', 10);
          // Prefer the persisted seatColors (exact ordered seats, including
          // skipped colors in hotseat, e.g. blue + green + yellow with no red).
          // Falls back to the dense slot fill for older rooms / direct engine use.
          const seatColors = creationMatchData?.seatColors
            ? (creationMatchData.seatColors.split(',') as PlayerColor[])
            : SLOT_COLORS.slice(0, playerCount);
          await this.store.createGame(effectiveGameId, seatColors);
          state = await this.store.loadGameState(effectiveGameId);
        }
        if (state) {
          const discIndex = state.disconnectedPlayers.findIndex(d => d.color === effectiveColor);
          const isReconnectingPlayer = discIndex !== -1;

          // Socket locking: reject non-reconnecting joins to games already in
          // progress — only a player reconnecting to their own seat may re-enter.
          if (state.status !== 'waiting' && !isReconnectingPlayer) {
            socket.emit('error', 'Game already in progress');
            return;
          }

          if (isReconnectingPlayer) {
            await this.engine.handlePlayerReconnect(effectiveGameId, effectiveColor);
            state = await this.store.loadGameState(effectiveGameId);
            // The player is back on their old seat — tell the room so everyone
            // sees them flip from "Reconnecting…" back to active.
            if (state && !state.disconnectedPlayers.some((d) => d.color === effectiveColor)) {
              this.engine.emitEvent({ type: 'player_reconnected', gameId: effectiveGameId, color: effectiveColor });
            }
          } else {
            const player = state.players.find(p => p.color === effectiveColor);
            if (player) player.status = 'active';
          }

          // Populate PlayerMeta with frontend-compatible fields.
          // `username` is the immutable identity (used for login/avatar/URLs);
          // `displayName` is what the UI actually shows in-game.
          const meta = state.players.find(p => p.color === effectiveColor);
          if (meta) {
            const resolvedUsername = effectiveUsername || effectiveUserId || (effectiveColor.charAt(0).toUpperCase() + effectiveColor.slice(1));
            meta.username = resolvedUsername;
            meta.displayName = displayName || socket.data.displayName || resolvedUsername;
            meta.isBot = isBotUserId(effectiveUserId);
            meta.isConnected = true;
            meta.status = 'active';
          }

          if (state.status === 'waiting') {
            await this.store.saveGameState(effectiveGameId, state);
            // Already-connected clients (e.g. the room host) otherwise never
            // learn a new seat joined — nothing else broadcasts on join, so
            // their local view stays stuck at solo-room state forever and
            // their Ready button never enables. See emitLobbyUpdate in engine.ts.
            await this.engine.emitLobbyUpdate(effectiveGameId);
          }
        }
        if (isBotUserId(effectiveUserId)) {
          this.getOrCreateBot(effectiveGameId, effectiveColor, this.engine, this.store);
        }

        // PvE/Hotseat auto-start: neither has a second real remote player to
        // wait on (PvE's other seats are bots; hotseat's other seats are the
        // same physical device), so skip the manual ready-check entirely.
        const matchData = await this.store.getMatchData(effectiveGameId);
        if (matchData && (matchData.gameType === 'PVE' || matchData.gameType === 'HOTSEAT')) {
          await this.autoStartIfReady(effectiveGameId, matchData);
          // Reload state — autoStartIfReady may have transitioned it to 'active'
          state = await this.store.loadGameState(effectiveGameId);
        }

        // Resume re-arm: any reconnect/join into an ACTIVE game clears the
        // pause flag, and if it's a bot's turn the bot trigger is re-scheduled.
        // This is what un-freezes a bot-mode game the player left mid-game
        // (or refreshed the browser on) — the turn state persisted in Redis,
        // the human just needs a fresh bot kick.
        if (state?.status === 'active' && state.paused) {
          delete state.paused;
          delete state.pauseTurnOwner;
          await this.store.saveGameState(effectiveGameId, state);
        }
        if (state?.status === 'active' && state.currentTurn && isBotUserId(this.userIdMap.get(effectiveGameId)?.get(state.currentTurn))) {
          this.scheduleBotTurn?.(effectiveGameId);
        }

        if (state) socket.emit('game_joined', state);
      } catch (error) {
        socket.emit('error', `Failed to join game: ${error}`);
      }
    });
  }
  /**
   * Auto-start PvE and hotseat matches — neither has a genuine second remote
   * player to run a ready-check quorum against, so skip it. PvE registers its
   * bot seats here; hotseat just waits for every local seat (playerCount,
   * since hotseat never populates player2_id../player4_id — one real account
   * plays every seat) to have joined before flipping the game active.
   */
  private async autoStartIfReady(gameId: string, matchData: Record<string, string>): Promise<void> {
    const state = await this.store.loadGameState(gameId);
    if (!state) return;

    // Only auto-fill once — if game already active, seats are already registered
    if (state.status === 'active') return;

    if (matchData.gameType === 'PVE') {
      for (let i = 2; i <= 4; i++) {
        const slotUserId = matchData[`player${i}_id`];
        if (!slotUserId || !isBotUserId(slotUserId)) continue;

        const slotColor = SLOT_COLORS[i - 1];
        const botUserId = `${BOT_PREFIX}${slotColor}`;

        // Mark bot player as active and populate frontend-compatible metadata
        const player = state.players.find(p => p.color === slotColor);
        if (player) {
          player.status = 'active';
          player.username = botUserId;
          player.isBot = true;
          player.isConnected = true;
        }

        // Register in userIdMap
        if (!this.userIdMap.has(gameId)) {
          this.userIdMap.set(gameId, new Map());
        }
        this.userIdMap.get(gameId)!.set(slotColor, botUserId);

        // Instantiate bot
        this.getOrCreateBot(gameId, slotColor, this.engine, this.store);
      }
    }

    // Every seat that has actually joined (human, local hotseat seat, or bot
    // just registered above) is auto-ready — there's nobody real left to wait on.
    for (const p of state.players) {
      if (p.status === 'active' && !state.readyPlayers.includes(p.color)) {
        state.readyPlayers.push(p.color);
      }
    }

    await this.store.saveGameState(gameId, state);

    // Hotseat must wait for every local seat to have joined (they join one at
    // a time, via separate join_game calls on the same socket) before
    // starting — otherwise it'd fire after just the first seat.
    const expectedSeats = matchData.gameType === 'HOTSEAT' ? parseInt(matchData.playerCount || '2', 10) : 0;
    const activePlayers = state.players.filter(p => p.status === 'active');
    const allJoined = activePlayers.length >= expectedSeats;
    const allReady = activePlayers.length > 0 &&
      activePlayers.every(p => state.readyPlayers.includes(p.color));

    if (allJoined && allReady && state.status === 'waiting') {
      state.currentTurn = firstActiveColor(state) ?? state.currentTurn;
      state.status = 'active';
      await this.store.saveGameState(gameId, state);
      this.engine.emitEvent({ type: 'game_started', gameId });
    }
  }
}
