import type { ReactNode } from 'react'

/**
 * Full-bleed Retrowave auth shell matching Home.tsx background:
 * Animated 3D Synthwave Grid & Sun Background with centered glassmorphism card.
 */
export function RetroAuthLayout({
  tag,
  children,
}: {
  tag?: string
  children: ReactNode
}) {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-main)',
        overflowX: 'hidden',
      }}
    >
      {/* Animated 3D Synthwave Grid & Sun Background (Identical to Home page) */}
      <div className="grid-background">
        <div className="synthwave-sun" />
        <div className="grid-horizon" />
        <div className="perspective-grid" />
        <div className="win95-starfield" />
        <div className="terminal-vector-core" />
      </div>

      {/* Centered glassmorphism card wrapper */}
      <div
        className="retro-auth-card-wrapper"
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          padding: '24px 20px',
          width: '100%',
          maxWidth: 620,
          boxSizing: 'border-box',
        }}
      >
        {/* Glass card */}
        <div className="retro-auth-card" style={{ width: '100%', boxSizing: 'border-box' }}>
          {children}
        </div>

        {/* Tag line below card */}
        {tag && (
          <div className="retro-auth-tag">
            {tag}
          </div>
        )}
      </div>
    </div>
  )
}

/** Neon cyan checkbox used by auth forms */
export function NeonCheck({ offsetTop }: { offsetTop?: boolean }) {
  return (
    <span
      style={{
        width: 16,
        height: 16,
        marginTop: offsetTop ? 1 : undefined,
        flex: 'none',
        borderRadius: 4,
        background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.5), rgba(255, 0, 127, 0.4))',
        border: '1px solid rgba(0, 240, 255, 0.6)',
        display: 'inline-grid',
        placeItems: 'center',
        color: '#ffffff',
        fontSize: 10,
        fontWeight: 900,
        boxShadow: '0 0 8px rgba(0, 240, 255, 0.4)',
      }}
    >
      ✓
    </span>
  )
}
