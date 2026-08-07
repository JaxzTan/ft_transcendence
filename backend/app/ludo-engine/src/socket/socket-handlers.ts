import { LudoEngine } from '../engine';
import { RedisGameStore } from '../redis';
import { ClashManager } from '../clash';
import { LudoBot } from '../bot';
import { GameSocket, isBotUserId, BOT_PREFIX } from './auth';
import type { PlayerColor, PieceId } from '../types';

const SLOT_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

export class SocketHandlers {
  constructor(
    private store: RedisGameStore,
    private engine: LudoEngine,
    private clashManager: ClashManager,
    private userIdMap: Map<string, Map<PlayerColor, string>>,
    private getOrCreateBot: (gameId: string, color: PlayerColor, engine: LudoEngine, store: RedisGameStore) => LudoBot,
  ) {}

  handleJoinGame(socket: GameSocket, gameId: string, playerColor: PlayerColor, userId?: string): void {
    const effectiveGameId = socket.data.gameId || gameId;
    const effectiveUserId = socket.data.userId || userId;
    const effectiveUsername = socket.data.username;

    (async () => {
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
          await this.store.createGame(effectiveGameId, true);
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
          } else {
            const player = state.players.find(p => p.color === playerColor);
            if (player) player.status = 'active';
          }

          // Populate PlayerMeta with frontend-compatible fields
          const meta = state.players.find(p => p.color === playerColor);
          if (meta) {
            meta.username = effectiveUsername || effectiveUserId || (playerColor.charAt(0).toUpperCase() + playerColor.slice(1));
            meta.isBot = isBotUserId(effectiveUserId);
            meta.isConnected = true;
            meta.status = 'active';
          }

          if (state.status === 'waiting') {
            await this.store.saveGameState(effectiveGameId, state);
          }
        }

        if (isBotUserId(effectiveUserId)) {
          this.getOrCreateBot(effectiveGameId, playerColor, this.engine, this.store);
        }

        // PvE auto-fill: read match metadata and register bot seats
        const matchData = await this.store.getMatchData(effectiveGameId);
        if (matchData && matchData.gameType === 'PVE') {
          await this.autoRegisterBots(effectiveGameId, matchData);
          // Reload state — autoRegisterBots may have transitioned it to 'active'
          state = await this.store.loadGameState(effectiveGameId);
        }

        if (state) socket.emit('game_joined', state);
      } catch (error) {
        socket.emit('error', `Failed to join game: ${error}`);
      }
    })();
  }

  /**
   * Auto-register bot seats for PvE matches.
   * Reads match metadata and marks bot slots as active/ready.
   */
  private async autoRegisterBots(gameId: string, matchData: Record<string, string>): Promise<void> {
    const state = await this.store.loadGameState(gameId);
    if (!state) return;

    // Only auto-fill once — if game already active, bots are already registered
    if (state.status === 'active') return;

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

      // Add bot to ready players
      if (!state.readyPlayers.includes(slotColor)) {
        state.readyPlayers.push(slotColor);
      }

      // Register in userIdMap
      if (!this.userIdMap.has(gameId)) {
        this.userIdMap.set(gameId, new Map());
      }
      this.userIdMap.get(gameId)!.set(slotColor, botUserId);

      // Instantiate bot
      this.getOrCreateBot(gameId, slotColor, this.engine, this.store);
    }

    // Mark human seat as active too (the joining player)
    const humanColor = state.players.find(p => p.status === 'active')?.color;
    if (humanColor && !state.readyPlayers.includes(humanColor)) {
      state.readyPlayers.push(humanColor);
    }

    await this.store.saveGameState(gameId, state);

    // If all active players are ready, start the game
    const activePlayers = state.players.filter(p => p.status === 'active');
    const allReady = activePlayers.length > 0 &&
      activePlayers.every(p => state.readyPlayers.includes(p.color));

    if (allReady && state.status === 'waiting') {
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
        const success = await this.clashManager.recordPress(gameId, color, key);
        if (success) {
          const clash = await this.store.loadClashState(gameId);
          if (clash) {
            const presses = color === clash.attacker ? clash.attackerPresses : clash.defenderPresses;
            socket.emit('clash_press_registered', presses);
          }
        }
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
        await this.engine.handlePlayerDisconnect(gameId, color);
        await this.clashManager.freezeClash(gameId, color);
      } catch (error) {
        console.error('Disconnect handler error:', error);
      }
    })();
  }
}