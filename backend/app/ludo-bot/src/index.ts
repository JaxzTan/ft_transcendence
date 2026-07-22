import { io } from 'socket.io-client';

const ENGINE_URL = process.env.ENGINE_URL || 'http://ludo-engine:3001';
const PLAYER_NAME = process.env.PLAYER_NAME || 'Bot';
const PLAYER_COLOR = process.env.PLAYER_COLOR || 'red';

class LudoBot {
  private socket: ReturnType<typeof io>;

  constructor() {
    this.socket = io(ENGINE_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.socket.on('connect', () => {
      console.log(`Bot connected: ${this.socket.id}`);
      this.joinGame();
    });

    this.socket.on('disconnect', () => {
      console.log('Bot disconnected, will reconnect...');
    });

    this.socket.on('game_joined', (state: any) => {
      console.log(`Bot joined game ${state.id}`);
    });

    this.socket.on('dice_rolled', (data: any) => {
      console.log(`Dice rolled: ${data.value}, legal moves: ${data.legalMoves.length}`);
      if (data.legalMoves.length > 0) {
        setTimeout(() => this.makeMove(data.legalMoves), 500);
      }
    });

    this.socket.on('piece_moved', (result: any) => {
      console.log(`Piece ${result.pieceIndex} moved from ${result.from} to ${result.to}`);
    });

    this.socket.on('game_ended', (data: any) => {
      console.log(`Game ended. Winner: ${data.winner}`);
      this.socket.disconnect();
      process.exit(0);
    });

    this.socket.on('error', (message: string) => {
      console.error('Bot error:', message);
    });

    this.socket.on('clash_start', (data: any) => {
      console.log(`Clash started! Press ${data.key} (target: ${data.target})`);
      this.simulateClash(data.target);
    });
  }

  private joinGame(): void {
    const gameId = process.env.GAME_ID;
    if (gameId) {
      this.socket.emit('join_game', gameId, PLAYER_COLOR);
    }
  }

  private makeMove(legalMoves: any[]): void {
    const move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    console.log(`Bot moving piece ${move.pieceIndex}`);
    this.socket.emit('move_piece', move.pieceIndex);
  }

  //Randomly 
  private simulateClash(target: number): void {
    let presses = 0;
    const interval = setInterval(() => {
      presses++;
      this.socket.emit('clash_input', ' ');
      if (presses >= target) {
        clearInterval(interval);
      }
    }, 1000 / 15); // 15 Hz
  }

  start(): void {
    console.log(`Starting Ludo Bot (${PLAYER_NAME}, ${PLAYER_COLOR})...`);
    console.log(`Connecting to engine at ${ENGINE_URL}`);
  }
}

const bot = new LudoBot();
bot.start();