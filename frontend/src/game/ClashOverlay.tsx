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
// Bar-full calibration: full bar = CLASH_TARGET * CLASH_BAR_MULTIPLIER presses.
const CLASH_BAR_MULTIPLIER = 1.0 // 1.0 → full at exactly 42 (CLASH_TARGET)

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

/** Chunky bar — black track that fills with the side's color per press. */
function Bar({ color, presses, target }: { color: PlayerColor; presses: number; target: number }) {
  const fullAt = Math.max(1, Math.round(target * CLASH_BAR_MULTIPLIER))
  const safe = Number.isFinite(presses) ? presses : 0
  const pct = Math.min(100, (safe / fullAt) * 100)
  return (
    <div
      style={{
        width: 180, height: 50, borderRadius: 10, background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)', overflow: 'hidden', margin: '6px auto 0',
        position: 'relative',
      }}
    >
      <div
        style={{
          height: '100%', borderRadius: 8,
          width: `${pct}%`,
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
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: 76, height: 76, borderRadius: 18, background: COLORS[color],
          display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 28, color: '#12100a',
          margin: '0 auto 6px', boxShadow: `0 0 18px ${COLORS[color]}55`,
        }}
      >
        {(color ?? '').slice(0, 2).toUpperCase() || '?'}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>{role}</div>
      <div style={{ fontSize: 12, color: isMe ? 'var(--accent-yellow)' : 'var(--text-muted)', fontWeight: 700 }}>
        {isMe ? 'YOU' : color.toUpperCase()}
      </div>
    </div>
  )
}

/** Large bold key chip — highlighted for the owning player, dimmed otherwise. */
function KeyBadge({ label, emphasized }: { label: string; emphasized: boolean }) {
  return (
    <div
      style={{
        display: 'inline-block', margin: '12px 0 8px', padding: '8px 18px', borderRadius: 10,
        border: `2px solid ${emphasized ? 'var(--accent-yellow)' : 'var(--text-muted)'}`,
        fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 54,
        textTransform: 'uppercase',
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
    const handler = (e: KeyboardEvent) => {
      const hit = listenerKeys.find((k) => e.code === k || e.key === k)
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
    <div style={{ display: 'flex', justifyContent: 'center', gap: 28, alignItems: 'center' }}>
      <Plate role="Defender" color={clash.defender} isMe={defenderIsMe} />
      <div style={{ fontSize: 24, color: 'var(--text-muted)', fontWeight: 900 }}>VS</div>
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
            <div style={{ display: 'flex', justifyContent: 'center', gap: 28, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 700 }}>Defender</div>
                <Bar color={clash.defender} presses={result.winner === clash.defender ? result.winnerPresses : result.loserPresses} target={CLASH_TARGET} />
              </div>
              <div style={{ fontSize: 24, color: 'var(--text-muted)', fontWeight: 900 }}>VS</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 700 }}>Attacker</div>
                <Bar color={clash.attacker} presses={result.winner === clash.attacker ? result.winnerPresses : result.loserPresses} target={CLASH_TARGET} />
              </div>
            </div>
          </>
        ) : phase === 'announce' ? (
          <>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 66, letterSpacing: '.14em', color: 'var(--accent-yellow)', lineHeight: 1.1 }}>
              ⚔️ CLASH!
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 10 }}>A collision is about to happen!</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              {CLASH_ANNOUNCE_MS / 1000}s reveal · {CLASH_COUNTDOWN_MS / 1000}s countdown · {CLASH_PRESS_MS / 1000}s clash
            </div>
            <div style={{ marginTop: 22 }}>{plates}</div>
          </>
        ) : (
          <>
            {plates}
            <div
              style={{
                marginTop: 22, minHeight: 170, textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {phase === 'countdown' ? (
                <>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, letterSpacing: '.18em', color: 'var(--accent-yellow)' }}>
                    GET READY…
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 96, lineHeight: 1, color: 'var(--accent-yellow)' }}>
                    {countdownSecs > 0 ? Math.min(countdownSecs, Math.ceil(CLASH_COUNTDOWN_MS / 1000)) : 'GO'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
                    Your key will appear when the fight starts!
                  </div>
                </>
              ) : (
                <>
                  {fightFlash && (
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 42, letterSpacing: '.3em', color: 'var(--accent-yellow)' }}>
                      ⚔️ FIGHT!
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 28, alignItems: 'flex-start', marginTop: 10 }}>
                    <div style={{ textAlign: 'center' }}>
                      <KeyBadge label={clash.defenderKey} emphasized={defenderIsMe} />
                      <Bar color={clash.defender} presses={clash.defenderPresses} target={CLASH_TARGET} />
                    </div>
                    <div style={{ fontSize: 26, color: 'var(--text-muted)', fontWeight: 900, alignSelf: 'center', marginTop: 8 }}>VS</div>
                    <div style={{ textAlign: 'center' }}>
                      <KeyBadge label={clash.attackerKey} emphasized={attackerIsMe} />
                      <Bar color={clash.attacker} presses={clash.attackerPresses} target={CLASH_TARGET} />
                    </div>
                  </div>
                  {!iAmInClash && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10 }}>Watching…</div>}
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 10 }}>
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