import type { ReactNode } from 'react'
import { Board } from './Board'

/** Two-column full-bleed shell for login/signup: felt panel + floating board left, form right. */
export function AuthLayout({ tag, children }: { tag: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.05fr .95fr' }}>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 48,
          background: 'radial-gradient(100% 100% at 50% 40%, rgba(93,228,199,0.16) 0%, rgba(137,221,255,0.18) 45%, #13151f 100%)',
          borderRight: '1px solid rgba(93, 228, 199, 0.2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(93, 228, 199, 0.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            opacity: 0.7,
          }}
        />
        <div
          style={{
            position: 'relative',
            width: 400,
            maxWidth: '68vw',
            filter: 'drop-shadow(0 30px 60px rgba(93,228,199,0.3)) drop-shadow(0 10px 20px rgba(0,0,0,0.8))',
            animation: 'floaty 6s ease-in-out infinite',
          }}
        >
          <Board />
        </div>
        <div
          style={{
            position: 'relative',
            marginTop: 32,
            fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: '.28em',
            textTransform: 'uppercase',
            color: '#5de4c7',
            textShadow: '0 0 16px rgba(93,228,199,0.6)',
          }}
        >
          {tag}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

/** Radiant gradient checkbox glyph used by both auth forms. */
export function GoldCheck({ offsetTop }: { offsetTop?: boolean }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        marginTop: offsetTop ? 1 : undefined,
        flex: 'none',
        borderRadius: 6,
        background: 'linear-gradient(135deg, #5de4c7, #89ddff)',
        boxShadow: '0 0 10px rgba(93,228,199,.5)',
        display: 'inline-grid',
        placeItems: 'center',
        color: '#13151f',
        fontSize: 12,
        fontWeight: 900,
      }}
    >
      ✓
    </span>
  )
}
