import { LudoEngine } from '../engine';
import { RedisGameStore } from '../redis';
import { ClashManager } from '../clash';
import { LudoBot } from '../bot';
import { GameQueue } from '../game-queue';
import { BOT_ID, GameSocket } from './auth';
import type { PlayerColor, PieceId } from '../types';

/**
 * SocketHandlers contains all the business logic for socket events.
 * Each handler is a method that takes the socket and event arguments,
 * and delegates to the engine, store, clash manager, etc.
 */
export class SocketHandlers {
  constructor(
    private store: RedisGameStore,
    private engine: LudoEngine,
    private clashManager: ClashManager,
    private queue: GameQueue,
    private userIdMap: Map<string, Map<PlayerColor, string>>,
    private getOrCreateBot: (gameId: string, color: PlayerColor) => LudoBot,
  ) {}

  handleJoinGame(socket: GameSocket, gameId: string, playerColor: PlayerColor, userId?: string): void {
    const effectiveGameId = socket.data.gameId || gameId;
    const effectiveUserId = socket.data.userId || userId;

    this.queue.enqueue(effectiveGameId, async () => {
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
          if (discIndex !== -1) {
            await this.engine.handlePlayerReconnect(effectiveGameId, playerColor);
            state = await this.store.loadGameState(effectiveGameId);
          } else {
            const player = state.players.find(p => p.color === playerColor);
            if (player) player.status = 'active';
          }

          // Don't auto-start — player must click ready
          if (state.status === 'waiting') {
            await this.store.saveGameState(effectiveGameId, state);
          }
        }

        if (effectiveUserId === BOT_ID) {
          this.getOrCreateBot(effectiveGameId, playerColor);
        }

        if (state) socket.emit('game_joined', state);
      } catch (error) {
        socket.emit('error', `Failed to join game: ${error}`);
      }
    });
  }

  handleRollDice(socket: GameSocket): void {
    const gameId = socket.data.gameId;
    if (!gameId) {
      socket.emit('error', 'Not in a game');
      return;
    }

    this.queue.enqueue(gameId, async () => {
      try {
        // Early validation: reject out-of-turn rolls
        if (socket.data.playerColor) {
          const state = await this.store.loadGameState(gameId);
          if (state?.status === 'active' && state.currentTurn !== socket.data.playerColor) {
            return;
          }
        }
        await this.engine.rollDice(gameId);
      } catch (error) {
        socket.emit('error', `Roll failed: ${error}`);
      }
    });
  }

  handleMovePiece(socket: GameSocket, pieceId: PieceId): void {
    const gameId = socket.data.gameId;
    const color = socket.data.playerColor;
    if (!gameId || !color) {
      socket.emit('error', 'Not in a game');
      return;
    }

    this.queue.enqueue(gameId, async () => {
      try {
        // Early validation: reject out-of-turn or invalid piece moves
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
    });
  }

  handleClashInput(socket: GameSocket, key: string): void {
    const gameId = socket.data.gameId;
    const color = socket.data.playerColor;
    if (!gameId || !color) return;

    this.queue.enqueue(gameId, async () => {
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
    });
  }

  handleReconnectClash(socket: GameSocket): void {
    const gameId = socket.data.gameId;
    const color = socket.data.playerColor;
    if (!gameId || !color) return;

    this.queue.enqueue(gameId, async () => {
      try {
        await this.clashManager.handleReconnect(gameId, color);
      } catch (error) {
        console.error('Clash reconnect error:', error);
      }
    });
  }

  handlePlayerReady(socket: GameSocket): void {
    const gameId = socket.data.gameId;
    const color = socket.data.playerColor;
    if (!gameId || !color) {
      socket.emit('error', 'Not in a game');
      return;
    }

    this.queue.enqueue(gameId, async () => {
      try {
        await this.engine.handlePlayerReady(gameId, color);
      } catch (error) {
        socket.emit('error', `Ready failed: ${error}`);
      }
    });
  }

  handleLeaveGame(socket: GameSocket): void {
    const gameId = socket.data.gameId;
    const color = socket.data.playerColor;
    if (!gameId || !color) return;

    this.queue.enqueue(gameId, async () => {
      try {
        const state = await this.store.loadGameState(gameId);
        if (!state) return;

        if (state.status === 'finished') {
          // Post-game: treat as exit_post_game
          socket.leave(gameId);
          // The caller (server.ts) will handle exit_post_game logic
        } else if (state.status === 'waiting' || state.status === 'active') {
          // Mid-game or pre-game: forfeit/exit
          await this.engine.handlePlayerExit(gameId, color);
          socket.leave(gameId);
        }
      } catch (error) {
        console.error('Leave game error:', error);
      }
    });
  }

  handleResign(socket: GameSocket): void {
    const gameId = socket.data.gameId;
    const color = socket.data.playerColor;
    if (!gameId || !color) return;

    this.queue.enqueue(gameId, async () => {
      try {
        await this.engine.handlePlayerExit(gameId, color);
      } catch (error) {
        socket.emit('error', `Resign failed: ${error}`);
      }
    });
  }

  handleDisconnect(socket: GameSocket): void {
    const gameId = socket.data.gameId;
    const color = socket.data.playerColor;
    if (!gameId || !color) return;

    this.queue.enqueue(gameId, async () => {
      try {
        await this.engine.handlePlayerDisconnect(gameId, color);
        await this.clashManager.freezeClash(gameId, color);
      } catch (error) {
        console.error('Disconnect handler error:', error);
      }
    });
  }
}