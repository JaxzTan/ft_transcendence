import { Server } from 'socket.io';
import * as http from 'http';
import { LudoEngine } from '../engine';
import { RedisGameStore } from '../redis';
import { ClashManager } from '../clash';
import { getOrCreateBot, isBotPlayer } from '../bot';
import { EventPublisher } from './event-publisher';
import { RedisBroadcaster } from './redis-broadcaster';
import { ResultSubmitter } from './result-submitter';
import { SocketHandlers } from './socket-handlers';
import { verifyToken, GameSocket, BOT_ID } from './auth';
import { LobbyManager } from '../lobby';
import type { PlayerColor } from '../types';

const LOBBY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
const POST_GAME_TIMEOUT_MS = 60 * 1000; // 60 seconds

/**
 * SocketServer orchestrates the ludo engine, socket connections,
 * Redis pub/sub, bot management, and game lifecycle.
 *
 * Business logic for each socket event lives in SocketHandlers.
 */
export class SocketServer {
	private io!: Server;
	private httpServer!: http.Server;
	private store: RedisGameStore;
	private engine: LudoEngine;
	private clashManager: ClashManager;
	private publisher: EventPublisher;
	private broadcaster: RedisBroadcaster;
	private resultSubmitter: ResultSubmitter;
	private handlers: SocketHandlers;
  private userIdMap: Map<string, Map<PlayerColor, string>> = new Map();
  private rematchVotes: Map<string, Set<string>> = new Map();
	private gameEndedAt: Map<string, number> = new Map();
	private gameCreatedAt: Map<string, number> = new Map();

	constructor() {
		this.store = new RedisGameStore();
		this.publisher = new EventPublisher(this.store);
		this.clashManager = new ClashManager(this.store, this.publisher);
		this.engine = new LudoEngine(this.store, this.clashManager);
		const lobbyManager = new LobbyManager(this.store, this.publisher);
		this.engine.setLobbyManager(lobbyManager);
		this.broadcaster = new RedisBroadcaster();
		this.resultSubmitter = new ResultSubmitter(
			this.engine, this.store, this.userIdMap,
			(gameId) => this.cleanupGame(gameId),
		);
		this.handlers = new SocketHandlers(
			this.store, this.engine, this.clashManager,
			this.userIdMap, getOrCreateBot,
		);

		// Wire up engine events — single source of truth for game lifecycle
		this.engine.onEvent((event) => {
			this.publisher.publish(event);

			if (event.type === 'game_ended') {
				this.handleGameEnd(event.gameId);
			} else if (event.type === 'game_started') {
				this.triggerBotTurn(event.gameId);
			} else if (event.type === 'piece_moved') {
				this.triggerBotTurn(event.gameId);
			} else if (event.type === 'dice_rolled') {
				// Only trigger bot turn if no legal moves (turn auto-advanced)
				if (event.legalMoves.length === 0) {
					this.triggerBotTurn(event.gameId);
				}
			}
		});
	}

	async start(port: number): Promise<void> {
		await this.store.connect();

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

		this.broadcaster.start(this.io);
		this.setupSocketHandlers();

		this.httpServer.listen(port, () => {
			console.log(`Ludo engine listening on port ${port}`);
		});

		// Periodic check for expired lobbies
		setInterval(() => this.checkExpiredLobbies(), 60_000);
	}

	async stop(): Promise<void> {
		await this.store.disconnect();
		await this.broadcaster.disconnect();
		this.httpServer.close();
	}

	/**
	 * If the current turn belongs to a bot, execute its turn immediately.
	 * Runs inside the queue so it's serialized with human moves and cannot overlap.
	 */
	private triggerBotTurn(gameId: string): void {
		this.store.loadGameState(gameId).then(state => {
			if (!state || state.status !== 'active') return;
			if (!isBotPlayer(this.userIdMap, gameId, state.currentTurn)) return;

			const bot = getOrCreateBot(gameId, state.currentTurn, this.engine, this.store);
			bot.takeTurn();
			// Bonus roll / capture chains emit piece_moved -> handleEngineEvent -> triggerBotTurn again
		});
	}

  private cleanupGame(gameId: string): void {
    this.userIdMap.delete(gameId);
    this.rematchVotes.delete(gameId);
    this.gameEndedAt.delete(gameId);
    this.gameCreatedAt.delete(gameId);
  }

	// ─── Post-game lifecycle ───────────────────────────────────────────────────

