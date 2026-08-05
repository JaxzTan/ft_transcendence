import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { Board } from '../components/Board'
import { navigate, useRoute } from '../router'
import { useApp, type Difficulty, type Mode } from '../store'
import { COL, SEAT_COLORS, card, feltPanel, pill, sectionLabel } from '../theme'

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard']

export function Lobby() {
  const { query } = useRoute()
  const { mode, seats, setMode, addBot, removeBot, setDiff, startGame } = useApp()

  // Honor ?mode=2|4 in the URL so lobby links are shareable and refresh-safe.
  useEffect(() => {
    const q = Number(query.get('mode'))
    if ((q === 2 || q === 4) && q !== mode) setMode(q as Mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pickMode = (m: Mode) => {
    setMode(m)
    navigate(`/lobby?mode=${m}`, { replace: true })
  }

  const visible = seats.slice(0, mode)
  const botCount = visible.filter((s) => s.type === 'bot').length
  const emptyCount = visible.filter((s) => s.type === 'empty').length
  const canStart = botCount >= 1

  const startBtnStyle: CSSProperties = canStart
    ? {
        border: 'none', borderRadius: 12, padding: 14, font: "800 15px 'Hanken Grotesk'", color: '#2a1c07',
        cursor: 'pointer', background: 'linear-gradient(180deg,#f0d18a,#c99b45)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.55),0 12px 22px -12px rgba(190,140,55,.8)', marginTop: 4,
      }
    : {
        border: '1px solid #3a2c1d', borderRadius: 12, padding: 14, font: "800 15px 'Hanken Grotesk'",
        color: '#6b5d49', cursor: 'not-allowed', background: '#1a130d', marginTop: 4,
      }

  const onStart = () => {
    if (startGame()) navigate('/game')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', borderBottom: '1px solid #2e2115' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            onClick={() => navigate('/home')}
            style={{
              cursor: 'pointer', width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center',
              border: '1px solid #3a2c1d', background: '#1a130d', fontSize: 16, color: '#c9bda3',
            }}
          >
            ←
          </div>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, color: '#f4e9cf' }}>Table Setup</div>
            <div style={{ color: '#a99a83', fontSize: 13 }}>Private match · house bots</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {([2, 4] as Mode[]).map((m) => (
            <div key={m} style={pill(mode === m)} onClick={() => pickMode(m)}>
              {m} Players
            </div>
          ))}
        </div>
      </header>

      <div
        style={{
          flex: 1, display: 'grid', gridTemplateColumns: '1.35fr .9fr', gap: 26, padding: '30px 34px',
          alignItems: 'start', maxWidth: 1200, margin: '0 auto', width: '100%',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={sectionLabel}>Seats · {mode} players</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {visible.map((seat, i) => {
              const ck = SEAT_COLORS[i]
              const col = COL[ck]
              const colorName = ck[0].toUpperCase() + ck.slice(1)
              const avStyle: CSSProperties = {
                width: 42, height: 42, flex: 'none', borderRadius: 11, display: 'grid', placeItems: 'center',
                fontWeight: 800, fontSize: 14, color: '#12100a', background: `linear-gradient(180deg,${col.base},${col.dark})`,
              }
              return (
                <div key={i} style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, background: 'linear-gradient(180deg,#241b13,#1a130d)', border: '1px solid #3a2c1d' }}>
                  <div style={{ height: 4, background: col.base }} />
                  <div style={{ padding: '18px 18px 20px', minHeight: 150, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {seat.type === 'you' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={avStyle}>YO</div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: '#f0e2c4' }}>
                              You <span style={{ color: '#c99b45', fontSize: 11, fontWeight: 700 }}>HOST</span>
                            </div>
                            <div style={{ color: '#a99a83', fontSize: '12.5px' }}>♛ 1,540 · {colorName}</div>
                          </div>
                        </div>
                        <div style={{ marginTop: 'auto', fontSize: '12.5px', color: '#7fae91', fontWeight: 700 }}>✓ Ready</div>
                      </>
                    )}
                    {seat.type === 'bot' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={avStyle}>{seat.name.slice(0, 2).toUpperCase()}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 15, color: '#f0e2c4' }}>
                              {seat.name} <span style={{ color: '#a99a83', fontSize: 11, fontWeight: 700 }}>BOT</span>
                            </div>
                            <div style={{ color: '#a99a83', fontSize: '12.5px' }}>{colorName} piece</div>
                          </div>
                          <div
                            onClick={() => removeBot(i)}
                            style={{
                              cursor: 'pointer', color: '#a99a83', fontSize: 15, width: 26, height: 26,
                              display: 'grid', placeItems: 'center', borderRadius: 7, border: '1px solid #3a2c1d',
                            }}
                          >
                            ✕
                          </div>
                        </div>
                        <div style={{ marginTop: 'auto' }}>
                          <div style={{ fontSize: 11, color: '#a99a83', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, marginBottom: 7 }}>
                            Difficulty
                          </div>
                          <div style={{ display: 'flex', gap: 7 }}>
                            {DIFFS.map((d) => {
                              const active = seat.diff === d
                              return (
                                <div
                                  key={d}
                                  onClick={() => setDiff(i, d)}
                                  style={{
                                    cursor: 'pointer', padding: '6px 11px', borderRadius: 999, fontWeight: 700, fontSize: 12,
                                    color: active ? col.base : '#a99a83',
                                    background: active ? col.base + '22' : '#20180f',
                                    border: '1px solid ' + (active ? col.base : '#4a3826'),
                                  }}
                                >
                                  {d[0].toUpperCase() + d.slice(1)}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </>
                    )}
                    {seat.type === 'empty' && (
                      <div
                        onClick={() => addBot(i)}
                        style={{
                          cursor: 'pointer', flex: 1, border: '1.5px dashed #4a3826', borderRadius: 12, display: 'flex',
                          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                          color: '#a99a83', minHeight: 120,
                        }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px dashed #4a3826', display: 'grid', placeItems: 'center', fontSize: 22, color: '#c99b45' }}>
                          +
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '13.5px' }}>Add a bot</div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>
          <div style={{ ...feltPanel, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 190 }}>
              <Board />
            </div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 15, color: '#dff0e0', letterSpacing: '.04em' }}>
              Classic Cross Board
            </div>
          </div>
          <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: '#a99a83' }}>Players</span>
              <span style={{ fontWeight: 700 }}>{mode - emptyCount} / {mode}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: '#a99a83' }}>Bots</span>
              <span style={{ fontWeight: 700 }}>{botCount}{botCount === 1 ? ' bot' : ' bots'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: '#a99a83' }}>Mode</span>
              <span style={{ fontWeight: 700 }}>Casual · Unranked</span>
            </div>
            <button onClick={onStart} style={startBtnStyle}>
              {canStart ? 'Start game' : 'Add a bot to start'}
            </button>
            <div style={{ textAlign: 'center', color: '#a99a83', fontSize: 12 }}>
              {canStart ? `You + ${botCount} bot${botCount > 1 ? 's' : ''}` : 'At least one opponent required'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
