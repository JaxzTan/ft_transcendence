import { PODIUM } from '../data'
import { navigate } from '../router'
import { useApp } from '../store'
import { COL, btnOutline, goldText } from '../theme'

const PLACE_COLORS = ['#f0c24e', '#cfd3d8', '#c98a4a', '#7a6c56']

export function Results() {
  const { mode } = useApp()

  return (
    <div
      style={{
        minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 40,
        background: 'radial-gradient(90% 80% at 50% 0%,#22432f,#12100a 70%)',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 560, borderRadius: 22, padding: 38, textAlign: 'center',
          background: 'linear-gradient(180deg,#241b13,#171009)', border: '1px solid #4a3826',
          boxShadow: '0 40px 80px -30px #000',
        }}
      >
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, letterSpacing: '.34em', color: '#c99b45' }}>
          MATCH COMPLETE
        </div>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 48, lineHeight: 1, margin: '14px 0 6px', ...goldText }}>
          Victory!
        </div>
        <div style={{ color: '#c9bda3', fontSize: 15 }}>You brought all four pieces home first. The crown is yours.</div>
        <div
          style={{
            width: 96, height: 96, margin: '26px auto', borderRadius: '50%',
            background: 'linear-gradient(180deg,#4a92e0,#2c66ad)', display: 'grid', placeItems: 'center',
            fontSize: 34, fontWeight: 800, color: '#0d1b28',
            boxShadow: '0 0 0 4px #f0d18a,0 0 40px rgba(240,209,138,.4)',
          }}
        >
          YO
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '0 auto 22px', maxWidth: 340 }}>
          {PODIUM.slice(0, mode).map((p, i) => (
            <div
              key={p.place}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12,
                background: i === 0 ? 'linear-gradient(90deg,rgba(240,209,138,.16),#1a130d)' : '#1a130d',
                border: '1px solid ' + (i === 0 ? '#c99b45' : '#2e2115'),
              }}
            >
              <div
                style={{
                  width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center',
                  fontWeight: 800, fontSize: 13, color: '#241a0c', background: PLACE_COLORS[i],
                }}
              >
                {p.place}
              </div>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: COL[p.ck].base }} />
              <div style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: 14, color: '#f0e2c4' }}>{p.name}</div>
              <div style={{ color: '#a99a83', fontSize: 13, fontWeight: 600 }}>{p.detail}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 22 }}>
          <div style={{ padding: '12px 18px', borderRadius: 12, background: '#1a130d', border: '1px solid #3a2c1d' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f0c24e' }}>+18</div>
            <div style={{ color: '#a99a83', fontSize: 12 }}>Rating</div>
          </div>
          <div style={{ padding: '12px 18px', borderRadius: 12, background: '#1a130d', border: '1px solid #3a2c1d' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#5fd08a' }}>+180</div>
            <div style={{ color: '#a99a83', fontSize: 12 }}>XP</div>
          </div>
          <div style={{ padding: '12px 18px', borderRadius: 12, background: '#1a130d', border: '1px solid #3a2c1d' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f0d18a' }}>+75 ◈</div>
            <div style={{ color: '#a99a83', fontSize: 12 }}>Coins</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => navigate('/game')}
            style={{
              flex: 1, border: 'none', borderRadius: 12, padding: 14, font: "800 15px 'Hanken Grotesk'",
              color: '#2a1c07', cursor: 'pointer', background: 'linear-gradient(180deg,#f0d18a,#c99b45)',
            }}
          >
            Rematch
          </button>
          <button onClick={() => navigate('/leaderboard')} style={{ ...btnOutline, flex: 1, padding: 14 }}>
            Leaderboard
          </button>
          <button onClick={() => navigate('/home')} style={{ ...btnOutline, flex: 1, padding: 14 }}>
            Home
          </button>
        </div>
      </div>
    </div>
  )
}
