import { ACHIEVEMENTS, MATCHES, STAT_TILES } from '../data'
import { avatarBlue, card } from '../theme'

export function Dashboard() {
  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, borderRadius: 18, padding: '24px 26px', background: 'linear-gradient(180deg,#241b13,#1a130d)', border: '1px solid #3a2c1d' }}>
        <div style={{ ...avatarBlue(74, 26, 18), boxShadow: '0 0 0 3px #f0d18a55' }}>YO</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 26, color: '#f4e9cf' }}>You</div>
          <div style={{ color: '#a99a83', fontSize: 14, marginTop: 2 }}>Silver III · Member since 2024 · #12 this season</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#f0c24e' }}>♛ 1,540</div>
          <div style={{ color: '#7fae91', fontSize: 13, fontWeight: 700 }}>▲ +42 this week</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
        {STAT_TILES.map((s) => (
          <div key={s.label} style={{ borderRadius: 14, padding: 18, background: 'linear-gradient(180deg,#221a12,#18120c)', border: '1px solid #33261a' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#f0e2c4' }}>{s.value}</div>
            <div style={{ color: '#a99a83', fontSize: '12.5px', marginTop: 4, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#f0e2c4', marginBottom: 14 }}>Recent matches</div>
          {MATCHES.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: '1px solid #2a2015' }}>
              <div
                style={{
                  width: 34, height: 34, flex: 'none', borderRadius: 9, display: 'grid', placeItems: 'center',
                  fontWeight: 800, fontSize: 14,
                  color: m.win ? '#0d1b12' : '#2a0f0c',
                  background: m.win ? 'linear-gradient(180deg,#5fd08a,#2c8a53)' : 'linear-gradient(180deg,#e4574d,#a8362e)',
                }}
              >
                {m.win ? 'W' : 'L'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {m.mode} · {m.opp}
                </div>
                <div style={{ color: '#a99a83', fontSize: 12 }}>{m.when}</div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 14, color: m.win ? '#5fd08a' : '#e4574d' }}>{m.delta}</div>
            </div>
          ))}
        </div>
        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#f0e2c4', marginBottom: 14 }}>Achievements</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {ACHIEVEMENTS.map((a) => (
              <div
                key={a.name}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 10px',
                  borderRadius: 12, textAlign: 'center',
                  background: a.unlocked ? 'rgba(240,209,138,.08)' : '#18120c',
                  border: '1px solid ' + (a.unlocked ? '#4a3826' : '#241a10'),
                }}
              >
                <div
                  style={{
                    width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 20,
                    color: a.unlocked ? '#2a1c07' : '#4a3826',
                    background: a.unlocked ? 'linear-gradient(180deg,#f0d18a,#c99b45)' : '#241a10',
                  }}
                >
                  {a.glyph}
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: a.unlocked ? '#f0e2c4' : '#6b5d49' }}>{a.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
