import { btnOutline } from '../theme'

const PROVIDERS = [
  { name: '42', icon: '/forty_two.png', path: '/api/auth/42' },
  { name: 'GitHub', icon: '/github.png', path: '/api/auth/github' },
  { name: 'Google', icon: '/google.png', path: '/api/auth/google' },
] as const

/** Row of OAuth provider buttons (42 / GitHub / Google) shared by login and signup. */
export function OAuthButtons() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
      {PROVIDERS.map((p) => (
        <button
          key={p.name}
          onClick={() => {
            window.location.href = p.path
          }}
          style={{
            ...btnOutline,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '11px 10px',
            fontSize: 14,
            fontWeight: 700,
            borderRadius: 12,
            background: 'rgba(27,30,46,0.75)',
            border: '1px solid rgba(93,228,199,0.25)',
          }}
        >
          <img src={p.icon} alt={p.name} style={{ width: 18, height: 18, objectFit: 'contain' }} />
          {p.name}
        </button>
      ))}
    </div>
  )
}

/** "OR" hairline divider used around the OAuth row. */
export function OrDivider({ text = 'OR' }: { text?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: '#a6accd',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '.15em',
        fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
      }}
    >
      <span style={{ flex: 1, height: 1, background: 'rgba(93, 228, 199, 0.2)' }} />
      {text}
      <span style={{ flex: 1, height: 1, background: 'rgba(93, 228, 199, 0.2)' }} />
    </div>
  )
}
