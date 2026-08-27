import { test, expect } from '@playwright/test';
import type { Socket } from 'socket.io-client';
import { connect, probe, rejected, forgeToken, CapturedMessage } from './helpers/socket';

/**
 * BRIEF.md §3.2 "Server authority" — socket-authority test suite.
 *
 * All positional event signatures below are taken from DISCOVERED.md §1
 * (confirmed against backend/app/ludo-engine/src/socket/server.ts and
 * socket-handlers.ts), NOT from the brief's illustrative object-shape
 * snippets, which are documented as wrong.
 *
 *   join_game(gameId, playerColor, userId?, displayName?)
 *   roll_dice()                 -- no args
 *   move_piece(pieceId)
 *
 * Colors are lowercase strings: 'blue' | 'red' | 'green' | 'yellow'.
 */

function uniqueGameId(tag: string): string {
  return `test-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Lightweight event-wait used only for test SETUP synchronization (joining,
 * readying up, confirming game_started) -- not for asserting server
 * behavior. All actual defect assertions in this file go through the
 * required `probe()` / `rejected()` helpers from ../helpers/socket.
 */
function waitForEvent(socket: Socket, event: string, timeoutMs = 5000): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timed out waiting for '${event}'`));
    }, timeoutMs);
    function handler(...args: unknown[]) {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(args);
    }
    socket.on(event, handler);
  });
}

async function rollOnce(socket: Socket): Promise<any> {
  const pending = waitForEvent(socket, 'dice_rolled', 5000);
  socket.emit('roll_dice');
  const [payload] = await pending;
  return payload;
}

