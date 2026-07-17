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
          background: 'radial-gradient(90% 80% at 50% 42%,#22432f,#12261a 68%,#0d1b12)',
          borderRight: '1px solid #0a0f0c',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'repeating-linear-gradient(45deg,rgba(0,0,0,.11) 0 3px,transparent 3px 11px)',
            opacity: 0.55,
          }}
        />
        <div
          style={{
            position: 'relative',
            width: 380,
            maxWidth: '66vw',
            filter: 'drop-shadow(0 34px 54px rgba(0,0,0,.6))',
            animation: 'floaty 6.5s ease-in-out infinite',
          }}
        >
          <Board />
        </div>
        <div
          style={{
            position: 'relative',
            marginTop: 30,
            fontFamily: "'Cinzel',serif",
            fontSize: 12,
            letterSpacing: '.34em',
            color: '#7fae91',
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

/** Gold gradient checkbox glyph used by both auth forms. */
export function GoldCheck({ offsetTop }: { offsetTop?: boolean }) {
  return (
    <span
      style={{
        width: 16,
        height: 16,
        marginTop: offsetTop ? 1 : undefined,
        flex: 'none',
        borderRadius: 5,
        background: 'linear-gradient(180deg,#f0d18a,#c99b45)',
        display: 'inline-grid',
        placeItems: 'center',
        color: '#2a1c07',
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      ✓
    </span>
  )
}
