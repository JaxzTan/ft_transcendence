import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ClashResult, GameViewState } from './reducer'
import type { ClashPhase, PlayerColor } from './types'

// ── Clash timing constants — EDIT HERE to tune the FEEL ─────────────────────
// These mirror the ENGINE constants in backend/app/ludo-engine/src/clash.ts.
// The overlay's phase transitions come from the server-borne deadlines
// (announceDeadline / countdownDeadline / pressDeadline), so these only affect
// presentation helpers (result-card duration, fight-flash window, tick rate).
// To change the ACTUAL race timings, ALSO edit the engine's clash.ts.
const CLASH_ANNOUNCE_MS = 1500    // Card A splash ("⚔️ CLASH!" + colors)
const CLASH_COUNTDOWN_MS = 3000   // GET READY → 3 → 2 → 1 (inside Card C)
const CLASH_PRESS_MS = 5000       // keys + bars race
const CLASH_RESULT_MS = 2000      // Card D result card
const CLASH_FIGHT_FLASH_MS = 700  // "FIGHT!" flash at press start
const CLASH_UI_TICK_MS = 250      // overlay re-render cadence

const CLASH_TARGET = 42 // must mirror engine CLASH_TARGET
// Bar renders in whole pixels: 168px track / 42 presses = 4px per press, so the
// bar hits exactly full (168px) at 42 presses. Keep width a multiple of target.
const CLASH_BAR_WIDTH_PX = 168

const COLORS: Record<PlayerColor, string> = {
  red: '#e05050',
  green: '#5fd08a',
  yellow: '#f0d18a',
  blue: '#4a92e0',
}

type Props = {
  clash: NonNullable<GameViewState['clash']>
  result: ClashResult | null
  myColor: PlayerColor
  onKeyPress: (key: string) => void
  onComplete: () => void
  /** Hotseat only: one device controls both seats, so BOTH sides' keys must be
   *  accepted simultaneously (per clash context decision #5 — "Hotseat can mash
   *  both keys simultaneously"). PvP/PvE leave this false: each player only
   *  ever presses their own key. */
  allowBothSides?: boolean
}

/** Re-render on a fixed tick so phase transitions + countdown derive from SERVER timestamps. */
function useNow(ms = CLASH_UI_TICK_MS): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

function phaseAt(clash: NonNullable<GameViewState['clash']>, now: number): ClashPhase {
  if (now < clash.announceDeadline) return 'announce'
  if (now < clash.countdownDeadline) return 'countdown'
  return 'pressing' // press window is [countdownDeadline, pressDeadline); after that result prop shows
}

/** Chunky bar — black track that fills with the side's color, whole pixels per press. */
function Bar({ color, presses, target }: { color: PlayerColor; presses: number; target: number }) {
  const fullAt = Math.max(1, target)
  const safe = Number.isFinite(presses) ? presses : 0
  // px-per-press = CLASH_BAR_WIDTH_PX / target (168/42 = 4px per press); capped at the track.
  const widthPx = Math.min(CLASH_BAR_WIDTH_PX, (safe / fullAt) * CLASH_BAR_WIDTH_PX)
  return (
    <div
      className="relative mx-auto h-[50px] w-[168px] overflow-hidden rounded-[10px] border border-(--border-color) bg-(--bg-secondary)"
      style={{ marginTop: '3mm' }}
    >
      <div
        style={{
          height: '100%', borderRadius: 8,
          width: `${widthPx}px`,
          background: COLORS[color],
          boxShadow: `0 0 12px ${COLORS[color]}66`,
          transition: 'width 90ms linear',
        }}
      />
    </div>
  )
}

/** Name-plate — Defender sits LEFT (QWESAZXDC), Attacker RIGHT (UIOHJKNBM). */
function Plate({ role, color, isMe }: { role: 'Defender' | 'Attacker'; color: PlayerColor; isMe: boolean }) {
  return (
    <div className="text-center">
      <div
        className="mx-auto mb-2 grid h-[76px] w-[120px] place-items-center rounded-[18px] px-3 text-[28px] font-black tracking-[0.12em] text-[#12100a]"
        style={{ background: COLORS[color], boxShadow: `0 0 18px ${COLORS[color]}55` }}
      >
        {(color ?? '').slice(0, 2).toUpperCase() || '?'}
      </div>
      <div className="text-[15px] font-extrabold text-(--text-main)">{role}</div>
      <div className="text-xs font-bold" style={{ color: isMe ? 'var(--accent-yellow)' : 'var(--text-muted)' }}>
        {isMe ? 'YOU' : color.toUpperCase()}
      </div>
    </div>
  )
}

