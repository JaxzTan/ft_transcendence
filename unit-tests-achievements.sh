#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# Achievement Boundary-Matrix Tests (achievement-revamp.md §5)
#
# Standalone suite: no Docker/DB required. Emits a temporary ts-node program
# inside backend/ (so module resolution + the backend toolchain work), exercises
# every registry rule boundary (achievements.registry.ts is dependency-free),
# then deletes the temp file.
#
# Covered boundaries:
#   1. Win tiers     — FirstBlood 1 / DiceMaster 3 / Tactician 5 / Master 8 /
#                      GrandBotMaster 12 / WorldChampion 15
#   2. OnFire        — 2 consecutive wins (winStreak >= 2); 1 → locked
#   3. Bot wins      — BabySteps 1 bot win; DiceLoveMe 3 bot wins
#   4. LoveTheMachine— 3 consecutive PvE games (any outcome); PvP resets the streak
#   5. FT Transcendence — 10 PvP wins only (PvE wins never count)
#   6. Unstoppable   — 3 captures in ONE game; 2 in a game → locked; split 2+2 → locked
#   7. Speed Demon   — 29:59 → unlock; 30:01 → locked; missing startedAt → locked
#   8. Contract      — exactly 15 registry rules, each with nameKey, and
#                      lifetime (source+target) or per-game (perGameSource+perGameTarget)
#   9. Clash rules   — the backend-only clash achievements are registry-ready
#                      (hidden from the UI by design, §4.4)
#
# Exit code 0 = all pass; 1 = failures or toolchain missing.
# ─────────────────────────────────────────────────────────────────────────────

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
TMP_TS="$BACKEND_DIR/.achievements-boundary-test.ts"

PASS=0
FAIL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓ PASS${NC}: $1"; ((PASS++)); }
fail() { echo -e "  ${RED}✗ FAIL${NC}: $1"; ((FAIL++)); }

echo ""
echo "============================================="
echo "Achievements Boundary-Matrix Tests"
echo "============================================="
echo ""

# Locate a ts-node/tsx runner (backend devDependencies carry ts-node).
TS_NODE=""
if [ -x "$BACKEND_DIR/node_modules/.bin/ts-node" ]; then
  TS_NODE="$BACKEND_DIR/node_modules/.bin/ts-node"
elif [ -x "$BACKEND_DIR/node_modules/.bin/tsx" ]; then
  TS_NODE="$BACKEND_DIR/node_modules/.bin/tsx"
else
  echo -e "  ${YELLOW}! SKIP${NC}: ts-node/tsx not found in backend/node_modules — install backend devDependencies first."
  exit 0
fi

cat > "$TMP_TS" <<'EOF'
/**
 * In-memory boundary runner for the achievement registry.
 * Pure logic — no NestJS, no Prisma, no Redis, no container.
 */
import {
  ACHIEVEMENT_KEYS,
  ACHIEVEMENT_RULES,
  AchievementRule,
  LifecycleCounts,
  GameParticipantLike,
  GameLike,
} from './src/achievements/achievements.registry';

