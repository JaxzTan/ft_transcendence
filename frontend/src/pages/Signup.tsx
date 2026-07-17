import { AuthLayout, GoldCheck } from '../components/AuthLayout'
import { navigate } from '../router'
import { btnGold, goldText, input, label } from '../theme'

export function Signup() {
  return (
    <AuthLayout tag="JOIN 2.4M PLAYERS WORLDWIDE">
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div
            style={{
              fontFamily: "'Cinzel',serif",
              fontWeight: 700,
              letterSpacing: 1.5,
              fontSize: 30,
              lineHeight: 1,
              ...goldText,
            }}
          >
            Create your seat
          </div>
          <div style={{ color: '#a99a83', fontSize: '14.5px', marginTop: 8 }}>
            Claim your name at the table. It's free to play.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={label}>Display name</div>
          <input placeholder="e.g. NightRook" style={input} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={label}>Email</div>
          <input placeholder="you@parlor.gg" style={input} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={label}>Password</div>
            <input type="password" placeholder="••••••••" style={input} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={label}>Confirm</div>
            <input type="password" placeholder="••••••••" style={input} />
          </div>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 9,
            cursor: 'pointer',
            color: '#a99a83',
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          <GoldCheck offsetTop />
          I agree to the House Rules and Privacy terms.
        </label>
        <button onClick={() => navigate('/home')} style={btnGold}>
          Create account & play
        </button>
        <div style={{ textAlign: 'center', color: '#a99a83', fontSize: 14 }}>
          Already have a seat?{' '}
          <a onClick={() => navigate('/login')} style={{ cursor: 'pointer', fontWeight: 700 }}>
            Sign in
          </a>
        </div>
      </div>
    </AuthLayout>
  )
}
