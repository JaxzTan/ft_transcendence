import { LudoEngine } from '../engine';
import { RedisGameStore } from '../redis';
import { ClashManager } from '../clash';
import { LudoBot } from '../bot';
import { firstActiveColor } from '../player-handler';
import { GameSocket, isBotUserId, BOT_PREFIX } from './auth';
import type { PlayerColor, PieceId } from '../types';

const SLOT_COLORS: PlayerColor[] = ['blue', 'red', 'green', 'yellow'];

export class SocketHandlers {
  // Serializes each game's join_game critical section (load → mutate → save
  // against Redis). Hotseat fires several join_game calls back-to-back on
  // connect (one per local seat); without this, their async load/save cycles
  // interleave and the last save wins, silently dropping the earlier joins.
  private joinLocks = new Map<string, Promise<unknown>>();

  constructor(
    private store: RedisGameStore,
    private engine: LudoEngine,
    private clashManager: ClashManager,
    private userIdMap: Map<string, Map<PlayerColor, string>>,
    private getOrCreateBot: (gameId: string, color: PlayerColor, engine: LudoEngine, store: RedisGameStore) => LudoBot,
    private scheduleBotTurn?: (gameId: string) => void,
    private notifyAbort?: (gameId: string) => void,
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

    this.withGameLock(effectiveGameId, async () => {
      try {
        socket.join(effectiveGameId);
        socket.data.gameId = effectiveGameId;
        socket.data.playerColor = playerColor;

        if (effectiveUserId) {
          if (!this.userIdMap.has(effectiveGameId)) {
            this.userIdMap.set(effectiveGameId, new Map());
          }
          this.userIdMap.get(effectiveGameId)!.set(playerColor, effectiveUserId);
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
          // Clash mode follows the match's clashEnabled flag (set by the host's
          // lobby toggle) rather than being hardcoded on — the engine gate in
          // movePiece checks state.clashMode.
          await this.store.createGame(
            effectiveGameId,
            creationMatchData?.clashEnabled === 'true',
            seatColors,
            creationMatchData?.safeZones !== 'false',
          );
          state = await this.store.loadGameState(effectiveGameId);
        }

        if (state) {
          const discIndex = state.disconnectedPlayers.findIndex(d => d.color === playerColor);
          const isReconnectingPlayer = discIndex !== -1;

          // Socket locking: reject non-spectator, non-reconnecting joins to games already in progress
          if (state.status !== 'waiting' && socket.data.role !== 'spectator' && !isReconnectingPlayer) {
            socket.emit('error', 'Game already in progress — only spectators can join');
            return;
          }

          if (isReconnectingPlayer) {
            await this.engine.handlePlayerReconnect(effectiveGameId, playerColor);
            state = await this.store.loadGameState(effectiveGameId);
            // The player is back on their old seat — tell the room so everyone
            // sees them flip from "Reconnecting…" back to active.
            if (state && !state.disconnectedPlayers.some((d) => d.color === playerColor)) {
              this.engine.emitEvent({ type: 'player_reconnected', gameId: effectiveGameId, color: playerColor });
            }
          } else {
            const player = state.players.find(p => p.color === playerColor);
            if (player) player.status = 'active';
          }

          // Populate PlayerMeta with frontend-compatible fields.
          // `username` is the immutable identity (used for login/avatar/URLs);
          // `displayName` is what the UI actually shows in-game.
          const meta = state.players.find(p => p.color === playerColor);
          if (meta) {
            const resolvedUsername = effectiveUsername || effectiveUserId || (playerColor.charAt(0).toUpperCase() + playerColor.slice(1));
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
          this.getOrCreateBot(effectiveGameId, playerColor, this.engine, this.store);
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

  handleRollDice(socket: GameSocket): void {
    const gameId = socket.data.gameId;
    if (!gameId) {
      socket.emit('error', 'Not in a game');
      return;
    }

    (async () => {
      try {
        if (socket.data.playerColor) {
          const state = await this.store.loadGameState(gameId);
          if (state?.status === 'active' && state.currentTurn !== socket.data.playerColor) {
            socket.emit('error', 'Not your turn');
            return;
          }
        }
        await this.engine.rollDice(gameId);
      } catch (error) {
        socket.emit('error', `Roll failed: ${error}`);
      }
    })();
  }

  handleMovePiece(socket: GameSocket, pieceId: PieceId): void {
    const gameId = socket.data.gameId;
    const color = socket.data.playerColor;
    if (!gameId || !color) {
      socket.emit('error', 'Not in a game');
      return;
    }

    (async () => {
      try {
        const state = await this.store.loadGameState(gameId);
        if (state?.status === 'active') {
          if (state.currentTurn !== color) return;
          const piece = state.pieces.find(p => p.id === pieceId);
          if (!piece || piece.color !== color) return;
        }
        await this.engine.movePiece(gameId, pieceId);
      } catch (error) {
        socket.emit('error', `Move failed: ${error}`);
      }
    })();
  }

  handleClashInput(socket: GameSocket, key: string): void {
    const gameId = socket.data.gameId;
    const color = socket.data.playerColor;
    if (!gameId || !color) return;

    (async () => {
      try {
        const clash = await this.store.loadClashState(gameId);
        if (!clash) return;

        // The pressed KEY decides which side it belongs to (attacker vs
        // defender), then we verify the socket's user owns that seat. In PvP
        // each user owns one seat — only their key works. In hotseat one user
        // owns both seats — the same socket can mash BOTH keys simultaneously.
        const userId = socket.data.userId;
        const attackerUser = this.userIdMap.get(gameId)?.get(clash.attacker);
        const defenderUser = this.userIdMap.get(gameId)?.get(clash.defender);
        const ownsAttacker = userId ? attackerUser === userId : clash.attacker === color;
        const ownsDefender = userId ? defenderUser === userId : clash.defender === color;

        let pressColor: PlayerColor | null = null;
        if (key === clash.attackerKey && ownsAttacker) {
          pressColor = clash.attacker;
        } else if (key === clash.defenderKey && ownsDefender) {
          pressColor = clash.defender;
        }
        if (!pressColor) return;

        const count = await this.engine.recordClashPress(gameId, pressColor, key);
        // Live meter updates flow via the engine's clash_press publish; the
        // per-player ack is no longer needed (clash_press broadcasts to all).
      } catch (error) {
        console.error('Clash input error:', error);
      }
    })();
  }

  handleReconnectClash(socket: GameSocket): void {
    const gameId = socket.data.gameId;
    const color = socket.data.playerColor;
    if (!gameId || !color) return;

    (async () => {
      try {
        await this.clashManager.handleReconnect(gameId, color);
      } catch (error) {
        console.error('Clash reconnect error:', error);
      }
    })();
  }

  handlePlayerReady(socket: GameSocket): void {
    const gameId = socket.data.gameId;
    const color = socket.data.playerColor;
    if (!gameId || !color) {
      socket.emit('error', 'Not in a game');
      return;
    }

    (async () => {
      try {
        await this.engine.handlePlayerReady(gameId, color);
      } catch (error) {
        socket.emit('error', `Ready failed: ${error}`);
      }
    })();
  }

  handleSelectColor(socket: GameSocket, color: string): void {
    const gameId = socket.data.gameId;
    const userId = socket.data.userId;
    if (!gameId || !userId) {
      socket.emit('error', 'Not in a game');
      return;
    }

    (async () => {
      try {
        await this.engine.handlePlayerSelectColor(gameId, userId, color as PlayerColor);
      } catch (error) {
        socket.emit('error', `Color selection failed: ${error}`);
      }
    })();
  }

  handleLeaveGame(socket: GameSocket): void {
    const gameId = socket.data.gameId;
    const color = socket.data.playerColor;
    if (!gameId || !color) return;

    (async () => {
      try {
        const state = await this.store.loadGameState(gameId);
        if (!state) return;

        if (state.status === 'finished') {
          socket.leave(gameId);
        } else if (state.status === 'waiting' || state.status === 'active') {
          await this.engine.handlePlayerExit(gameId, color);
          socket.leave(gameId);
        }
      } catch (error) {
        console.error('Leave game error:', error);
      }
    })();
  }

  handleResign(socket: GameSocket): void {
    const gameId = socket.data.gameId;
    const color = socket.data.playerColor;
    if (!gameId || !color) return;

    (async () => {
      try {
        await this.engine.handlePlayerExit(gameId, color);
      } catch (error) {
        socket.emit('error', `Resign failed: ${error}`);
      }
    })();
  }

  handleDisconnect(socket: GameSocket): void {
    const gameId = socket.data.gameId;
    const color = socket.data.playerColor;
    if (!gameId || !color) return;

    (async () => {
      try {
        await this.engine.handlePlayerDisconnect(gameId, color, this.notifyAbort);
        await this.clashManager.freezeClash(gameId, color);
        // Option U instant disconnect resolve: settle a mid-clash disconnect
        // IMMEDIATELY by meters (A>=D → attacker; A<D → defender) instead of
        // freezing the QTE for the reconnect window.
        await this.engine.resolveClashOnDisconnect(gameId);
      } catch (error) {
        console.error('Disconnect handler error:', error);
      }
    })();
  }
}