	private handleGameEnd(gameId: string): void {
		this.gameEndedAt.set(gameId, Date.now());

		// Auto-timeout after POST_GAME_TIMEOUT_MS if no rematch
		setTimeout(() => {
			const votes = this.rematchVotes.get(gameId);
			if (!votes || votes.size < 2) {
				this.io.to(gameId).emit('game_timeout');
				this.cleanupGame(gameId);
			}
		}, POST_GAME_TIMEOUT_MS);
	}

	private async handleRematch(socket: GameSocket): Promise<void> {
		const gameId = socket.data.gameId;
		const userId = socket.data.userId;
		if (!gameId || !userId) return;

		// Track vote
		if (!this.rematchVotes.has(gameId)) {
			this.rematchVotes.set(gameId, new Set());
		}
		this.rematchVotes.get(gameId)!.add(userId);

		// Check if at least 2 players voted for rematch
		if (this.rematchVotes.get(gameId)!.size >= 2) {
			// Create new game with only rematching players
			const newGameId = `${gameId}-rematch`;
			await this.store.createGame(newGameId, true);

			// Transfer players who voted
			const voters = this.rematchVotes.get(gameId)!;
			for (const [color, uid] of (this.userIdMap.get(gameId) || [])) {
				if (voters.has(uid)) {
					socket.join(newGameId);
					// Update userIdMap for new game
					if (!this.userIdMap.has(newGameId)) {
						this.userIdMap.set(newGameId, new Map());
					}
					this.userIdMap.get(newGameId)!.set(color, uid);
				}
			}

			this.cleanupGame(gameId);
			this.io.to(newGameId).emit('game_created', newGameId);
		}
	}

	private handleExitPostGame(socket: GameSocket): void {
		const gameId = socket.data.gameId;
		const userId = socket.data.userId;
		if (!gameId || !userId) return;

		// Remove from rematch votes if present
		this.rematchVotes.get(gameId)?.delete(userId);

		// Check if quorum is broken (fewer than 2 voters remain)
		const votes = this.rematchVotes.get(gameId);
		if (!votes || votes.size < 2) {
			this.io.to(gameId).emit('game_timeout');
			this.cleanupGame(gameId);
		}
	}

	private async checkExpiredLobbies(): Promise<void> {
		const now = Date.now();
		for (const [gameId, createdAt] of this.gameCreatedAt) {
			if (now - createdAt > LOBBY_TIMEOUT_MS) {
				const state = await this.store.loadGameState(gameId);
				if (state && state.status === 'waiting') {
					this.io.to(gameId).emit('game_expired');
					this.cleanupGame(gameId);
				}
			}
		}
	}

	// ─── Socket wiring (orchestration only) ────────────────────────────────────

	private setupSocketHandlers(): void {
		this.io.use((socket: GameSocket, next) => {
			const token = socket.handshake.auth?.token;
			if (!token) return next(); // Allow unauthenticated (bots, dev)

			const payload = verifyToken(token);
			if (!payload) return next(new Error('Invalid token'));

			socket.data.userId = payload.userId;
			socket.data.gameId = payload.gameId;
			socket.data.role = payload.role as 'player' | 'spectator';
			next();
		});

		this.io.on('connection', (socket: GameSocket) => {
			console.log(`Client connected: ${socket.id}${socket.data.userId ? ` (user: ${socket.data.userId})` : ''}`);

			socket.on('join_game', (gameId: string, playerColor: PlayerColor, userId?: string) =>
				this.handlers.handleJoinGame(socket, gameId, playerColor, userId));

			socket.on('roll_dice', () =>
				this.handlers.handleRollDice(socket));

			socket.on('move_piece', (pieceId) =>
				this.handlers.handleMovePiece(socket, pieceId));

			socket.on('clash_input', (key: string) =>
				this.handlers.handleClashInput(socket, key));

			socket.on('reconnect_clash', () =>
				this.handlers.handleReconnectClash(socket));

			socket.on('player_ready', () =>
				this.handlers.handlePlayerReady(socket));

			socket.on('select_color', (color: string) =>
				this.handlers.handleSelectColor(socket, color));

			socket.on('leave_game', () =>
				this.handlers.handleLeaveGame(socket));

			socket.on('resign', () =>
				this.handlers.handleResign(socket));

			socket.on('disconnect', () =>
				this.handlers.handleDisconnect(socket));

			socket.on('rematch', () =>
				this.handleRematch(socket));

			socket.on('exit_post_game', () =>
				this.handleExitPostGame(socket));
		});
	}
}