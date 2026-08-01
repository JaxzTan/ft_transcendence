import { LEADERS, MODE_CARDS } from '../data'
import { navigate } from '../router'
import { useApp, type Mode } from '../store'
import { avatarDim, btnGold, btnGoldSmall, card } from '../theme'

export function Home() {
  const { setMode } = useApp()

  const goLobby = (mode: Mode) => {
    setMode(mode)
    navigate(`/lobby?mode=${mode}`)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 20,
          border: '1px solid #2e4a38',
          padding: '34px 36px',
          background: 'radial-gradient(120% 140% at 12% 0%,#22432f,#12261a 70%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'repeating-linear-gradient(45deg,rgba(0,0,0,.10) 0 3px,transparent 3px 11px)',
            opacity: 0.5,
          }}
        />
        <div style={{ position: 'relative', maxWidth: 560 }}>
          <div style={{ fontSize: 13, letterSpacing: '.2em', textTransform: 'uppercase', color: '#7fae91', fontWeight: 700 }}>
            Good evening, You
          </div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 34, lineHeight: 1.05, color: '#f4e9cf', margin: '10px 0 12px' }}>
            Ready to roll the bones?
          </div>
          <div style={{ color: '#c9bda3', fontSize: '15.5px', lineHeight: 1.5, maxWidth: 460 }}>
            Set up a private table against the house bots, or dive into a ranked match. First to bring all four
            pieces home wins the crown.
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
            <button onClick={() => navigate('/lobby')} style={{ ...btnGold, padding: '13px 22px' }}>
              Create a table
            </button>
            <button
              onClick={() => navigate('/game')}
              style={{
                border: '1px solid #4a5f4a',
                borderRadius: 12,
                padding: '13px 22px',
                font: "700 15px 'Hanken Grotesk'",
                color: '#e8f0e0',
                cursor: 'pointer',
                background: 'rgba(255,255,255,.04)',
              }}
            >
              Resume last game
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {MODE_CARDS.map((m) => (
          <div
            key={m.title}
            className="mode-card"
            onClick={() => goLobby(m.mode as Mode)}
            style={{
              cursor: 'pointer',
              borderRadius: 16,
              padding: 20,
              background: 'linear-gradient(180deg,#241b13,#1a130d)',
              border: '1px solid #3a2c1d',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.045),0 20px 44px -24px rgba(0,0,0,.85)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              transition: 'transform .12s,border-color .12s',
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                display: 'grid',
                placeItems: 'center',
                fontSize: 22,
                color: m.hue,
                background: 'rgba(255,255,255,.04)',
                border: `1px solid ${m.hue}44`,
              }}
            >
              {m.glyph}
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#f0e2c4' }}>{m.title}</div>
            <div style={{ color: '#a99a83', fontSize: 13, lineHeight: 1.4 }}>{m.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div style={{ ...card, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#f0e2c4' }}>Top of the ladder</div>
            <a onClick={() => navigate('/leaderboard')} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              View all →
            </a>
          </div>
          {LEADERS.slice(0, 4).map((l, i) => (
            <div
              key={l.name}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid #2a2015' }}
            >
              <div style={{ width: 22, textAlign: 'center', fontWeight: 800, color: '#a99a83', fontSize: 14 }}>{i + 1}</div>
              <div style={avatarDim(32)}>{l.name.slice(0, 2).toUpperCase()}</div>
              <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{l.name}</div>
              <div style={{ color: '#f0c24e', fontWeight: 800, fontSize: 14 }}>♛ {l.rating}</div>
            </div>
          ))}
        </div>
        <div
          style={{
            borderRadius: 16,
            padding: 22,
            background: 'radial-gradient(120% 120% at 20% 0%,#2e2417,#1a130d)',
            border: '1px solid #4a3826',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16, color: '#f0e2c4' }}>Daily reward</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 14,
                flex: 'none',
                display: 'grid',
                placeItems: 'center',
                fontSize: 26,
                color: '#2a1c07',
                background: 'linear-gradient(180deg,#f0d18a,#c99b45)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5)',
              }}
            >
              ◈
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#f0d18a' }}>+150 coins</div>
              <div style={{ color: '#a99a83', fontSize: 13 }}>Day 4 streak · come back tomorrow</div>
            </div>
          </div>
          <button style={{ ...btnGoldSmall, padding: 12 }}>Claim reward</button>
        </div>
      </div>
    </div>
  )
}
