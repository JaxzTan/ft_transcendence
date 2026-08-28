import { GameState, PlayerColor, LegalMove, MoveResult, MovePieceOutput, PieceId, GameEvent, ClashState, ClashPhase } from './types';
import { RedisGameStore } from './redis';
import { MoveValidator } from './move-validator';
import { ClashManager, CLASH_ANNOUNCE_MS, CLASH_COUNTDOWN_MS, CLASH_PRESS_MS, CLASH_SWEEP_GRACE_MS, CLASH_TARGET, CLASH_RESULT_FREEZE_MS, CLASH_BOT_WIN_MS_BASE, CLASH_BOT_LOSE_MS_BASE, CLASH_BOT_JITTER_MS, CLASH_BOT_VS_BOT_WIN_CHANCE, CLASH_BOT_VS_HUMAN_WIN_CHANCE } from './clash';
import { advanceTurnInState } from './player-handler';
import {
  handlePlayerDisconnect,
  handlePlayerReconnect,
  handlePlayerReady,
  handlePlayerExit,
} from './player-handler';
import { LobbyManager } from './lobby';

export class LudoEngine {
  private store: RedisGameStore;
  private eventHandler?: (event: GameEvent) => void;
  private clashManager: ClashManager;
  private lobbyManager?: LobbyManager;
  // Serializes one game's operations so roll/move/etc. never run on top of
  // each other (a bot acting at the same time as a human would otherwise
  // both load the same state and one move gets lost).
  private gameLocks = new Map<string, Promise<unknown>>();
  // One timeout per live clash — resolves by most-presses once the window ends
  private clashTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(store: RedisGameStore, clashManager: ClashManager) {
    this.store = store;
    this.clashManager = clashManager;
  }

  setLobbyManager(lobbyManager: LobbyManager): void {
    this.lobbyManager = lobbyManager;
  }

  /**
   * Register a callback for game lifecycle events.
   * This is the single source of truth — the socket layer should NOT
   * independently detect game end, publish events, etc.
   */
  onEvent(handler: (event: GameEvent) => void): void {
    this.eventHandler = handler;
  }

  private emit(event: GameEvent): void {
    this.eventHandler?.(event);
  }

  /** Public wrapper for emitting engine events (used by socket handlers). */
  emitEvent(event: GameEvent): void {
    this.emit(event);
  }