// Static clash key box — identical for every key so the border doesn't hug the
// glyph. Sized from Atkinson Hyperlegible Bold metrics at 54px so the WIDEST
// character used (W, advance 47.7px) and the TALLEST (Q, 39.7px incl. descender)
// always keep ≥2mm clearance (2mm ≈ 7.56px) from the 2px border on all sides:
//   width  = widestAdvance + 4mm + 2×2px border = 47.7 + 15.1 + 4 = 67px
//   height = line-box baseline model (half-leading) + 2×2px border = 61px
const KEY_BADGE_W = 67
const KEY_BADGE_H = 61

/** Large bold key chip — fixed static border, highlighted for the owning player, dimmed otherwise. */
function KeyBadge({ label, emphasized }: { label: string; emphasized: boolean }) {
  return (
    <div
      className="mt-3 inline-grid place-items-center rounded-[10px] text-[54px] font-bold uppercase leading-none"
      style={{
        width: KEY_BADGE_W,
        height: KEY_BADGE_H,
        fontFamily: "'Atkinson Hyperlegible', sans-serif",
        border: `2px solid ${emphasized ? 'var(--accent-yellow)' : 'var(--text-muted)'}`,
        color: emphasized ? 'var(--text-main)' : 'var(--text-muted)',
        boxShadow: emphasized ? '0 0 14px var(--accent-yellow)' : 'none',
      }}
    >
      {label === 'Space' ? 'SPACE' : label.toUpperCase()}
    </div>
  )
}