async function moveOnce(socket: Socket, pieceId: string): Promise<any | null> {
  const pending = waitForEvent(socket, 'piece_moved', 5000);
  socket.emit('move_piece', pieceId);
  try {
    const [payload] = await pending;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Joins two unauthenticated sockets onto the same fresh gameId as 'blue' and
 * 'yellow', marks both ready, and waits for game_started. Because COLORS
 * order is ['blue','red','green','yellow'] (player-handler.ts
 * firstActiveColor), 'blue' deterministically gets the first turn once the
 * game becomes active.
 */
async function setupActiveGame(gameId: string): Promise<{ a: Socket; b: Socket }> {
  const a = await connect();
  const b = await connect();
  a.emit('join_game', gameId, 'blue', `a-${gameId}`, 'SeatBlue');
  await waitForEvent(a, 'game_joined', 5000);
  b.emit('join_game', gameId, 'yellow', `b-${gameId}`, 'SeatYellow');
  await waitForEvent(b, 'game_joined', 5000);
  const started = waitForEvent(a, 'game_started', 5000);
  a.emit('player_ready');
  b.emit('player_ready');
  await started;
  return { a, b };
}

function closeAll(...sockets: (Socket | undefined | null)[]): void {
  for (const s of sockets) {
    try {
      s?.close();
    } catch {
      // ignore
    }
  }
}

// ─── G-06s ───────────────────────────────────────────────────────────────

test('G-06s: engine rejects a forged JWT @defect @socket', async () => {
  // auth.ts's verifyToken base64url-decodes the payload and never calls
  // jwt.verify() -- no signature check at all. This forges an unsigned
  // {alg:"none"} token per DISCOVERED.md's G-06s root-cause note.
  const forged = forgeToken({ sub: 'forged-user', username: 'attacker' });
  let socket: Socket | null = null;
  let refused = false;
  try {
    socket = await connect({ token: forged });
    // Connected without throwing -- give the server a moment in case it
    // disconnects immediately after accepting (would still count as refusal).
    await new Promise((r) => setTimeout(r, 500));
    refused = !socket.connected;
  } catch {
    refused = true;
  }
  expect(
    refused,
    'connection using a forged/unsigned JWT (alg:none, garbage signature) should be refused or ' +
      'disconnected by the engine, but the socket connected and stayed connected -- verifyToken() ' +
      'never validates the signature (see backend/app/ludo-engine/src/socket/auth.ts).'
  ).toBeTruthy();
  closeAll(socket);
});

// ─── MP-02 ───────────────────────────────────────────────────────────────

test('MP-02: unauthenticated join_game cannot claim an arbitrary seat colour @defect @socket', async () => {
  const gameId = uniqueGameId('mp02');
  const socket = await connect(); // no auth token at all
  const messages = await probe(socket, 'join_game', gameId, 'red', 'attacker', 'Attacker');
  expect(
    rejected(messages),
    `expected an unauthenticated join_game claiming color 'red' with a fabricated userId to be ` +
      `rejected; instead got messages=${JSON.stringify(messages)}. join_game has no auth/ownership ` +
      `check on playerColor (see handleJoinGame in socket-handlers.ts).`
  ).toBeTruthy();
  closeAll(socket);
});

// ─── MP-07 ───────────────────────────────────────────────────────────────

test('MP-07: an occupied seat colour cannot be overwritten by a second socket @defect @socket', async () => {
  const gameId = uniqueGameId('mp07');
  const a = await connect();
  const b = await connect();

  const joinA = await probe(a, 'join_game', gameId, 'green', `seatA-${gameId}`, 'SeatA');
  expect(
    rejected(joinA),
    `socket A's initial join to 'green' should have succeeded but was rejected: ${JSON.stringify(joinA)}`
  ).toBeFalsy();

  const joinB = await probe(b, 'join_game', gameId, 'green', `seatB-${gameId}`, 'SeatB');
  expect(
    rejected(joinB),
    `expected socket B's join_game claiming the already-seated colour 'green' to be rejected; ` +
      `instead got messages=${JSON.stringify(joinB)}. No capacity/ownership check exists on seat ` +
      `colour in handleJoinGame -- B silently overwrites A's seat metadata.`
  ).toBeTruthy();

  closeAll(a, b);
});

// ─── GM-04 ───────────────────────────────────────────────────────────────

test('GM-04: client cannot force a deterministic dice value @defect @socket', async () => {
  test.setTimeout(60000);
  // roll_dice() takes NO arguments (confirmed in DISCOVERED.md / server.ts) --
  // there is no payload channel at all for a client to smuggle a forced
  // value through. What we CAN verify directly is that repeated rolls are
  // not deterministically fixed (i.e. RNG really is server-side and not,
  // say, a wired constant).
  const values: number[] = [];
  const allMessages: CapturedMessage[][] = [];
  const sockets: Socket[] = [];

  for (let i = 0; i < 5; i++) {
    const gameId = uniqueGameId(`gm04-${i}`);
    const { a, b } = await setupActiveGame(gameId);
    sockets.push(a, b);
    const messages = await probe(a, 'roll_dice');
    allMessages.push(messages);
    const diceMsg = messages.find((m) => m.event === 'dice_rolled');
    if (diceMsg) {
      const payload = diceMsg.args[0] as { value: number };
      values.push(payload.value);
    }
  }

  closeAll(...sockets);

  expect(
    values.length,
    `expected 5 successful dice_rolled events across 5 fresh active games, got ${values.length}; ` +
      `messages=${JSON.stringify(allMessages)}`
  ).toBe(5);

  const distinct = new Set(values);
  expect(
    distinct.size,
    `dice values were suspiciously fixed across 5 independent rolls: ${JSON.stringify(values)} ` +
      `(note: a single roll landing on the same value repeatedly by chance is possible but this is ` +
      `checked precisely to distinguish real RNG from a hardcoded value)`
  ).toBeGreaterThan(1);
});

// ─── GM-02 ───────────────────────────────────────────────────────────────

test("GM-02: moving on another seat's turn is rejected @defect @socket", async () => {
  const gameId = uniqueGameId('gm02');
  const { a, b } = await setupActiveGame(gameId);
  // a = 'blue' always gets the first turn (see setupActiveGame). b = 'yellow'
  // attempts to move immediately, without ever rolling and without it being
  // yellow's turn.
  const messages = await probe(b, 'move_piece', 'yellow-0');
  expect(
    rejected(messages),
    `expected socket B ('yellow') moving out of turn (currentTurn is 'blue') to be rejected with ` +
      `positive evidence; instead got messages=${JSON.stringify(messages)}. ` +
      `handleMovePiece's turn-order guard ("if (state.currentTurn !== color) return;") silently ` +
      `returns with no error emitted to the client -- the move is blocked server-side but the ` +
      `client receives no confirmation at all.`
  ).toBeTruthy();
  closeAll(a, b);
});

// ─── GM-03 ───────────────────────────────────────────────────────────────

test("GM-03: moving an opponent's token is rejected or a provable no-op @defect @socket", async () => {
  const gameId = uniqueGameId('gm03');
  const { a, b } = await setupActiveGame(gameId);
  // a = 'blue' holds the current turn. Attempt to move 'red-0' -- a piece
  // that exists (createGame always allocates all 16 pieces) but belongs to
  // a color that isn't a's own seat.
  const messages = await probe(a, 'move_piece', 'red-0');
  const redAdvanced = messages.some(
    (m) => m.event === 'piece_moved' && JSON.stringify(m.args).includes('red-0')
  );
  const pass = rejected(messages) || !redAdvanced;
  expect(
    pass,
    `expected moving piece 'red-0' while seated as 'blue' to be rejected, or provably a no-op (no ` +
      `piece_moved event advancing red-0); instead got messages=${JSON.stringify(messages)}`
  ).toBeTruthy();
  closeAll(a, b);
});

// ─── GM-01 ───────────────────────────────────────────────────────────────

test('GM-01: a move that does not match the rolled legal-move set is rejected @defect @socket', async () => {
  test.setTimeout(60000);
  // Fresh-game constraint: every piece starts at step 0 (prison). On a
  // roll != 6, NO piece has a legal move at all (turn auto-advances
  // immediately), and on a roll == 6, ALL 4 of a color's own pieces are
  // simultaneously legal (each can exit). Neither state alone lets us name
  // an own, real, currently-illegal piece. So: roll (ping-ponging turns
  // between the two seated sockets as non-6 rolls auto-advance the turn)
  // until whoever currently holds the turn has already gotten piece-0 out
  // of prison and then rolls a non-6 -- at that instant piece-0 is the ONLY
  // legal move (the other three own pieces are still stuck in prison
  // needing a 6). We then deliberately move a different own piece that has
  // no legal move for the rolled value.
  //
  // A single active game + a single pair of sockets is reused for the
  // whole ping-pong (rather than reconnecting per attempt) to avoid
  // hammering the server with rapid repeat connections.
  const gameId = uniqueGameId('gm01');
  const { a, b } = await setupActiveGame(gameId);
  const bySeat: Record<string, Socket> = { blue: a, yellow: b };
  const exited: Record<string, boolean> = { blue: false, yellow: false };

  let currentColor: 'blue' | 'yellow' = 'blue';
  let target: { value: number; legalMoves: { pieceId: string }[] } | undefined;

  for (let i = 0; i < 100 && !target; i++) {
    const socket = bySeat[currentColor];
    const roll = await rollOnce(socket);

    if (roll.forfeited) {
      // Three consecutive sixes: the turn was auto-forfeited to the other seat.
      currentColor = currentColor === 'blue' ? 'yellow' : 'blue';
      continue;
    }

    if (roll.value === 6) {
      // Bonus roll: same seat keeps the turn. Advance/exit our own piece-0
      // specifically so it stays the one and only piece we've moved.
      await moveOnce(socket, `${currentColor}-0`);
      exited[currentColor] = true;
      continue;
    }

    // Non-6 roll.
    if (exited[currentColor] && Array.isArray(roll.legalMoves) && roll.legalMoves.length > 0) {
      target = roll;
      break;
    }
    // No piece out yet -> legalMoves is empty and the server already
    // auto-advanced the turn; roll.currentTurn names the new holder.
    currentColor = roll.currentTurn === 'yellow' ? 'yellow' : 'blue';
  }

  expect(
    target,
    'could not reach a WAITING_FOR_MOVE state with a partial legal-move set (some seat had piece-0 ' +
      'out of prison and rolled non-6) after 100 ping-ponged rolls -- setup logic likely needs ' +
      'revisiting, not the assertion below.'
  ).toBeTruthy();

  const mover = bySeat[currentColor];
  const legalIds = new Set(target!.legalMoves.map((m) => m.pieceId));
  const illegalPieceId = `${currentColor}-1`; // still in prison; has no legal move for this non-6 roll
  expect(
    legalIds.has(illegalPieceId),
    `test setup invariant broken: expected '${illegalPieceId}' to NOT be in the legal-move set ` +
      `${JSON.stringify([...legalIds])} for roll ${target!.value}`
  ).toBeFalsy();

  const messages = await probe(mover, 'move_piece', illegalPieceId);
  expect(
    rejected(messages),
    `expected move_piece('${illegalPieceId}') to be rejected -- it requires a different step count ` +
      `(still in prison, needs a 6) than the rolled value ${target!.value}; legalMoves=` +
      `${JSON.stringify(target!.legalMoves)}; got messages=${JSON.stringify(messages)}`
  ).toBeTruthy();

  closeAll(a, b);
});

// ─── GM-11 ───────────────────────────────────────────────────────────────

test('GM-11: replaying the identical move twice is idempotent @defect @socket', async () => {
  test.setTimeout(60000);
  // A single active game + a single pair of sockets is reused, ping-ponging
  // turns on non-6 rolls (which auto-advance the turn server-side) until
  // whoever currently holds the turn rolls a 6 (guaranteeing a non-empty
  // legal-move set), rather than reconnecting fresh sockets per attempt.
  const gameId = uniqueGameId('gm11');
  const { a, b } = await setupActiveGame(gameId);
  const bySeat: Record<string, Socket> = { blue: a, yellow: b };

  let currentColor: 'blue' | 'yellow' = 'blue';
  let firstRoll: { value: number; legalMoves: { pieceId: string }[] } | undefined;
  let mover: Socket | undefined;

  for (let i = 0; i < 100 && !firstRoll; i++) {
    const socket = bySeat[currentColor];
    const roll = await rollOnce(socket);

    if (roll.forfeited) {
      currentColor = currentColor === 'blue' ? 'yellow' : 'blue';
      continue;
    }
    if (roll.value === 6 && Array.isArray(roll.legalMoves) && roll.legalMoves.length > 0) {
      firstRoll = roll;
      mover = socket;
      break;
    }
    // Non-6 with an empty legal-move set (nothing out of prison yet) --
    // the server already auto-advanced the turn.
    currentColor = roll.currentTurn === 'yellow' ? 'yellow' : 'blue';
  }

  expect(firstRoll, 'could not obtain a roll with a non-empty legal-move set after 100 ping-ponged rolls.').toBeTruthy();

  const pieceId = firstRoll!.legalMoves[0].pieceId;
  const firstMove = await moveOnce(mover!, pieceId);
  expect(
    firstMove,
    `the legitimate first move of '${pieceId}' produced no piece_moved event -- cannot test replay ` +
      `idempotency without a successful baseline move.`
  ).toBeTruthy();

  const replay = await probe(mover!, 'move_piece', pieceId);
  const replayAdvanced = replay.some((m) => m.event === 'piece_moved');
  expect(
    rejected(replay) || !replayAdvanced,
    `replaying move_piece('${pieceId}') a second time in a row must produce zero further ` +
      `state-advancing events, or be explicitly rejected; instead got messages=${JSON.stringify(replay)}`
  ).toBeTruthy();

  closeAll(a, b);
});
