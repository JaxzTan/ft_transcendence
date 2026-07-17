import { Board } from '../components/Board'
import { Die } from '../components/Die'
import { MOVE_LOG } from '../data'
import { navigate } from '../router'
import { useApp } from '../store'
import { COL, SEAT_COLORS, btnGold, card, sectionLabel } from '../theme'

/** Static "pieces home" pip counts per seat, as in the prototype. */
const HOME_COUNTS = [4, 3, 2, 4]

function Pips({ count, color }: { count: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: i < count ? color : 'transparent',
            border: '1.5px solid ' + (i < count ? color : '#4a3826'),
            boxSizing: 'border-box',
          }}
        />
      ))}
    </div>
  )
}

export function Game() {
  const { mode, seats, dice, rolling, turn, roll, endTurn } = useApp()
  const players = seats.slice(0, mode)
  const active = players[turn]
  const turnLabel = active?.type === 'you' ? 'Your turn' : `${(active?.type === 'bot' && active.name) || 'Bot'}'s turn`

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 30px', borderBottom: '1px solid #2e2115' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            onClick={() => navigate('/home')}
            style={{
              cursor: 'pointer', padding: '9px 16px', borderRadius: 10, border: '1px solid #3a2c1d',
              background: '#1a130d', fontSize: 13, fontWeight: 700, color: '#c9bda3',
            }}
          >
            ← Leave
          </div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 18, color: '#f4e9cf' }}>{mode}-Player · Casual</div>
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 999,
            background: '#22432f', border: '1px solid #2e4a38', fontWeight: 700, fontSize: '13.5px', color: '#dff0e0',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5fd08a', animation: 'pulseRing 1.6s infinite' }} />
          {turnLabel}
        </div>
      </header>

      <div
        style={{
          flex: 1, display: 'grid', gridTemplateColumns: '250px 1fr 280px', gap: 24, padding: '26px 30px',
          alignItems: 'start', maxWidth: 1300, margin: '0 auto', width: '100%',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...sectionLabel, color: '#a99a83' }}>Players</div>
          {players.map((seat, i) => {
            const ck = SEAT_COLORS[i]
            const col = COL[ck]
            const isActive = turn === i
            const name = seat.type === 'you' ? 'You' : (seat.type === 'bot' && seat.name) || 'Bot'
            const sub =
              seat.type === 'you'
                ? 'Your pieces'
                : seat.type === 'bot' && seat.diff
                  ? seat.diff[0].toUpperCase() + seat.diff.slice(1) + ' bot'
                  : 'Bot'
            return (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: 12, borderRadius: 13,
                  border: '1px solid ' + (isActive ? col.base : '#3a2c1d'),
                  background: isActive ? `linear-gradient(180deg,${col.base}22,#1a130d)` : 'linear-gradient(180deg,#241b13,#1a130d)',
                  boxShadow: isActive ? `0 0 0 1px ${col.base}55` : 'none',
                }}
              >
                <div
                  style={{
                    width: 38, height: 38, flex: 'none', borderRadius: 10, display: 'grid', placeItems: 'center',
                    fontWeight: 800, fontSize: 13, color: '#12100a', background: `linear-gradient(180deg,${col.base},${col.dark})`,
                  }}
                >
                  {seat.type === 'you' ? 'YO' : ((seat.type === 'bot' && seat.name) || 'B').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#f0e2c4' }}>{name}</div>
                  <div style={{ color: '#a99a83', fontSize: 12 }}>{sub}</div>
                </div>
                <Pips count={HOME_COUNTS[i]} color={col.base} />
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: '100%', maxWidth: 540, padding: 16, borderRadius: 20,
              background: 'linear-gradient(145deg,#3a2a1a,#241811)',
              boxShadow: '0 34px 66px -26px #000,inset 0 2px 0 rgba(255,255,255,.06)',
              border: '1px solid #4a3826',
            }}
          >
            <Board />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...card, padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={sectionLabel}>{rolling ? 'Rolling…' : 'Your roll'}</div>
            <div style={{ height: 96, display: 'grid', placeItems: 'center' }}>
              <Die value={dice} rolling={rolling} />
            </div>
            <button onClick={roll} style={{ ...btnGold, width: '100%', padding: 14 }}>
              {rolling ? 'Rolling…' : 'Roll dice'}
            </button>
            <button
              onClick={endTurn}
              style={{
                width: '100%', border: '1px solid #4a3826', borderRadius: 12, padding: 12,
                font: "700 14px 'Hanken Grotesk'", color: '#c9bda3', cursor: 'pointer', background: 'transparent',
              }}
            >
              End turn
            </button>
          </div>
          <div style={{ ...card, padding: '18px 20px' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#f0e2c4', marginBottom: 10 }}>Move log</div>
            {MOVE_LOG.map((ml, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 13, color: '#c9bda3' }}>
                <span style={{ color: COL[ml.ck].base, fontWeight: 800 }}>●</span>
                <span>{ml.text}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/results')}
            style={{
              border: '1px solid #2e4a38', borderRadius: 12, padding: 12, font: "700 13.5px 'Hanken Grotesk'",
              color: '#8fbf9f', cursor: 'pointer', background: 'rgba(34,67,47,.3)',
            }}
          >
            End game (demo results)
          </button>
        </div>
      </div>
    </div>
  )
}