export function ClashOverlay({ clash, result, myColor, onKeyPress, onComplete, allowBothSides = false }: Props) {
  const { t } = useTranslation()
  const now = useNow(CLASH_UI_TICK_MS)
  const phase = phaseAt(clash, now)

  const attackerIsMe = clash.attacker === myColor
  const defenderIsMe = clash.defender === myColor
  const iAmInClash = attackerIsMe || defenderIsMe || allowBothSides
  const myKey = attackerIsMe ? clash.attackerKey : clash.defenderKey
  // Hotseat: a single device owns BOTH seats, so accept both sides' keys.
  const listenerKeys = allowBothSides
    ? [clash.attackerKey, clash.defenderKey]
    : [myKey]

  // Keypresses ONLY count during the PRESSING phase (keys are revealed then).
  useEffect(() => {
    if (!iAmInClash || phase !== 'pressing' || result) return
    // Robust key matching. The clash keys are single lowercase QWERTY letters
    // (defender q/w/e/a/s/d/z/x/c, attacker u/i/o/h/j/k/b/n/m), but:
    //   - `e.code` is the PHYSICAL key ("KeyZ", never "z") — compare with the
    //     "Key" prefix so pressing the QWERTY position always works.
    //   - `e.key` is the CHARACTER produced (layout-aware: AZERTY swaps q↔a and
    //     w↔z, so the labeled key produces a different char on non-QWERTY) —
    //     compare case-insensitively so CapsLock/Shift can't break it either.
    // Either match is sufficient, so both position-pressers and
    // label-pressers register regardless of browser or keyboard layout.
    const hitKey = (e: KeyboardEvent, k: string) =>
      e.code === `Key${k.toUpperCase()}` || (typeof e.key === 'string' && e.key.toLowerCase() === k)
    const handler = (e: KeyboardEvent) => {
      const hit = listenerKeys.find((k) => hitKey(e, k))
      if (hit) onKeyPress(hit)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [iAmInClash, phase, listenerKeys, result, onKeyPress])

  // Auto-dismiss the result card after CLASH_RESULT_MS.
  useEffect(() => {
    if (!result) return
    const t = setTimeout(onComplete, CLASH_RESULT_MS)
    return () => clearTimeout(t)
  }, [result, onComplete])

  const countdownSecs = Math.max(0, Math.ceil((clash.countdownDeadline - now) / 1000))
  const fightFlash = phase === 'pressing' && (now - clash.countdownDeadline) < CLASH_FIGHT_FLASH_MS

  // Persistent "who's fighting" header — Defender LEFT / Attacker RIGHT (keyboard mirror).
  const plates = (
    <div className="flex items-center justify-center gap-7">
      <Plate role="Defender" color={clash.defender} isMe={defenderIsMe} />
      <div className="text-2xl font-black text-(--text-muted)">VS</div>
      <Plate role="Attacker" color={clash.attacker} isMe={attackerIsMe} />
    </div>
  )

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: 'min(92vw, 860px)', borderRadius: 24, padding: '44px 56px 48px', textAlign: 'center',
          background: 'var(--bg-card)', border: 'var(--card-border-style)', boxShadow: 'var(--box-shadow)',
        }}
      >
        {result ? (
          <>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, letterSpacing: '.3em', color: 'var(--accent-yellow)', marginBottom: 10 }}>
              CLASH OVER
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)', fontSize: 46, lineHeight: 1.1,
                color: COLORS[result.winner], marginBottom: 14,
              }}
            >
              {result.winner === myColor ? '⚔️ You won!' : `${result.winner.toUpperCase()} wins`}
            </div>
            <div className="flex items-center justify-center gap-7">
              <div style={{ textAlign: 'center' }}>
                <div className="text-[13px] font-bold text-(--text-main)">Defender</div>
                <Bar color={clash.defender} presses={result.winner === clash.defender ? result.winnerPresses : result.loserPresses} target={clash.target ?? CLASH_TARGET} />
              </div>
              <div className="text-2xl font-black text-(--text-muted)">VS</div>
              <div style={{ textAlign: 'center' }}>
                <div className="text-[13px] font-bold text-(--text-main)">Attacker</div>
                <Bar color={clash.attacker} presses={result.winner === clash.attacker ? result.winnerPresses : result.loserPresses} target={clash.target ?? CLASH_TARGET} />
              </div>
            </div>
          </>
        ) : phase === 'announce' ? (
          <>
            <div className="[font-family:var(--font-heading)] text-[66px] tracking-[.14em] leading-[1.1] text-(--accent-yellow)">
              ⚔️ CLASH!
            </div>
            <div className="mt-2.5 text-sm text-(--text-muted)">A collision is about to happen!</div>
            <div className="mt-1 text-xs text-(--text-muted)">
              {CLASH_ANNOUNCE_MS / 1000}s reveal · {CLASH_COUNTDOWN_MS / 1000}s countdown · {CLASH_PRESS_MS / 1000}s clash
            </div>
            <div className="mt-[22px]">{plates}</div>
          </>
        ) : (
          <>
            {plates}
            <div
              className="mt-[22px] flex min-h-[170px] flex-col items-center justify-center text-center"
            >
              {phase === 'countdown' ? (
                <>
                  <div className="[font-family:var(--font-heading)] text-lg tracking-[.18em] text-(--accent-yellow)">
                    GET READY…
                  </div>
                  <div className="[font-family:var(--font-display)] text-[96px] font-bold leading-none text-(--accent-yellow)">
                    {countdownSecs > 0 ? Math.min(countdownSecs, Math.ceil(CLASH_COUNTDOWN_MS / 1000)) : 'GO'}
                  </div>
                  <div className="mt-2 text-[13px] text-(--text-muted)">
                    Your key will appear when the fight starts!
                  </div>
                </>
              ) : (
                <>
                  {fightFlash && (
                    <div className="[font-family:var(--font-heading)] text-[42px] tracking-[.3em] text-(--accent-yellow)">
                      ⚔️ FIGHT!
                    </div>
                  )}
                  <div className="mt-2.5 flex items-start justify-center gap-7">
                    <div className="text-center">
                      <KeyBadge label={clash.defenderKey} emphasized={defenderIsMe} />
                      <Bar color={clash.defender} presses={clash.defenderPresses} target={clash.target ?? CLASH_TARGET} />
                    </div>
                    <div className="mt-2 self-center text-[26px] font-black text-(--text-muted)">VS</div>
                    <div className="text-center">
                      <KeyBadge label={clash.attackerKey} emphasized={attackerIsMe} />
                      <Bar color={clash.attacker} presses={clash.attackerPresses} target={clash.target ?? CLASH_TARGET} />
                    </div>
                  </div>
                  {!iAmInClash && <div className="mt-2.5 text-[13px] text-(--text-muted)">Watching…</div>}
                  <div className="mt-2.5 text-xs text-(--text-muted)">
                    {t('game.clashPressHint', { seconds: CLASH_PRESS_MS / 1000 })}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}