  /**
   * Serialize a mutating operation per game. Follows the same promise-chain
   * pattern as SocketHandlers.joinLocks; the next operation for a game only
   * starts after the previous one resolved (or rejected) against Redis.
   */
  private withGameLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.gameLocks.get(gameId) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    this.gameLocks.set(gameId, run.then(() => undefined, () => undefined));
    return run;
  }

  async getGameState(gameId: string): Promise<GameState | null> {
    return await this.store.loadGameState(gameId);
  }

  /**
   * Roll dice for the current player.
   * Sets turnPhase to WAITING_FOR_MOVE and stores pendingLegalMoves and pendingDiceValue.
   * Handles zero legal moves by advancing turn automatically (with bonus roll on 6).
   */
  async rollDice(gameId: string): Promise<{ value: number; legalMoves: LegalMove[]; bonusRoll: boolean }> {
    return this.withGameLock(gameId, async () => {
    const state = await this.store.loadGameState(gameId);
    if (!state || state.status !== 'active') {
      throw new Error('Game not active');
    }

    // Result-card freeze: no input while the 3s clash card is up.
    if (state.resultCardUntil && Date.now() < state.resultCardUntil) {
      console.log(`[clash] ROLL BLOCKED ${gameId} (until ${state.resultCardUntil})`);
      throw new Error('Clash result in progress — wait for the card to clear');
    }

    // Only allow roll during WAITING_FOR_ROLL phase
    if (state.turnPhase !== 'WAITING_FOR_ROLL' && state.turnPhase !== undefined) {
      throw new Error('Invalid turn phase: expected WAITING_FOR_ROLL');
    }

    const currentPlayer = state.players.find(p => p.color === state.currentTurn);
    if (!currentPlayer || currentPlayer.status === 'exited') {
      throw new Error('Current player has exited');
    }

    const diceValue = Math.floor(Math.random() * 6) + 1;

    currentPlayer.hasRolled = true;
    // Per-player 6-streak (classic rule): every 6 grants a bonus roll; the
    // third consecutive 6 within one turn-holding streak forfeits the turn.
    // The streak lives on PlayerMeta so it resets on turn advance and can
    // never leak across players.
    currentPlayer.consecutiveSixes = diceValue === 6 ? currentPlayer.consecutiveSixes + 1 : 0;

    if (diceValue === 6) {
      if (currentPlayer.consecutiveSixes >= 3) {
        currentPlayer.consecutiveSixes = 0;
        currentPlayer.bonusRoll = false;
        state.turnPhase = 'WAITING_FOR_ROLL';
        state.pendingLegalMoves = [];
        state.pendingDiceValue = undefined;
        state.pendingIsFirstRoll = undefined;
        advanceTurnInState(state);
        await this.store.saveGameState(gameId, state);
        this.emit({ type: 'dice_rolled', gameId, value: diceValue, legalMoves: [], bonusRoll: false, currentTurn: state.currentTurn, forfeited: true });
        return { value: diceValue, legalMoves: [], bonusRoll: false };
      }
    }

    const sixBonus = diceValue === 6;
    currentPlayer.bonusRoll = sixBonus;

    const legalMoves = MoveValidator.getLegalMoves(state, state.currentTurn, diceValue);

    // Store authoritative dice value so movePiece() doesn't need to recompute it
    state.pendingDiceValue = diceValue;

    if (legalMoves.length === 0) {
      // No legal moves: auto-advance turn (with bonus roll only on a first-roll 6)
      state.pendingLegalMoves = [];
      if (sixBonus) {
        state.turnPhase = 'WAITING_FOR_ROLL';
      } else {
        state.turnPhase = 'WAITING_FOR_ROLL';
        advanceTurnInState(state);
      }
      await this.store.saveGameState(gameId, state);
      this.emit({ type: 'dice_rolled', gameId, value: diceValue, legalMoves: [], bonusRoll: sixBonus, currentTurn: state.currentTurn });
      return { value: diceValue, legalMoves: [], bonusRoll: sixBonus };
    }

    // Set turn phase and store pending legal moves (server-authoritative)
    state.turnPhase = 'WAITING_FOR_MOVE';
    state.pendingLegalMoves = legalMoves;

    await this.store.saveGameState(gameId, state);

    this.emit({ type: 'dice_rolled', gameId, value: diceValue, legalMoves, bonusRoll: sixBonus, currentTurn: state.currentTurn });
    return { value: diceValue, legalMoves, bonusRoll: sixBonus };
    });
  }

  /**
   * Move a piece. Validates against pendingLegalMoves for server-authoritativeness.
   * Uses pendingDiceValue from state instead of requiring it as a parameter.
   * Returns both the MoveResult and the updated GameState to avoid extra Redis loads.
   * Emits game lifecycle events as the single source of truth.
   */
  async movePiece(gameId: string, pieceId: PieceId): Promise<MovePieceOutput> {
    return this.withGameLock(gameId, async () => {
    const state = await this.store.loadGameState(gameId);
    if (!state || state.status !== 'active') {
      throw new Error('Game not active');
    }

    // Result-card freeze: no input while the 3s clash card is up.
    if (state.resultCardUntil && Date.now() < state.resultCardUntil) {
      console.log(`[clash] MOVE BLOCKED ${gameId} (until ${state.resultCardUntil})`);
      throw new Error('Clash result in progress — wait for the card to clear');
    }

    // Validate: must be in WAITING_FOR_MOVE phase
    if (state.turnPhase !== 'WAITING_FOR_MOVE') {
      throw new Error('Invalid turn phase: expected WAITING_FOR_MOVE');
    }

    // Validate: pieceId must be in pendingLegalMoves (server-authoritative).
    // The legal-move list is a snapshot taken at roll time; a player who was
    // disconnected (turn advanced, pending moves cleared) or forfeited between
    // roll and move is rejected here. We intentionally do NOT re-derive the
    // capture at execution time — the snapshot is the contract, and any
    // post-move capture gating (clash QTE) is a future layer on top of this.
    const pendingMove = state.pendingLegalMoves.find(m => m.pieceId === pieceId);
    if (!pendingMove) {
      throw new Error('Invalid move: piece not in legal moves');
    }

    // Use the server-authoritative dice value
    const diceValue = state.pendingDiceValue;
    if (diceValue === undefined) {
      throw new Error('No pending dice value — roll first');
    }

    const moverColor = (state.pieces.find(p => p.id === pieceId)?.color) as PlayerColor;

    // Clash gate: when clash mode is on, a would-be capture is deferred to the
    // QTE — the move is NOT applied until the clash resolves (attacker wins the
    // capture, defender wins/tie keeps the square).
    if (state.clashMode && pendingMove.isCapture) {
      // Discover the ACTUAL defender via the SHARED track position (raw per-color
      // `step` equality is wrong — two colors at the same step are on different
      // squares). findPiecesAtPosition uses toTrackPosition, mirroring
      // isCapturableTarget so the detection path can never drift from execution.
      const capturedPieceIds = MoveValidator.findPiecesAtPosition(state, moverColor, pendingMove.to);
      // A clash is only valid with an actual defender on the square. If the
      // snapshot is empty/defender-less, fall through to a normal capture move.
      const defenderPiece = state.pieces.find(p => p.id === capturedPieceIds[0]);
      if (defenderPiece) {
        const defenderColor = defenderPiece.color as PlayerColor;

        state.pendingCapture = {
          pieceId,
          from: pendingMove.from,
          to: pendingMove.to,
          diceValue,
          attacker: moverColor,
          defender: defenderColor,
          capturedPieceIds,
          enteredHome: pendingMove.isHomeEntry,
        };
        state.pendingLegalMoves = [];
        state.pendingDiceValue = undefined;
        state.pendingIsFirstRoll = undefined;
        await this.store.saveGameState(gameId, state);

        const attackerIsBot = state.players.find(p => p.color === moverColor)?.isBot ?? false;
        const defenderIsBot = state.players.find(p => p.color === defenderColor)?.isBot ?? false;

        await this.startClash(gameId, moverColor, defenderColor, attackerIsBot, defenderIsBot);

        // Deferred — no piece_moved yet; the clash outcome emits it afterwards.
        return {
          result: {
            ply: state.moveCounter + 1,
            color: moverColor,
            diceValue,
            pieceId,
            from: pendingMove.from,
            path: [],
            to: pendingMove.to,
            captured: true,
            capturedPieceIds: [],
            enteredHome: pendingMove.isHomeEntry,
            bonusRoll: false,
          },
          state,
        };
      }
    }

    // Execute move via MoveValidator (pure game logic)
    const result = MoveValidator.executeMove(state, pendingMove, diceValue);

    // Sync frontend-compatible piece fields
    const movedPiece = state.pieces.find(p => p.id === pieceId);
    if (movedPiece) {
      movedPiece.isInGoal = result.to === 57;
      movedPiece.isInBase = result.to <= 0;
    }
    if (result.captured && result.capturedPieceIds) {
      for (const id of result.capturedPieceIds) {
        const capturedPiece = state.pieces.find(p => p.id === id);
        if (capturedPiece) {
          capturedPiece.isInGoal = false;
          capturedPiece.isInBase = true;
        }
      }
    }

    // Record move history
    await this.store.recordMove(gameId, {
      ply: result.ply,
      color: result.color,
      diceValue: result.diceValue,
      pieceId: result.pieceId,
      from: result.from,
      to: result.to,
      captured: result.captured,
      enteredHome: result.enteredHome,
      timestamp: Date.now()
    });

    // Increment move counter
    state.moveCounter++;

    // Check win
    const winner = MoveValidator.checkWinner(state);
    
    if (winner) {
      const piecesInGoal = MoveValidator.countPiecesInGoal(state, winner);
      const winnerPlayer = state.players.find(p => p.color === winner);
      if (winnerPlayer) {
        winnerPlayer.stats.piecesInGoal = piecesInGoal;
        winnerPlayer.piecesInGoal = piecesInGoal;
        winnerPlayer.isFinished = true;
        winnerPlayer.finishedAt = new Date().toISOString();
      }
      state.status = 'finished';
      state.winner = winner;
      state.resultDetail = 'four_pieces';
    } else {
      // Sync piecesInGoal for the moving player
      const mover = state.players.find(p => p.color === result.color);
      const sixBonus = diceValue === 6;
      if (mover) {
        mover.piecesInGoal = MoveValidator.countPiecesInGoal(state, result.color);
        mover.hasRolled = false;
        mover.bonusRoll = sixBonus || result.captured;
      }
      // Bonus roll on a first-roll 6 or an actual capture: same player rolls again
      // Otherwise, advance turn to next player
      if (sixBonus || result.captured) {
        state.turnPhase = 'WAITING_FOR_ROLL';
      } else {
        state.turnPhase = 'WAITING_FOR_ROLL';
        advanceTurnInState(state);
      }
    }

    // Clear pending moves and dice value after move is processed
    state.pendingLegalMoves = [];
    state.pendingDiceValue = undefined;
    state.pendingIsFirstRoll = undefined;

    await this.store.saveGameState(gameId, state);

    this.emit({ type: 'piece_moved', gameId, result });
    if (winner) {
      this.emit({ type: 'game_ended', gameId, winner, resultDetail: 'four_pieces' });
    }

    return { result, state };
    });
  }


  /**
   * Finish a deferred capture after a clash resolves. The mover was already
   * validated; this decides whether the capture happens (attacker wins) or the
   * defender holds the square (no capture) — then completes the move exactly
   * like the normal path (stats, turns, win check, turn advance).
   */
  async resolveClashOutcome(gameId: string, winner: PlayerColor): Promise<void> {
    return this.withGameLock(gameId, async () => {
      const t = this.clashTimers.get(gameId);
      if (t) {
        clearTimeout(t);
        this.clashTimers.delete(gameId);
      }

      const state = await this.store.loadGameState(gameId);
      if (!state || state.status !== 'active') return;
      const pc = state.pendingCapture;
      if (!pc) return;

      const attackerWon = pc.attacker === winner;
      // Per-player clash counters (drive achSteadyDefender / achMercilessAttacker).
      const attackerMeta = state.players.find(p => p.color === pc.attacker);
      const defenderMeta = state.players.find(p => p.color === pc.defender);
      if (attackerWon) {
        if (attackerMeta) attackerMeta.stats.clashAttacksWon++;
      } else {
        if (defenderMeta) defenderMeta.stats.clashDefends++;
      }
      const pendingMove = {
        pieceId: pc.pieceId,
        from: pc.from,
        to: pc.to,
        isCapture: attackerWon,
        isHomeEntry: pc.enteredHome,
      };

      const result = MoveValidator.executeMove(state, pendingMove, pc.diceValue);
      const aCount = state.clash?.attackerPresses ?? 0;
      const dCount = state.clash?.defenderPresses ?? 0;
      if (!attackerWon) {
        // REPULSE: the attacker's piece is sent home; the defender holds the square.
        // (executeMove walked the mover to `to` with isCapture=false; re-home it.)
        const moverPiece = state.pieces.find(p => p.id === pc.pieceId);
        if (moverPiece) {
          moverPiece.step = 0;
          moverPiece.isInBase = true;
          moverPiece.isInGoal = false;
        }
        result.captured = true;
        result.capturedPieceIds = [pc.pieceId];
        result.bonusRoll = false;
        result.clashOutcome = 'defender_won';
      } else {
        result.clashOutcome = 'attacker_won';
      }

      // SINGLE TRANSACTION: apply the move inline, then clear clash + pendingCapture
      // on the SAME in-memory object before the single save — never resurrected.
      await this.completeResolvedMove(gameId, state, result, pc.diceValue, attackerWon);
      delete state.clash;
      delete state.pendingCapture;
      // Freeze ALL further input for the 3s result card (bots already gated by
      // SocketServer.clashFreezeUntil; this gate covers human/hotseat inputs).
      state.resultCardUntil = Date.now() + CLASH_RESULT_FREEZE_MS;
      await this.store.saveGameState(gameId, state);

      this.emit({ type: 'piece_moved', gameId, result });
      this.emit({
        type: 'clash_result',
        gameId,
        winner: attackerWon ? pc.attacker : pc.defender,
        loser: attackerWon ? pc.defender : pc.attacker,
        winnerPresses: attackerWon ? aCount : dCount,
        loserPresses: attackerWon ? dCount : aCount,
      });
    });
  }

  /** Complete a resolved (post-clash) move: sync pieces, history, win/turn.
   *  `attackerWon=false` means the clash was a REPULSE — the attacker forfeits the
   *  round (NO bonus even on a 6) and the turn advances. */
  private async completeResolvedMove(gameId: string, state: GameState, result: MoveResult, diceValue: number, attackerWon: boolean): Promise<void> {
    const movedPiece = state.pieces.find(p => p.id === result.pieceId);
    if (movedPiece) {
      movedPiece.isInGoal = result.to === 57;
      movedPiece.isInBase = result.to <= 0;
    }
    if (result.captured && result.capturedPieceIds) {
      for (const id of result.capturedPieceIds) {
        const cp = state.pieces.find(p => p.id === id);
        if (cp) {
          cp.isInGoal = false;
          cp.isInBase = true;
        }
      }
    }
    await this.store.recordMove(gameId, {
      ply: result.ply,
      color: result.color,
      diceValue: result.diceValue,
      pieceId: result.pieceId,
      from: result.from,
      to: result.to,
      captured: result.captured,
      enteredHome: result.enteredHome,
      timestamp: Date.now(),
    });
    state.moveCounter++;

    const winner = MoveValidator.checkWinner(state);
    if (winner) {
      const piecesInGoal = MoveValidator.countPiecesInGoal(state, winner);
      const wp = state.players.find(p => p.color === winner);
      if (wp) {
        wp.stats.piecesInGoal = piecesInGoal;
        wp.piecesInGoal = piecesInGoal;
        wp.isFinished = true;
        wp.finishedAt = new Date().toISOString();
      }
      state.status = 'finished';
      state.winner = winner;
      state.resultDetail = 'four_pieces';
    } else {
      const mover = state.players.find(p => p.color === result.color);
      const sixBonus = diceValue === 6;
      if (mover) {
        mover.piecesInGoal = MoveValidator.countPiecesInGoal(state, result.color);
        mover.hasRolled = false;
        if (attackerWon) {
          mover.bonusRoll = sixBonus || result.captured;
        } else {
          // Repulse: attacker forfeits the round — no bonus even on a 6.
          mover.bonusRoll = false;
        }
      }
      if (!attackerWon) {
        state.turnPhase = 'WAITING_FOR_ROLL';
        advanceTurnInState(state);
      } else if (sixBonus || result.captured) {
        state.turnPhase = 'WAITING_FOR_ROLL';
      } else {
        state.turnPhase = 'WAITING_FOR_ROLL';
        advanceTurnInState(state);
      }
    }
    state.pendingLegalMoves = [];
    state.pendingDiceValue = undefined;
    state.pendingIsFirstRoll = undefined;
  }

  /** Timeout fallback: most-presses wins; TIE → ATTACKER (uniform rule). */
  private resolveClashOnTimeout(gameId: string): Promise<void> {
    return (async () => {
      try {
        const state = await this.store.loadGameState(gameId);
        if (!state || state.status !== 'active') { console.error(`[clash] timeout: inactive ${gameId}`); return; }
        const clash: ClashState | undefined = state.clash;
        if (!clash) { console.error(`[clash] timeout: no clash ${gameId}`); return; }
        if (clash.phase !== 'pressing') { console.error(`[clash] timeout: phase=${clash.phase} ${gameId}`); return; }
        if (Date.now() < clash.pressDeadline) { console.error(`[clash] timeout: not due ${gameId}`); return; }
        const winner =
          clash.attackerPresses >= clash.defenderPresses
            ? clash.attacker
            : clash.defender;
        console.error(`[clash] timeout resolving ${gameId} winner=${winner} A=${clash.attackerPresses} D=${clash.defenderPresses}`);
        await this.resolveClashOutcome(gameId, winner);
        console.error(`[clash] timeout resolved ${gameId}`);
      } catch (err) {
        console.error(`[clash] timeout ERROR ${gameId}:`, err);
      }
    })();
  }

  /**
   * Locked clash press recorder — ALL presses (human AND bot) route through this.
   * Runs inside the game lock so the press + early-win resolve can never race.
   * Humans: validates key + seat ownership (via ClashManager). Bots: bypass key/seat.
   * On count >= CLASH_TARGET the resolve is scheduled OUTSIDE the lock (re-entrant
   * self-lock would deadlock the promise chain; the pendingCapture guard makes the
   * early-win race a non-issue).
   */
  async recordClashPress(gameId: string, color: PlayerColor, key?: string, isBot = false): Promise<number> {
    return this.withGameLock(gameId, async () => {
      const count = await this.clashManager.recordPress(gameId, color, key ?? '', isBot);
      if (count >= CLASH_TARGET) {
        setTimeout(() => void this.resolveClashOutcome(gameId, color), 0);
      }
      return count;
    });
  }

  startClashRecoverySweep(): void {
    void this.reArmClashTimers();
    const tick = () => {
      void (async () => {
        try {
          const keys = await this.store.scanGameKeys();
          for (const key of keys) {
            const gameId = key.replace('game:', '');
            try {
              const st = await this.store.loadGameState(gameId);
              if (!st || st.status !== 'active' || !st.clash) continue;
              const clash = st.clash;
              const now = Date.now();
              // Phase advance (never skip a phase):
              if (clash.phase === 'announce' && now >= clash.announceDeadline) {
                clash.phase = 'countdown';
              }
              if (clash.phase === 'countdown' && now >= clash.countdownDeadline) {
                clash.phase = 'pressing';
              }
              await this.store.saveGameState(gameId, st);
              // Resolution only after the full press window:
              if (clash.phase === 'pressing' && now >= clash.pressDeadline) {
                await this.resolveClashOnTimeout(gameId);
              } else if (now - clash.startedAt >= CLASH_SWEEP_GRACE_MS) {
                // Orphaned (timers lost to crash/restart): force-resolve by meters.
                await this.resolveClashOnTimeout(gameId);
              }
            } catch { /* transient — continue */ }
          }
        } catch { /* scan errors are transient — retry next tick */ }
      })();
    };
    setInterval(tick, 5000);
  }

  /** Boot-time re-arm: restore exact phase timers from persisted deadlines. */
  private async reArmClashTimers(): Promise<void> {
    try {
      const keys = await this.store.scanGameKeys();
      for (const key of keys) {
        const gameId = key.replace('game:', '');
        const st = await this.store.loadGameState(gameId);
        if (st?.status === 'active' && st.clash) {
          this.armClashPhaseTimers(gameId);
        }
      }
    } catch { /* transient — boot re-arm is best-effort; the sweep covers it */ }
  }

  /**
   * Start the clash QTE. Phase timeline is server-owned and armed here:
   * announce (2s) → countdown (3s) → press (5s). Bot pressers begin exactly at
   * press-phase start (the countdown never delays them; only humans hunt keys).
   */
  private async startClash(gameId: string, attacker: PlayerColor, defender: PlayerColor, attackerIsBot: boolean, defenderIsBot: boolean): Promise<void> {
    await this.clashManager.startClash(gameId, attacker, defender);
    this.armClashPhaseTimers(gameId, () => {
      // Bot pressers begin EXACTLY at press-phase start (they don't hunt keys).
      if (attackerIsBot || defenderIsBot) {
        if (attackerIsBot && defenderIsBot) {
          const attackerWins = Math.random() < CLASH_BOT_VS_BOT_WIN_CHANCE;
          this.simulateBotPressers(gameId, attacker, attackerWins);
          this.simulateBotPressers(gameId, defender, !attackerWins);
        } else {
          const botSide = attackerIsBot ? attacker : defender;
          const botWins = Math.random() < CLASH_BOT_VS_HUMAN_WIN_CHANCE;
          this.simulateBotPressers(gameId, botSide, botWins);
        }
      }
    });
  }

  /** Arm the announce/countdown/press timers off the PERSISTED deadlines already stored by ClashManager.startClash. */
  private armClashPhaseTimers(gameId: string, onPressStart?: () => void): void {
    const existing = this.clashTimers.get(gameId);
    if (existing) clearTimeout(existing);

    void this.store.loadClashState(gameId).then((clash) => {
      if (!clash) return;
      const now = Date.now();
      const schedule = (delay: number, phase: ClashPhase, fn: () => void) => {
        if (delay > 0) this.clashTimers.set(gameId, setTimeout(() => { void this.withGameLock(gameId, async () => { try { await fn(); } catch (err) { console.error('[clash] phase error', gameId, err); } }); }, delay));
        else void fn();
      };
      // NO lock wrapper: resolveClashOnTimeout → resolveClashOutcome ALREADY locks,
      // and wrapping would deadlock the same promise chain.
      const scheduleUnlocked = (delay: number, fn: () => void) => {
        if (delay > 0) this.clashTimers.set(gameId, setTimeout(() => { void (async () => { try { await fn(); } catch (err) { console.error('[clash] resolve error', gameId, err); } })(); }, delay));
        else void fn();
      };
      // announce -> countdown
      schedule(Math.max(0, clash.announceDeadline - now), 'countdown', async () => {
        const st = await this.store.loadGameState(gameId);
        if (!st?.clash || st.clash.phase !== 'announce') return;
        st.clash.phase = 'countdown';
        await this.store.saveGameState(gameId, st);
        this.emit({ type: 'clash_phase', gameId, phase: 'countdown', countdownDeadline: st.clash.countdownDeadline, pressDeadline: st.clash.pressDeadline });
      });
      // countdown -> pressing (bot pressers start here)
      schedule(Math.max(0, clash.countdownDeadline - now), 'pressing', async () => {
        const st = await this.store.loadGameState(gameId);
        if (!st?.clash || st.clash.phase !== 'countdown') return;
        st.clash.phase = 'pressing';
        await this.store.saveGameState(gameId, st);
        this.emit({ type: 'clash_phase', gameId, phase: 'pressing', countdownDeadline: st.clash.countdownDeadline, pressDeadline: st.clash.pressDeadline });
        onPressStart?.();
      });
      // press -> resolve
      scheduleUnlocked(Math.max(0, clash.pressDeadline - now), () => this.resolveClashOnTimeout(gameId));
    });
  }

  /**
   * Make a bot hammer the clash at a human-realistic, jittered pace.
   * The winner is pre-rolled by the caller: the WINNING bot presses in the
   * fast band (CLASH_BOT_WIN_MS_BASE ± jitter), the LOSER in the slow band
   * (CLASH_BOT_LOSE_MS_BASE ± jitter) — see the tuning block at the top of
   * clash.ts — so both visibly mash but the pre-selected winner naturally
   * reaches 42 first (or leads at the most-presses timeout). No hard-coded
   * "stop at target" — the time window + pace difference guarantee the outcome.
   */
  private simulateBotPressers(gameId: string, botColor: PlayerColor, winner: boolean): void {
    const schedulePress = () => {
      const base = winner ? CLASH_BOT_WIN_MS_BASE : CLASH_BOT_LOSE_MS_BASE;
      const delay = base + Math.random() * CLASH_BOT_JITTER_MS;
      setTimeout(() => {
        void (async () => {
          try {
            const cur = await this.store.loadGameState(gameId);
            if (!cur || cur.status !== 'active' || !cur.clash) return; // clash already resolved
            if (Date.now() >= cur.clash.pressDeadline) return; // timeout handles it

            // NOTE: no withGameLock here — simulateBotPressers is ARMED from inside
            // the lock chain (armClashPhaseTimers), and recordClashPress would
            // re-enter the same lock => deadlock. Bot presses are single-chain,
            // paced by the press-cap, and resolve/pendingCapture are idempotent.
            const count = await this.store.recordClashPress(gameId, botColor);
            // Broadcast the press so EVERY client's bars advance live (store
            // recordClashPress does NOT publish; humans get this via
            // ClashManager.recordPress — bots need it here).
            this.emit({ type: 'clash_press', gameId, color: botColor, presses: count });
            if (count >= CLASH_TARGET) {
              // Early win — schedule outside any lock (resolveClashOutcome self-locks).
              setTimeout(() => void this.resolveClashOutcome(gameId, botColor), 0);
              return;
            }
          } catch (err) {
            console.error(`[clash] bot press ERROR ${gameId}/${botColor}:`, err);
            return; // do NOT re-arm on persistent failure — recovery sweep cleans up
          }
          schedulePress();
        })();
      }, delay);
    };
    schedulePress();
  }

  // ─── Player lifecycle handlers (delegated to player-handler.ts) ─────────────

  async handlePlayerDisconnect(gameId: string, color: PlayerColor, notifyAbort?: (gameId: string) => void): Promise<void> {
    return this.withGameLock(gameId, () => handlePlayerDisconnect(this.store, (e) => this.emit(e), gameId, color, notifyAbort));
  }

  /**
   * Instant disconnect resolve: a mid-clash disconnect settles the clash
   * IMMEDIATELY by meters (A>D → attacker; A<D → defender; A=D → attacker). Called
   * AFTER handlePlayerDisconnect has released the game lock, so resolveClashOutcome
   * can re-acquire it without deadlocking.
   */
  async resolveClashOnDisconnect(gameId: string): Promise<void> {
    const state = await this.store.loadGameState(gameId);
    if (!state?.clash) return;
    const clash = state.clash;
    const winner = clash.attackerPresses >= clash.defenderPresses ? clash.attacker : clash.defender;
    await this.resolveClashOutcome(gameId, winner);
  }

  async handlePlayerReconnect(gameId: string, color: PlayerColor): Promise<void> {
    return this.withGameLock(gameId, () => handlePlayerReconnect(this.store, gameId, color));
  }

  async handlePlayerReady(gameId: string, color: PlayerColor): Promise<void> {
    await this.withGameLock(gameId, () => handlePlayerReady(this.store, (e) => this.emit(e), gameId, color));
    await this.emitLobbyUpdate(gameId);
  }

  async handlePlayerExit(gameId: string, color: PlayerColor): Promise<void> {
    return this.withGameLock(gameId, () => handlePlayerExit(this.store, (e) => this.emit(e), gameId, color));
  }

  async handlePlayerSelectColor(gameId: string, userId: string, color: PlayerColor): Promise<void> {
    if (!this.lobbyManager) {
      throw new Error('Lobby manager not initialized');
    }
    await this.withGameLock(gameId, () => this.lobbyManager!.handleSelectColor(gameId, userId, color));
    await this.emitLobbyUpdate(gameId);
  }

  /**
   * Host-only live update of the game rules (clash mode + safe zones) from the
   * waiting room. The LobbyManager applies the change to both the match hash
   * and the engine GameState under the game lock; afterwards the updated
   * toggles are broadcast so every client's lobby stays in sync.
   */
  async handleUpdateModifiers(gameId: string, userId: string, clashEnabled: boolean, safeZones: boolean): Promise<void> {
    if (!this.lobbyManager) {
      throw new Error('Lobby manager not initialized');
    }
    await this.withGameLock(gameId, () => this.lobbyManager!.updateModifiers(gameId, userId, clashEnabled, safeZones));
    await this.emitModifiersUpdate(gameId);
  }

  /** Broadcast the current rule toggles (clash mode + safe zones) to the room. */
  async emitModifiersUpdate(gameId: string): Promise<void> {
    const state = await this.store.loadGameState(gameId);
    if (!state) return;
    this.emit({ type: 'modifiers_updated', gameId, clashEnabled: state.clashMode, safeZones: state.safeZones });
  }

  /**
   * Broadcast the current waiting-room roster (seat, username, ready flag) so every
   * connected client's lobby screen stays in sync after a ready-toggle, color swap,
   * or a new player joining. Public: socket-handlers.ts calls this after join_game
   * so already-connected clients learn about the new seat (see handleJoinGame).
   */
  async emitLobbyUpdate(gameId: string): Promise<void> {
    const state = await this.store.loadGameState(gameId);
    if (!state) return;
    const matchData = await this.store.getMatchData(gameId);
    const players = state.players
      .filter(p => p.status !== 'inactive')
      .map(p => ({
        userId: '',
        username: p.username,
        avatarStyle: '',
        color: p.color,
        ready: state.readyPlayers.includes(p.color),
      }));
    this.emit({ type: 'lobby_update', gameId, hostId: matchData?.player1_id || '', players });
  }
}
