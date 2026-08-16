import type { CSSProperties } from 'react'

/** The four Ludo player colors — Vibrant candy palette. */
export const COL = {
  red: { base: '#ff6b8a', dark: '#7a1e3a', yard: '#2d0e18' },      // Candy coral
  green: { base: '#4adeab', dark: '#115740', yard: '#0a2e22' },    // Bright emerald
  yellow: { base: '#ffd66b', dark: '#6b5500', yard: '#2d2409' },   // Warm buttercup
  blue: { base: '#6bb8ff', dark: '#1a4a7a', yard: '#0d1f35' },     // Rich sky
} as const

export type ColorKey = keyof typeof COL

/** Seat index → color is fixed: 0 = blue (you), 1 = red, 2 = green, 3 = yellow. */
export const SEAT_COLORS: ColorKey[] = ['blue', 'red', 'green', 'yellow']

/** Preset bot names for lobby seats. */
export const BOT_POOL: string[] = ['NovaBot', 'PixelBot', 'CyberBot', 'SparkBot', 'AstroBot', 'NeonBot']

/** Mirrors backend/src/presence/presence.service.ts's PresenceStatus. */
export type PresenceStatus = 'online' | 'playing' | 'offline'

export const STATUS_STYLE: Record<PresenceStatus, { color: string; label: string }> = {
  online: { color: '#4adeab', label: 'Online' },
  playing: { color: '#ffd66b', label: 'In a game' },
  offline: { color: '#665f80', label: 'Offline' },
}

export const goldText: CSSProperties = {
  background: 'linear-gradient(135deg, #a78bfa 0%, #f472b6 50%, #ff6b8a 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
}

//Logo Font
export const vibrantGradientText: CSSProperties = {
  background: 'linear-gradient(135deg, #a78bfa 0%, #f472b6 50%, #ff6b8a 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
}


export const btnGold: CSSProperties = {
  border: 'none',
  borderRadius: 16,
  padding: '14px 22px',
  font: "800 15px 'Space Grotesk', 'Outfit', sans-serif",
  color: '#fff',
  cursor: 'pointer',
  background: 'linear-gradient(135deg, #a78bfa 0%, #f472b6 50%, #ff6b8a 100%)',
  boxShadow: '0 8px 24px -4px rgba(167,139,250,.4), 0 0 16px rgba(244,114,182,.25), inset 0 1px 0 rgba(255,255,255,.3)',
  transition: 'transform .18s ease, box-shadow .18s ease, filter .18s ease',
}

export const btnGoldSmall: CSSProperties = {
  border: 'none',
  borderRadius: 12,
  padding: '10px 18px',
  font: "800 14px 'Space Grotesk', 'Outfit', sans-serif",
  color: '#fff',
  cursor: 'pointer',
  background: 'linear-gradient(135deg, #a78bfa 0%, #6bb8ff 100%)',
  boxShadow: '0 4px 14px -2px rgba(167,139,250,.35), inset 0 1px 0 rgba(255,255,255,.2)',
  transition: 'transform .18s ease, box-shadow .18s ease',
}

export const btnOutline: CSSProperties = {
  border: '1px solid rgba(167,139,250,.35)',
  borderRadius: 16,
  padding: '13px 20px',
  font: "700 15px 'Space Grotesk', 'Outfit', sans-serif",
  color: '#f8f0ff',
  cursor: 'pointer',
  background: 'rgba(30,22,50,.65)',
  backdropFilter: 'blur(16px)',
  transition: 'all .18s ease',
}

export const card: CSSProperties = {
  borderRadius: 22,
  background: 'linear-gradient(145deg, rgba(40,28,65,.7), rgba(25,18,42,.8))',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(167,139,250,.18)',
  boxShadow: '0 18px 40px -10px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.04)',
}

export const input: CSSProperties = {
  width: '100%',
  border: '1px solid rgba(167,139,250,.25)',
  borderRadius: 14,
  padding: '12px 16px',
  font: "500 15px 'Plus Jakarta Sans', sans-serif",
  color: '#f8f0ff',
  background: 'rgba(20,14,35,.85)',
  outline: 'none',
  transition: 'border-color .15s ease, box-shadow .15s ease',
}

export const label: CSSProperties = {
  font: "700 12px 'Space Grotesk', 'Outfit', sans-serif",
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: '#b8a9d4',
}

export const sectionLabel: CSSProperties = {
  font: "800 12px 'Space Grotesk', 'Outfit', sans-serif",
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: '#a78bfa',
}

/** Vibrant avatar used for the signed-in player. */
export const avatarBlue = (size: number, fontSize: number, radius?: number | string): CSSProperties => ({
  width: size,
  height: size,
  flex: 'none',
  borderRadius: radius ?? '50%',
  background: 'linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)',
  display: 'grid',
  placeItems: 'center',
  fontWeight: 900,
  fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
  color: '#fff',
  fontSize,
  boxShadow: '0 0 18px rgba(167,139,250,.45)',
})

/** Dim neutral avatar for other players. */
export const avatarDim = (size: number): CSSProperties => ({
  width: size,
  height: size,
  flex: 'none',
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  fontWeight: 800,
  fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
  fontSize: 12,
  background: 'linear-gradient(135deg, rgba(50,35,75,.9), rgba(30,22,48,.9))',
  border: '1px solid rgba(167,139,250,.25)',
  color: '#b8a9d4',
})

export const feltPanel: CSSProperties = {
  borderRadius: 24,
  background: 'linear-gradient(145deg, rgba(45,30,70,.85), rgba(25,16,42,.9))',
  border: '1px solid rgba(167,139,250,.25)',
  boxShadow: '0 20px 40px -15px rgba(0,0,0,.5), 0 0 24px rgba(167,139,250,.12)',
}

export const pill = (active: boolean): CSSProperties => ({
  cursor: 'pointer',
  padding: '9px 18px',
  borderRadius: 14,
  fontWeight: 800,
  fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
  fontSize: '13.5px',
  color: active ? '#fff' : '#b8a9d4',
  background: active ? 'linear-gradient(135deg, #a78bfa, #f472b6)' : 'rgba(255,255,255,.05)',
  border: '1px solid ' + (active ? 'rgba(167,139,250,.7)' : 'rgba(255,255,255,.1)'),
  boxShadow: active ? '0 4px 14px rgba(167,139,250,.35)' : 'none',
  transition: 'all .15s ease',
})
