import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { LudoEngine } from '../engine';
import { RedisGameStore } from '../redis';
import { PlayerColor } from '../types';

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:3000';

export class SocketServer {
  private io!: Server;
  private engine: LudoEngine;
  private store: RedisGameStore;
  private redisSubscriber: Redis;
  private userIdMap: Map<string, Map<PlayerColor, string>> = new Map(); // gameId -> (color -> userId)

  constructor() {
    this.store = new RedisGameStore();
    this.engine = new LudoEngine(this.store);
    this.redisSubscriber = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
  }

  async start(port: number): Promise<void> {
    await this.store.connect();
    
    this.io = new Server(port, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
      }
    });

    this.setupRedisSubscriptions();
    this.setupSocketHandlers();

    console.log(`Ludo engine listening on port ${port}`);
  }

  private setupRedisSubscriptions(): void {
    this.redisSubscriber.psubscribe('game:*', (err, channel) => {
      if (err || !channel) return;
      (this.io as any).to(channel).emit('state_update', channel);
    });
  }

  private async submitGameResult(gameId: string): Promise<void> {
    try {
      const state = await this.engine.getGameState(gameId);
      if (!state) return;

      const participants = [];
      for (const player of state.players) {
        const stats = await this.store.getPlayerStats(gameId, player.color);
        const userId = this.userIdMap.get(gameId)?.get(player.color) || `bot-${player.color}`;
        participants.push({
          userId,
          color: player.color.toUpperCase(),
          rank: player.color === state.winner ? 1 : 2, // simplified — engine tracks rank in future
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

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.on('join_game', async (gameId: string, playerColor: PlayerColor, userId?: string) => {
        try {
          socket.join(gameId);
          (socket.data as any).gameId = gameId;
          (socket.data as any).playerColor = playerColor;

          // Track userId mapping
          if (userId) {
            if (!this.userIdMap.has(gameId)) {
              this.userIdMap.set(gameId, new Map());
            }
            this.userIdMap.get(gameId)!.set(playerColor, userId);
          }

          const state = await this.store.getGameState(gameId);
          if (!state) {
            await this.engine.initializeGame(gameId, true);
          }

          await this.engine.addPlayer(gameId, playerColor);

          const gameState = await this.engine.getGameState(gameId);
          if (gameState) {
            socket.emit('game_joined', gameState);
          }
        } catch (error) {
          socket.emit('error', `Failed to join game: ${error}`);
        }
      });

      socket.on('roll_dice', async () => {
        const gameId = (socket.data as any).gameId;
        if (!gameId) {
          socket.emit('error', 'Not in a game');
          return;
        }

        try {
          const result = this.engine.rollDice(gameId);
          await this.store.publish(gameId, JSON.stringify({
            type: 'dice_rolled',
            ...result
          }));
        } catch (error) {
          socket.emit('error', `Roll failed: ${error}`);
        }
      });

      socket.on('move_piece', async (pieceIndex: number) => {
        const gameId = (socket.data as any).gameId;
        const color = (socket.data as any).playerColor;
        if (!gameId || !color) {
          socket.emit('error', 'Not in a game');
          return;
        }

        try {
          const state = await this.store.getGameState(gameId);
          if (!state) throw new Error('Game not found');

          const result = await this.engine.movePiece(gameId, color, pieceIndex, state.consecutiveSixes || 0);
          
          await this.store.publish(gameId, JSON.stringify({
            type: 'piece_moved',
            ...result
          }));

          const updatedState = await this.engine.getGameState(gameId);
          if (updatedState?.status === 'finished') {
            await this.store.publish(gameId, JSON.stringify({
              type: 'game_ended',
              winner: updatedState.winner,
              resultDetail: updatedState.resultDetail
            }));
            // Submit results to backend
            await this.submitGameResult(gameId);
          }
        } catch (error) {
          socket.emit('error', `Move failed: ${error}`);
        }
      });

      socket.on('clash_input', async (key: string) => {
        const gameId = (socket.data as any).gameId;
        const color = (socket.data as any).playerColor;
        if (!gameId || !color) return;
        try {
          const count = await this.store.recordClashPress(gameId, color);
          socket.emit('clash_press_registered', count);
        } catch (error) {
          console.error('Clash input error:', error);
        }
      });

      socket.on('resign', async () => {
        const gameId = (socket.data as any).gameId;
        const color = (socket.data as any).playerColor;
        if (!gameId || !color) return;
        try {
          await this.engine.handlePlayerExit(gameId, color);
          await this.store.publish(gameId, JSON.stringify({
            type: 'player_exited',
            color
          }));
        } catch (error) {
          socket.emit('error', `Resign failed: ${error}`);
        }
      });

      socket.on('disconnect', async () => {
        const gameId = (socket.data as any).gameId;
        const color = (socket.data as any).playerColor;
        if (gameId && color) {
          try {
            await this.engine.handlePlayerExit(gameId, color);
            await this.store.publish(gameId, JSON.stringify({
              type: 'player_exited',
              color
            }));
          } catch (error) {
            console.error('Disconnect handler error:', error);
          }
        }
      });
    });
  }

  async stop(): Promise<void> {
    await this.store.disconnect();
    this.redisSubscriber.disconnect();
  }
}