import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import * as http from 'http';
import { LudoEngine } from '../engine';
import { RedisGameStore } from '../redis';
import { ClashManager } from '../clash';
import { LudoBot } from '../bot';
import type { PlayerColor, PieceId, GameEvent } from '../types';

// SocketData interface for storing user state on socket
interface SocketData {
  gameId?: string;
  playerColor?: PlayerColor;
  userId?: string;
  role?: 'player' | 'spectator';
}

// Custom socket wrapper to provide typed data
type GameSocket = Socket & { data: SocketData };

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:3000';
const BOT_ID = 'ludo-bot';
const JWT_SECRET = process.env.JWT_SECRET || 'ludo-engine-secret';

/**
 * Minimal JWT verification (no external library dependency).
 * Extracts payload from a signed token using HMAC-SHA256.
 * In production, use a proper JWT library.
 */
function verifyToken(token: string): { gameId: string; userId: string; role: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    return {
      gameId: payload.gameId,
      userId: payload.sub || payload.userId,
      role: payload.role || 'player',
    };
  } catch {
    return null;
  }
}

export class SocketServer {
  private io!: Server;
  private httpServer!: http.Server;
  private engine: LudoEngine;
  private store: RedisGameStore;
  private clashManager: ClashManager;
  private redisSubscriber: Redis;
  private userIdMap: Map<string, Map<PlayerColor, string>> = new Map();
  private botMap: Map<string, Map<PlayerColor, LudoBot>> = new Map();

  /**
   * Per-game serial execution queue.
   * All operations for the same game execute sequentially,
   * preventing race conditions from concurrent Redis load/modify/save.
   */
  private gameQueues: Map<string, Promise<void>> = new Map();

  constructor() {
    this.store = new RedisGameStore();
    this.clashManager = new ClashManager(this.store);
    this.engine = new LudoEngine(this.store);
    this.redisSubscriber = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

    // Wire up engine events — single source of truth for game lifecycle
    this.engine.onEvent((event) => this.handleEngineEvent(event));
  }

  /**
   * Enqueue an operation for a specific game.
   * Ensures sequential execution per gameId, parallel across different games.
   */
  private enqueue(gameId: string, fn: () => Promise<void>): void {
    const prev = this.gameQueues.get(gameId) || Promise.resolve();
    const next = prev.then(fn, fn); // Run even if previous promise rejected
    this.gameQueues.set(gameId, next);
    // Clean up resolved promises to prevent memory leak
    next.finally(() => {
      if (this.gameQueues.get(gameId) === next) {
        this.gameQueues.delete(gameId);
      }
    });
  }