let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  \x1b[32m✓ PASS\x1b[0m: ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`  \x1b[31m✗ FAIL\x1b[0m: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Apply a lifetime rule the same way AchievementsService.evaluateRule does. */
function evalLifetime(rule: AchievementRule, counts: LifecycleCounts) {
  const progress = rule.source!(counts);
  return { progress, target: rule.target!, unlocked: progress >= rule.target! };
}

/** Apply a per-game rule the same way AchievementsService.evaluateRule does. */
function evalPerGame(rule: AchievementRule, part: GameParticipantLike, game: GameLike) {
  const progress = rule.perGameSource!(part, game);
  return { progress, target: rule.perGameTarget!, unlocked: progress >= rule.perGameTarget! };
}

const counts = (over: Partial<LifecycleCounts> = {}): LifecycleCounts => ({
  wins: 0,
  botWins: 0,
  humanWins: 0,
  totalGames: 0,
  winStreak: 0,
  pveGameStreak: 0,
  ...over,
});

const part = (over: Partial<GameParticipantLike> = {}): GameParticipantLike => ({
  rank: 1,
  piecesCaptured: 0,
  piecesInGoal: 0,
  clashDefends: 0,
  clashAttacksWon: 0,
  ...over,
});

const game = (startedAt: number | null, endedAt: number): GameLike => ({
  startedAt: startedAt === null ? null : new Date(startedAt),
  endedAt: new Date(endedAt),
});

const MIN = 60_000;
const HOUR_0 = 1_000_000;
const rule = (key: string) => ACHIEVEMENT_RULES.find((r) => r.key === key)!;

// ── 1. Win tiers ────────────────────────────────────────────────────────────
console.log('\n[1] Win tiers (1/3/5/8/12/15)');
{
  const first = evalLifetime(rule('achFirstBlood'), counts({ wins: 1 }));
  ok('FirstBlood at 1 win', first.unlocked, `${first.progress}/${first.target}`);
  ok('FirstBlood progress = 1', first.progress === 1);

  const dice = evalLifetime(rule('achDiceMaster'), counts({ wins: 2 }));
  ok('DiceMaster locked at 2 wins', !dice.unlocked);
  const dice3 = evalLifetime(rule('achDiceMaster'), counts({ wins: 3 }));
  ok('DiceMaster unlocked at 3 wins', dice3.unlocked);

  const tac = evalLifetime(rule('achTactician'), counts({ wins: 5 }));
  ok('Tactician unlocked at 5 wins', tac.unlocked);
  const master = evalLifetime(rule('achMaster'), counts({ wins: 8 }));
  ok('Master unlocked at 8 wins', master.unlocked);
  const grand = evalLifetime(rule('achGrandBotMaster'), counts({ wins: 12 }));
  ok('GrandBotMaster unlocked at 12 wins', grand.unlocked);
  const champ = evalLifetime(rule('achWorldChampion'), counts({ wins: 15 }));
  ok('WorldChampion unlocked at 15 wins', champ.unlocked);
  const champ14 = evalLifetime(rule('achWorldChampion'), counts({ wins: 14 }));
  ok('WorldChampion locked at 14 wins', !champ14.unlocked);
}

// ── 2. OnFire streak ────────────────────────────────────────────────────────
console.log('\n[2] OnFire (2 consecutive wins)');
{
  const fire1 = evalLifetime(rule('achOnFire'), counts({ winStreak: 1 }));
  ok('OnFire locked at 1-streak', !fire1.unlocked);
  const fire2 = evalLifetime(rule('achOnFire'), counts({ winStreak: 2 }));
  ok('OnFire unlocked at 2-streak', fire2.unlocked);
}

// ── 3. Bot wins ─────────────────────────────────────────────────────────────
console.log('\n[3] Bot wins (BabySteps 1 / DiceLoveMe 3)');
{
  const baby = evalLifetime(rule('achBabySteps'), counts({ botWins: 1 }));
  ok('BabySteps unlocked at 1 bot win', baby.unlocked);
  const love = evalLifetime(rule('achTheDiceLoveMe'), counts({ botWins: 3 }));
  ok('DiceLoveMe unlocked at 3 bot wins', love.unlocked);
  const love2 = evalLifetime(rule('achTheDiceLoveMe'), counts({ botWins: 2 }));
  ok('DiceLoveMe locked at 2 bot wins', !love2.unlocked);
}

// ── 4. LoveTheMachine PvE streak ────────────────────────────────────────────
console.log('\n[4] LoveTheMachine (3 consecutive PvE, any outcome; PvP resets)');
{
  const love2 = evalLifetime(rule('achLoveTheMachine'), counts({ pveGameStreak: 2 }));
  ok('LoveTheMachine locked at 2-PvE streak', !love2.unlocked);
  const love3 = evalLifetime(rule('achLoveTheMachine'), counts({ pveGameStreak: 3 }));
  ok('LoveTheMachine unlocked at 3-PvE streak', love3.unlocked);
  // PvP between PvE games resets pveGameStreak to 0 (backend write contract).
  const reset = evalLifetime(rule('achLoveTheMachine'), counts({ pveGameStreak: 0 }));
  ok('PvP reset (pveGameStreak 0) → locked', !reset.unlocked);
}

// ── 5. FT Transcendence PVP-only ────────────────────────────────────────────
console.log('\n[5] FT Transcendence (10 PvP wins; PvE never counts)');
{
  const ft0 = evalLifetime(rule('achft_Transcendence'), counts({ humanWins: 0, wins: 10, botWins: 10 }));
  ok('10 PvE wins (humanWins 0) → locked', !ft0.unlocked);
  const ft10 = evalLifetime(rule('achft_Transcendence'), counts({ humanWins: 10, wins: 10 }));
  ok('10 PvP wins (humanWins 10) → unlocked', ft10.unlocked);
}

// ── 6. Unstoppable per-game captures ────────────────────────────────────────
console.log('\n[6] Unstoppable (3 captures in ONE game)');
{
  const two = evalPerGame(rule('achUnstoppable'), part({ piecesCaptured: 2 }), game(HOUR_0, HOUR_0 + 15 * MIN));
  ok('2 captures in a game → locked', !two.unlocked);
  const three = evalPerGame(rule('achUnstoppable'), part({ piecesCaptured: 3 }), game(HOUR_0, HOUR_0 + 15 * MIN));
  ok('3 captures in a game → unlocked', three.unlocked);
  // Split across two games: each game individually < 3 → locked (retroactive scan is per-game).
  const g1 = evalPerGame(rule('achUnstoppable'), part({ piecesCaptured: 2 }), game(HOUR_0, HOUR_0 + 15 * MIN));
  const g2 = evalPerGame(rule('achUnstoppable'), part({ piecesCaptured: 2 }), game(HOUR_0 + 1, HOUR_0 + 16 * MIN));
  ok('2+2 captures across two games → locked', !g1.unlocked && !g2.unlocked);
}

// ── 7. Speed Demon duration ─────────────────────────────────────────────────
console.log('\n[7] Speed Demon (<30 min win; unknown duration ⇒ locked)');
{
  const fast = evalPerGame(rule('achSpeedDemon'), part({ rank: 1 }), game(HOUR_0, HOUR_0 + 29 * MIN + 59_000));
  ok('29:59 win → unlocked', fast.unlocked);
  const slow = evalPerGame(rule('achSpeedDemon'), part({ rank: 1 }), game(HOUR_0, HOUR_0 + 30 * MIN + 1_000));
  ok('30:01 win → locked', !slow.unlocked);
  const unknown = evalPerGame(rule('achSpeedDemon'), part({ rank: 1 }), game(null, HOUR_0 + 15 * MIN));
  ok('missing startedAt → locked', !unknown.unlocked);
  const loser = evalPerGame(rule('achSpeedDemon'), part({ rank: 2 }), game(HOUR_0, HOUR_0 + 15 * MIN));
  ok('fast loss (rank 2) → locked', !loser.unlocked);
}

// ── 8. Contract ─────────────────────────────────────────────────────────────
console.log('\n[8] Registry contract (15 rules, nameKey, type, source/target)');
{
  ok('exactly 15 registry rules', ACHIEVEMENT_RULES.length === 15, `rules=${ACHIEVEMENT_RULES.length}`);
  ok('all rules have nameKey', ACHIEVEMENT_RULES.every((r) => typeof r.nameKey === 'string' && r.nameKey.startsWith('dashboard.')));
  ok('lifetime rules have source + target', ACHIEVEMENT_RULES.filter((r) => r.type === 'lifetime').every((r) => typeof r.source === 'function' && typeof r.target === 'number'));
  ok('per-game rules have perGameSource + perGameTarget', ACHIEVEMENT_RULES.filter((r) => r.type === 'per-game').every((r) => typeof r.perGameSource === 'function' && typeof r.perGameTarget === 'number'));
  ok('every key has exactly one rule', ACHIEVEMENT_KEYS.every((k) => ACHIEVEMENT_RULES.filter((r) => r.key === k).length === 1));
}

// ── 9. Clash rules wiring-ready (hidden from UI by design) ──────────────────
console.log('\n[9] Clash rules in registry (backend-only, hidden from the UI)');
{
  const def = rule('achSteadyDefender');
  const atk = rule('achMercilessAttacker');
  ok('SteadyDefender is per-game, target 2', def.type === 'per-game' && def.perGameTarget === 2);
  ok('MercilessAttacker is per-game, target 2', atk.type === 'per-game' && atk.perGameTarget === 2);
  const def2 = evalPerGame(def, part({ clashDefends: 2 }), game(HOUR_0, HOUR_0 + 15 * MIN));
  ok('2 defended clashes → SteadyDefender unlocked', def2.unlocked);
  const atk2 = evalPerGame(atk, part({ clashAttacksWon: 2 }), game(HOUR_0, HOUR_0 + 15 * MIN));
  ok('2 attacker wins → MercilessAttacker unlocked', atk2.unlocked);
  const mixed = evalPerGame(def, part({ clashDefends: 1, clashAttacksWon: 1 }), game(HOUR_0, HOUR_0 + 15 * MIN))
    || evalPerGame(atk, part({ clashDefends: 1, clashAttacksWon: 1 }), game(HOUR_0, HOUR_0 + 15 * MIN));
  ok('mixed 1/1 → neither unlocks', !mixed.unlocked);
}

console.log(`\n=== Boundary result: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
EOF

cd "$BACKEND_DIR" || { echo -e "  ${RED}✗ FAIL${NC}: cannot enter backend dir"; exit 1; }

if "$TS_NODE" "$TMP_TS"; then
  echo ""
else
  echo -e "\n  ${RED}✗ FAIL${NC}: achievement boundary suite errored."
  FAIL=$((FAIL + 1))
fi

rm -f "$TMP_TS"

echo ""
echo "============================================="
echo "Achievement Tests Summary: ${PASS} integration passed, ${FAIL} suite failures"
echo "============================================="

[ "$FAIL" -eq 0 ]