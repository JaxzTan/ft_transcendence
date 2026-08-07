import { useEffect, useRef } from 'react'
import type { ClashResult, GameViewState } from './reducer'
import type { PlayerColor } from './types'

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
}

export function ClashOverlay({ clash, result, myColor, onKeyPress, onComplete }: Props) {
  const startRef = useRef(Date.now())

  const attackerIsMe = clash.attacker === myColor
  const defenderIsMe = clash.defender === myColor
  const iAmInClash = attackerIsMe || defenderIsMe
  const myKey = attackerIsMe ? clash.attackerKey : clash.defenderKey
  const myPresses = attackerIsMe ? clash.attackerPresses : clash.defenderPresses
  const theirPresses = attackerIsMe ? clash.defenderPresses : clash.attackerPresses

  useEffect(() => {
    if (!iAmInClash || result) return
    const handler = (e: KeyboardEvent) => {
      if (e.code === myKey || e.key === myKey) {
        onKeyPress(myKey)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [iAmInClash, myKey, result, onKeyPress])

  // Auto-dismiss 3s after result
  useEffect(() => {
    if (!result) return
    const t = setTimeout(onComplete, 3000)
    return () => clearTimeout(t)
  }, [result, onComplete])

  const elapsed = Date.now() - startRef.current
  const remaining = Math.max(0, clash.duration - elapsed)
  const progress = Math.min(1, elapsed / clash.duration)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: 480, borderRadius: 24, padding: '36px 40px', textAlign: 'center',
          background: 'linear-gradient(180deg,#241b13,#171009)', border: '1px solid #6a4826',
          boxShadow: '0 60px 100px -30px #000',
        }}
      >
        {result ? (
          <>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: '.3em', color: '#c99b45', marginBottom: 10 }}>
              CLASH OVER
            </div>
            <div
              style={{
                fontFamily: "'Cinzel',serif", fontSize: 42, lineHeight: 1.1,
                color: COLORS[result.winner], marginBottom: 8,
              }}
            >
              {result.winner === myColor ? '⚔️ You won!' : `${result.winner.toUpperCase()} wins`}
            </div>
            <div style={{ color: '#a99a83', fontSize: 14 }}>
              {result.winnerPresses} vs {result.loserPresses} taps
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: '.3em', color: '#c99b45', marginBottom: 8 }}>
              ⚔️ CLASH!
            </div>
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 56, height: 56, borderRadius: 14, background: COLORS[clash.attacker],
                    display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 20, color: '#12100a',
                    margin: '0 auto 6px',
                  }}
                >
                  {clash.attacker.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ fontSize: 13, color: '#f0e2c4', fontWeight: 700 }}>Attacker</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: COLORS[clash.attacker] }}>
                  {attackerIsMe ? myPresses : theirPresses}
                </div>
              </div>
              <div style={{ fontSize: 30, color: '#6b5d49', fontWeight: 900 }}>VS</div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 56, height: 56, borderRadius: 14, background: COLORS[clash.defender],
                    display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 20, color: '#12100a',
                    margin: '0 auto 6px',
                  }}
                >
                  {clash.defender.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ fontSize: 13, color: '#f0e2c4', fontWeight: 700 }}>Defender</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: COLORS[clash.defender] }}>
                  {defenderIsMe ? myPresses : theirPresses}
                </div>
              </div>
            </div>

            {iAmInClash ? (
              <div
                style={{
                  padding: '18px 24px', borderRadius: 16, background: 'rgba(240,193,78,.12)', border: '1px solid #c99b4555',
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 13, color: '#a99a83', marginBottom: 6 }}>Press quickly!</div>
                <div
                  style={{
                    display: 'inline-block', padding: '10px 22px', borderRadius: 10, border: '2px solid #c99b45',
                    fontFamily: "'Courier New', monospace", fontWeight: 900, fontSize: 22, color: '#f0d18a',
                    background: 'rgba(240,193,78,.1)',
                  }}
                >
                  {myKey === 'Space' ? '[ SPACE ]' : `[ ${myKey} ]`}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: '#a99a83', marginBottom: 16 }}>Watching...</div>
            )}

            {/* Progress bar */}
            <div style={{ width: '100%', height: 6, background: '#2e2115', borderRadius: 99, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%', borderRadius: 99,
                  background: remaining < 2000 ? '#e05050' : '#f0d18a',
                  width: `${(1 - progress) * 100}%`,
                  transition: 'width 0.5s linear',
                }}
              />
            </div>
            <div style={{ color: '#a99a83', fontSize: 12, marginTop: 6 }}>
              {Math.ceil(remaining / 1000)}s remaining · Target: {clash.target} taps
            </div>
          </>
        )}
      </div>
    </div>
  )
}