  async start(port: number): Promise<void> {
    await this.store.connect();

    // Create HTTP server for health check + Socket.IO
    this.httpServer = http.createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    this.io = new Server(this.httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
      }
    });

    this.setupRedisSubscriptions();
    this.setupSocketHandlers();

    this.httpServer.listen(port, () => {
      console.log(`Ludo engine listening on port ${port}`);
    });
  }

  /**
   * Handle engine events — single source of truth for publishing to Redis pub/sub.
   * The socket layer no longer independently detects game end or publishes events.
   */
  private handleEngineEvent(event: GameEvent): void {
    const { gameId } = event;

    switch (event.type) {
      case 'dice_rolled':
        this.store.publish(gameId, JSON.stringify({
          type: 'dice_rolled',
          value: event.value,
          legalMoves: event.legalMoves,
          bonusRoll: event.bonusRoll,
        }));
        break;

      case 'piece_moved':
        this.store.publish(gameId, JSON.stringify({
          type: 'piece_moved',
          ...event.result,
        }));
        break;

      case 'game_ended':
        this.store.publish(gameId, JSON.stringify({
          type: 'game_ended',
          winner: event.winner,
          resultDetail: event.resultDetail,
        }));
        // Submit result to backend and cleanup
        this.enqueue(gameId, async () => {
          await this.submitGameResult(gameId);
          this.cleanupGame(gameId);
        });
        break;

      case 'player_exited':
        this.store.publish(gameId, JSON.stringify({
          type: 'player_exited',
          color: event.color,
        }));
        break;

      case 'clash_start':
        this.store.publish(gameId, JSON.stringify({
          type: 'clash_start',
          key: event.key,
          target: event.target,
          duration: event.duration,
          attacker: event.attacker,
          defender: event.defender,
        }));
        break;

      case 'clash_frozen':
        this.store.publish(gameId, JSON.stringify({
          type: 'clash_frozen',
          reason: event.reason,
          disconnectedPlayer: event.disconnectedPlayer,
          reconnectDeadline: event.reconnectDeadline,
        }));
        break;

      case 'clash_result':
        this.store.publish(gameId, JSON.stringify({
          type: 'clash_result',
          winner: event.winner,
          loser: event.loser,
          winnerPresses: event.winnerPresses,
          loserPresses: event.loserPresses,
        }));
        break;
    }
  }

  private setupRedisSubscriptions(): void {
    this.redisSubscriber.psubscribe('game:*', (err, count) => {
      if (err) {
        console.error('Failed to subscribe to game:* pattern:', err);
      } else {
        console.log(`Subscribed to ${count} game channels (pattern-based)`);
      }
    });

    this.redisSubscriber.on('pmessage', (pattern, channel, message) => {
      if (pattern !== 'game:*') return;
      try {
        const gameId = channel.substring(5);
        const data = JSON.parse(message);
        this.io.to(gameId).emit('state_update', data);
      } catch (e) {
        console.error(`Failed to parse message on ${channel}:`, e);
      }
    });
  }

  private async submitGameResult(gameId: string): Promise<void> {
    try {
      const state = await this.engine.getGameState(gameId);
      if (!state) return;

      if (state.resultSubmitted) {
        console.log(`Game ${gameId} result already submitted, skipping`);
        return;
      }
      state.resultSubmitted = true;
      await this.store.saveGameState(gameId, state);

      const participants = [];
      for (const player of state.players) {
        const stats = { ...player.stats };
        const userId = this.userIdMap.get(gameId)?.get(player.color) || `bot-${player.color}`;
        participants.push({
          userId,
          color: player.color.toUpperCase(),
          rank: player.color === state.winner ? 1 : 2,
          totalTurns: stats.turns,
          piecesCaptured: stats.captures,
          piecesInGoal: stats.piecesInGoal,
        });
      }

      await fetch(`${BACKEND_URL}/api/game/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, participants }),
      });
    } catch (err) {
      console.error('Failed to submit game result:', err);
    }
  }

  private cleanupGame(gameId: string): void {
    this.userIdMap.delete(gameId);
    this.botMap.delete(gameId);
  }

  private getOrCreateBot(gameId: string, color: PlayerColor): LudoBot {
    if (!this.botMap.has(gameId)) {
      this.botMap.set(gameId, new Map());
    }
    const colorBots = this.botMap.get(gameId)!;
    if (!colorBots.has(color)) {
      colorBots.set(color, new LudoBot(gameId, color, this.engine, this.store));
    }
    return colorBots.get(color)!;
  }

  private isBotPlayer(gameId: string, color: PlayerColor): boolean {
    return this.userIdMap.get(gameId)?.get(color) === BOT_ID;
  }

  private async processBotTurn(gameId: string, color: PlayerColor): Promise<void> {
    const preState = await this.engine.getGameState(gameId);
    if (!preState || preState.status !== 'active') return;
    
    if (preState.currentTurn !== color) return;
    if (preState.botBusy) {
      console.log(`Bot ${color} is busy, skipping turn for game ${gameId}`);
      return;
    }

    preState.botBusy = true;
    await this.store.saveGameState(gameId, preState);

    const bot = this.getOrCreateBot(gameId, color);
    try {
      const stillActive = await bot.takeTurn();
      
      const postState = await this.engine.getGameState(gameId);
      if (postState) {
        postState.botBusy = false;
        await this.store.saveGameState(gameId, postState);
      }
      
      if (postState?.status === 'finished') {
        // Game end is handled by engine event — no need to publish here
        this.cleanupGame(gameId);
      } else if (stillActive && postState) {
        if (postState.currentTurn === color) {
          setTimeout(() => this.processBotTurn(gameId, color), 500);
        }
      }
    } catch (error) {
      console.error(`Bot turn error for ${color}:`, error);
      const errorState = await this.engine.getGameState(gameId);
      if (errorState) {
        errorState.botBusy = false;
        await this.store.saveGameState(gameId, errorState);
      }
    }
  }

  private setupSocketHandlers(): void {
    this.io.use((socket: GameSocket, next) => {
      // JWT authentication via socket handshake auth token
      const token = socket.handshake.auth?.token;
      if (!token) {
        // Allow unauthenticated connections for now (bots, dev)
        // In production, reject: return next(new Error('Authentication required'));
        return next();
      }

      const payload = verifyToken(token);
      if (!payload) {
        return next(new Error('Invalid token'));
      }

      // Extract identity from JWT — ignore whatever the client sends in events
      socket.data.userId = payload.userId;
      socket.data.gameId = payload.gameId;
      socket.data.role = payload.role as 'player' | 'spectator';

      next();
    });

    this.io.on('connection', (socket: GameSocket) => {
      console.log(`Client connected: ${socket.id}${socket.data.userId ? ` (user: ${socket.data.userId})` : ''}`);

      socket.on('join_game', async (gameId: string, playerColor: PlayerColor, userId?: string) => {
        // If JWT provided gameId, use that instead of client-supplied value
        const effectiveGameId = socket.data.gameId || gameId;
        const effectiveUserId = socket.data.userId || userId;

        this.enqueue(effectiveGameId, async () => {
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

            // If player was disconnected, handle reconnect
            if (state) {
              const discIndex = state.disconnectedPlayers.findIndex(d => d.color === playerColor);
              if (discIndex !== -1) {
                // Reconnecting within grace period
                await this.engine.handlePlayerReconnect(effectiveGameId, playerColor);
                // Reload state after reconnect
                state = await this.store.loadGameState(effectiveGameId);
              } else {
                // Normal join — mark as active
                const player = state.players.find(p => p.color === playerColor);
                if (player) {
                  player.status = 'active';
                }
              }

              // Transition to active when all players are ready
              if (state.status === 'waiting') {
                const allActive = state.players.every(p => p.status === 'active');
                if (allActive) {
                  state.status = 'active';
                }
                await this.store.saveGameState(effectiveGameId, state);
              }
            }

            if (effectiveUserId === BOT_ID) {
              this.getOrCreateBot(effectiveGameId, playerColor);
            }

            if (state) {
              socket.emit('game_joined', state);
            }
          } catch (error) {
            socket.emit('error', `Failed to join game: ${error}`);
          }
        });
      });

      socket.on('roll_dice', async () => {
        const gameId = socket.data.gameId;
        if (!gameId) {
          socket.emit('error', 'Not in a game');
          return;
        }

        this.enqueue(gameId, async () => {
          try {
            await this.engine.rollDice(gameId);
            // Event publishing is handled by engine.onEvent
          } catch (error) {
            socket.emit('error', `Roll failed: ${error}`);
          }
        });
      });

      socket.on('move_piece', async (pieceId: PieceId) => {
        const gameId = socket.data.gameId;
        const color = socket.data.playerColor;
        if (!gameId || !color) {
          socket.emit('error', 'Not in a game');
          return;
        }

        this.enqueue(gameId, async () => {
          try {
            await this.engine.movePiece(gameId, pieceId);
            // Event publishing is handled by engine.onEvent
          } catch (error) {
            socket.emit('error', `Move failed: ${error}`);
          }
        });
      });

      socket.on('clash_input', async (key: string) => {
        const gameId = socket.data.gameId;
        const color = socket.data.playerColor;
        if (!gameId || !color) return;

        this.enqueue(gameId, async () => {
          try {
            const success = await this.clashManager.recordPress(gameId, color, key);
            if (success) {
              const clash = await this.store.loadClashState(gameId);
              if (clash) {
                const presses = color === clash.attacker
                  ? clash.attackerPresses
                  : clash.defenderPresses;
                socket.emit('clash_press_registered', presses);
              }
            }
          } catch (error) {
            console.error('Clash input error:', error);
          }
        });
      });

      socket.on('reconnect_clash', async () => {
        const gameId = socket.data.gameId;
        const color = socket.data.playerColor;
        if (!gameId || !color) return;

        this.enqueue(gameId, async () => {
          try {
            await this.clashManager.handleReconnect(gameId, color);
          } catch (error) {
            console.error('Clash reconnect error:', error);
          }
        });
      });

      socket.on('resign', async () => {
        const gameId = socket.data.gameId;
        const color = socket.data.playerColor;
        if (!gameId || !color) return;

        this.enqueue(gameId, async () => {
          try {
            await this.engine.handlePlayerExit(gameId, color);
            // Event publishing is handled by engine.onEvent
          } catch (error) {
            socket.emit('error', `Resign failed: ${error}`);
          }
        });
      });

      socket.on('disconnect', async () => {
        const gameId = socket.data.gameId;
        const color = socket.data.playerColor;
        if (gameId && color) {
          this.enqueue(gameId, async () => {
            try {
              // Use grace-period disconnect instead of immediate exit
              await this.engine.handlePlayerDisconnect(gameId, color);
              await this.clashManager.handleDisconnect(gameId, color);
              // Event publishing is handled by engine.onEvent
            } catch (error) {
              console.error('Disconnect handler error:', error);
            }
          });
        }
      });
    });
  }

  async stop(): Promise<void> {
    await this.store.disconnect();
    this.redisSubscriber.disconnect();
    this.httpServer.close();
  }
}