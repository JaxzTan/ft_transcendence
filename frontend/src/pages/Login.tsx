import { AuthLayout, GoldCheck } from '../components/AuthLayout'
import { navigate } from '../router'
import { btnGold, btnOutline, goldText, input, label } from '../theme'

export function Login() {
  return (
    <AuthLayout tag="EST. 1896 · TABLETOP CLASSICS">
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div
            style={{
              fontFamily: "'Cinzel',serif",
              fontWeight: 700,
              letterSpacing: 2,
              fontSize: 38,
              lineHeight: 1,
              ...goldText,
            }}
          >
            LUDO ROYALE
          </div>
          <div style={{ color: '#a99a83', fontSize: 15, marginTop: 8 }}>
            Roll. Race. Reign. Welcome back to the parlor.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={label}>Email</div>
          <input defaultValue="you@parlor.gg" style={input} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={label}>Password</div>
          <input type="password" defaultValue="123456789" style={input} />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13.5px',
            color: '#a99a83',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <GoldCheck />
            Remember me
          </label>
          <a href="#">Forgot password?</a>
        </div>
        <button onClick={() => navigate('/home')} style={btnGold}>
          Enter the parlor
        </button>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: '#7a6c56',
            fontSize: 12,
            letterSpacing: '.1em',
          }}
        >
          <span style={{ flex: 1, height: 1, background: '#3a2c1d' }} />
          OR
          <span style={{ flex: 1, height: 1, background: '#3a2c1d' }} />
        </div>
        <button onClick={() => navigate('/home')} style={btnOutline}>
          Continue as guest
        </button>
        <div style={{ textAlign: 'center', color: '#a99a83', fontSize: 14 }}>
          New to the table?{' '}
          <a onClick={() => navigate('/signup')} style={{ cursor: 'pointer', fontWeight: 700 }}>
            Create an account
          </a>
        </div>
      </div>
    </AuthLayout>
  )
}
