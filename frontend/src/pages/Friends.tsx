import { FRIENDS, REQUESTS, STATUS_COLORS, STATUS_LABELS } from '../data'
import { navigate } from '../router'
import { avatarDim, btnGoldSmall, card, input } from '../theme'

export function Friends() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <input placeholder="Add a friend by username or invite code" style={{ ...input, flex: 1, width: undefined }} />
        <button style={btnGoldSmall}>Add friend</button>
      </div>

      <div style={{ ...card, padding: '20px 22px' }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#f0e2c4', marginBottom: 12 }}>Requests · {REQUESTS.length}</div>
        {REQUESTS.map((r) => (
          <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0' }}>
            <div style={{ ...avatarDim(38), fontSize: 13 }}>{r.initials}</div>
            <div style={{ flex: 1, fontWeight: 700, fontSize: '14.5px' }}>{r.name}</div>
            <button
              style={{
                border: 'none', borderRadius: 9, padding: '8px 16px', font: "800 13px 'Hanken Grotesk'",
                color: '#0d1b12', cursor: 'pointer', background: 'linear-gradient(180deg,#5fd08a,#2c8a53)',
              }}
            >
              Accept
            </button>
            <button
              style={{
                border: '1px solid #4a3826', borderRadius: 9, padding: '8px 14px', font: "700 13px 'Hanken Grotesk'",
                color: '#c9bda3', cursor: 'pointer', background: 'transparent',
              }}
            >
              Ignore
            </button>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: '20px 22px' }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#f0e2c4', marginBottom: 12 }}>Your friends · {FRIENDS.length}</div>
        {FRIENDS.map((f) => {
          const offline = f.status === 'offline'
          return (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 0', borderBottom: '1px solid #2a2015' }}>
              <div style={{ position: 'relative', flex: 'none' }}>
                <div style={{ ...avatarDim(40), fontSize: 13 }}>{f.name.slice(0, 2).toUpperCase()}</div>
                <span
                  style={{
                    position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: '50%',
                    background: STATUS_COLORS[f.status], border: '2px solid #1a130d',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '14.5px' }}>{f.name}</div>
                <div style={{ fontSize: '12.5px', color: STATUS_COLORS[f.status], fontWeight: 600 }}>
                  {STATUS_LABELS[f.status]}
                </div>
              </div>
              <div style={{ color: '#a99a83', fontSize: 13, fontWeight: 700 }}>♛ {f.rating}</div>
              <button
                onClick={() => navigate('/lobby')}
                style={{
                  cursor: 'pointer',
                  border: '1px solid ' + (offline ? '#4a3826' : '#b8873a'),
                  borderRadius: 9,
                  padding: '7px 15px',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  color: offline ? '#c9bda3' : '#2a1c07',
                  background: offline ? 'transparent' : 'linear-gradient(180deg,#f0d18a,#c99b45)',
                }}
              >
                {offline ? 'Invite' : 'Play'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
