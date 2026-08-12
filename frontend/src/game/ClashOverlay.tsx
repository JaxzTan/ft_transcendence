import { useEffect, useRef } from 'react'
import type { ClashResult, GameViewState } from './reducer'
import type { PlayerColor } from './types'

const COLORS: Record<PlayerColor, string> = {
  red: '#d0679d',
  green: '#5de4c7',
  yellow: '#ffcb6b',
  blue: '#89ddff',
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
        background: 'rgba(19,21,31,.88)', backdropFilter: 'blur(16px)',
      }}
    >
      <div
        style={{
          width: 500, borderRadius: 28, padding: '38px 42px', textAlign: 'center',
          background: 'linear-gradient(145deg, rgba(27,30,46,.95), rgba(20,23,35,.98))',
          border: '1px solid rgba(93,228,199,.4)',
          boxShadow: '0 40px 100px -20px rgba(0,0,0,.9), 0 0 40px rgba(93,228,199,.25)',
        }}
      >
        {result ? (
          <>
            <div style={{ fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontSize: 13, letterSpacing: '.3em', color: '#5de4c7', fontWeight: 800, marginBottom: 10 }}>
              CLASH OVER
            </div>
            <div
              style={{
                fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontSize: 44, lineHeight: 1.1, fontWeight: 900,
                color: COLORS[result.winner], marginBottom: 8,
                textShadow: `0 0 24px ${COLORS[result.winner]}88`,
              }}
            >
              {result.winner === myColor ? '⚔️ You Won!' : `${result.winner.toUpperCase()} Wins!`}
            </div>
            <div style={{ color: '#a6accd', fontSize: 15, fontWeight: 600 }}>
              {result.winnerPresses} vs {result.loserPresses} taps
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontSize: 14, letterSpacing: '.3em', color: '#5de4c7', fontWeight: 900, marginBottom: 10 }}>
              ⚔️ CLASH!
            </div>
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 24,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 62, height: 62, borderRadius: 18, background: COLORS[clash.attacker],
                    display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 22, color: '#13151f',
                    margin: '0 auto 8px', boxShadow: `0 0 20px ${COLORS[clash.attacker]}88`,
                    fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                  }}
                >
                  {clash.attacker.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ fontSize: 13, color: '#f0f4fc', fontWeight: 700 }}>Attacker</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: COLORS[clash.attacker], fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                  {attackerIsMe ? myPresses : theirPresses}
                </div>
              </div>
              <div style={{ fontSize: 28, color: '#89ddff', fontWeight: 900, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>VS</div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 62, height: 62, borderRadius: 18, background: COLORS[clash.defender],
                    display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 22, color: '#13151f',
                    margin: '0 auto 8px', boxShadow: `0 0 20px ${COLORS[clash.defender]}88`,
                    fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                  }}
                >
                  {clash.defender.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ fontSize: 13, color: '#f0f4fc', fontWeight: 700 }}>Defender</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: COLORS[clash.defender], fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                  {defenderIsMe ? myPresses : theirPresses}
                </div>
              </div>
            </div>

            {iAmInClash ? (
              <div
                style={{
                  padding: '18px 24px', borderRadius: 18, background: 'rgba(93,228,199,.15)', border: '1px solid rgba(93,228,199,.4)',
                  marginBottom: 18,
                }}
              >
                <div style={{ fontSize: 13, color: '#f0f4fc', fontWeight: 600, marginBottom: 8 }}>TAP RAPIDLY!</div>
                <div
                  style={{
                    display: 'inline-block', padding: '12px 26px', borderRadius: 12, border: '2px solid #5de4c7',
                    fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontWeight: 900, fontSize: 24, color: '#13151f',
                    background: 'linear-gradient(135deg, #5de4c7, #89ddff)',
                    boxShadow: '0 0 20px rgba(93,228,199,.6)',
                  }}
                >
                  {myKey === 'Space' ? '[ SPACE ]' : `[ ${myKey} ]`}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: '#a6accd', marginBottom: 16 }}>Watching battle...</div>
            )}

            {/* Progress bar */}
            <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%', borderRadius: 99,
                  background: remaining < 2000 ? 'linear-gradient(90deg, #d0679d, #ff5c8a)' : 'linear-gradient(90deg, #5de4c7, #89ddff)',
                  width: `${(1 - progress) * 100}%`,
                  transition: 'width 0.5s linear',
                  boxShadow: '0 0 12px rgba(93,228,199,.8)',
                }}
              />
            </div>
            <div style={{ color: '#a6accd', fontSize: 12, marginTop: 8, fontWeight: 600 }}>
              {Math.ceil(remaining / 1000)}s remaining · Target: {clash.target} taps
            </div>
          </>
        )}
      </div>
    </div>
  )
}
