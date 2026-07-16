export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';
export type PlayerStatus = 'active' | 'exited';

export interface Piece {
  progress: number; // -1=exited, 0=prison, 1-51=track, 52-56=home, 57=goal
}

export interface PlayerState {
  color: PlayerColor;
  status: PlayerStatus;
  pieces: Piece[];
}

export interface GameState {
  id: string;
  players: PlayerState[];
  currentTurn: PlayerColor;
  currentTurnIndex: number; // 0-3, index into players array
  consecutiveSixes: number;
  clashMode: boolean;
  status: 'waiting' | 'active' | 'finished';
  winner?: PlayerColor;
  resultDetail?: string;
}

export interface MoveResult {
  ply: number;
  color: PlayerColor;
  diceValue: number;
  pieceIndex: number;
  from: number;
  to: number;
  captured: boolean;
  capturedColor?: PlayerColor;
  enteredHome: boolean;
  bonusRoll: boolean;
}

export interface LegalMove {
  pieceIndex: number;
  from: number;
  to: number;
  isCapture: boolean;
  isHomeEntry: boolean;
}

export interface ClashState {
  attacker: PlayerColor;
  defender: PlayerColor;
  attackerKey: string;
  defenderKey: string;
  target: number;
  duration: number;
  startedAt: number;
  attackerPresses: number;
  defenderPresses: number;
}

export interface ClientToServerEvents {
  join_game: (gameId: string, playerColor: PlayerColor) => void;
  roll_dice: () => void;
  move_piece: (pieceIndex: number) => void;
  clash_input: (key: string) => void;
  resign: () => void;
}

export interface ServerToClientEvents {
  game_joined: (state: GameState) => void;
  dice_rolled: (value: number, legalMoves: LegalMove[]) => void;
  piece_moved: (result: MoveResult) => void;
  clash_start: (data: { key: string; target: number; duration: number }) => void;
  clash_result: (data: { winner: PlayerColor; loser: PlayerColor; winnerPresses: number; loserPresses: number }) => void;
  game_ended: (data: { winner?: PlayerColor; resultDetail: string }) => void;
  error: (message: string) => void;
  player_exited: (color: PlayerColor) => void;
  state_update: (data: any) => void;
  clash_press_registered: (count: number) => void;
}