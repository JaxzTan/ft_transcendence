import type { CSSProperties } from 'react'

/** The four Ludo player colors — Poimandres cyber-mint palette. */
export const COL = {
  red: { base: '#d0679d', dark: '#5c1638', yard: '#240d19' },      // Poimandres magenta/coral
  green: { base: '#5de4c7', dark: '#0a5446', yard: '#08211b' },    // Poimandres cyber mint
  yellow: { base: '#ffcb6b', dark: '#664d00', yard: '#29210a' },   // Poimandres warm amber gold
  blue: { base: '#89ddff', dark: '#103b5c', yard: '#0c1a29' },     // Poimandres ice blue
} as const

export type ColorKey = keyof typeof COL

/** Seat index → color is fixed: 0 = blue (you), 1 = red, 2 = green, 3 = yellow. */
export const SEAT_COLORS: ColorKey[] = ['blue', 'red', 'green', 'yellow']

/** Preset bot names for lobby seats. */
export const BOT_POOL: string[] = ['NovaBot', 'PixelBot', 'CyberBot', 'SparkBot', 'AstroBot', 'NeonBot']

/** Mirrors backend/src/presence/presence.service.ts's PresenceStatus. */
export type PresenceStatus = 'online' | 'playing' | 'offline'

export const STATUS_STYLE: Record<PresenceStatus, { color: string; label: string }> = {
  online: { color: '#5de4c7', label: 'Online' },
  playing: { color: '#ffcb6b', label: 'In a game' },
  offline: { color: '#506477', label: 'Offline' },
}

export const goldText: CSSProperties = {
  background: 'linear-gradient(135deg, #f1ae13ff 0%, #e50e43ff 50%, #d0679d 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
}

//Logo Font
export const vibrantGradientText: CSSProperties = {
  background: 'linear-gradient(135deg, #f1ae13ff 0%, #e50e43ff 50%, #d0679d 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
}


export const btnGold: CSSProperties = {
  border: 'none',
  borderRadius: 14,
  padding: '14px 22px',
  font: "800 15px 'Space Grotesk', 'Outfit', sans-serif",
  color: '#13151f',
  cursor: 'pointer',
  background: 'linear-gradient(135deg, #f1ae13ff 0%, #e50e43ff 50%, #d0679d 100%)',
  boxShadow: '0 8px 24px -4px rgba(93,228,199,.45), 0 0 16px rgba(137,221,255,.3), inset 0 1px 0 rgba(255,255,255,.4)',
  transition: 'transform .18s ease, box-shadow .18s ease, filter .18s ease',
}

export const btnGoldSmall: CSSProperties = {
  border: 'none',
  borderRadius: 11,
  padding: '10px 18px',
  font: "800 14px 'Space Grotesk', 'Outfit', sans-serif",
  color: '#13151f',
  cursor: 'pointer',
  background: 'linear-gradient(135deg, #5de4c7 0%, #89ddff 100%)',
  boxShadow: '0 4px 14px -2px rgba(93,228,199,.4), inset 0 1px 0 rgba(255,255,255,.3)',
  transition: 'transform .18s ease, box-shadow .18s ease',
}

export const btnOutline: CSSProperties = {
  border: '1px solid rgba(93,228,199,.35)',
  borderRadius: 14,
  padding: '13px 20px',
  font: "700 15px 'Space Grotesk', 'Outfit', sans-serif",
  color: '#f0f4fc',
  cursor: 'pointer',
  background: 'rgba(27,30,46,.75)',
  backdropFilter: 'blur(16px)',
  transition: 'all .18s ease',
}

export const card: CSSProperties = {
  borderRadius: 20,
  background: 'linear-gradient(145deg, rgba(27,30,46,.85), rgba(20,23,35,.92))',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(93,228,199,.18)',
  boxShadow: '0 18px 40px -10px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04)',
}

export const input: CSSProperties = {
  width: '100%',
  border: '1px solid rgba(93,228,199,.25)',
  borderRadius: 12,
  padding: '12px 16px',
  font: "500 15px 'Plus Jakarta Sans', sans-serif",
  color: '#f0f4fc',
  background: 'rgba(19,21,31,.85)',
  outline: 'none',
  transition: 'border-color .15s ease, box-shadow .15s ease',
}

export const label: CSSProperties = {
  font: "700 12px 'Space Grotesk', 'Outfit', sans-serif",
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: '#a6accd',
}

export const sectionLabel: CSSProperties = {
  font: "800 12px 'Space Grotesk', 'Outfit', sans-serif",
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: '#5de4c7',
}

/** Ice Blue "YO" avatar used for the signed-in player. */
export const avatarBlue = (size: number, fontSize: number, radius?: number | string): CSSProperties => ({
  width: size,
  height: size,
  flex: 'none',
  borderRadius: radius ?? '50%',
  background: 'linear-gradient(135deg, #89ddff 0%, #5de4c7 100%)',
  display: 'grid',
  placeItems: 'center',
  fontWeight: 900,
  fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
  color: '#13151f',
  fontSize,
  boxShadow: '0 0 18px rgba(137,221,255,.45)',
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
  background: 'linear-gradient(135deg, rgba(34,38,56,.9), rgba(24,27,40,.9))',
  border: '1px solid rgba(93,228,199,.25)',
  color: '#a6accd',
})

export const feltPanel: CSSProperties = {
  borderRadius: 22,
  background: 'linear-gradient(145deg, rgba(24,27,42,.9), rgba(16,18,28,.95))',
  border: '1px solid rgba(93,228,199,.25)',
  boxShadow: '0 20px 40px -15px rgba(0,0,0,.6), 0 0 24px rgba(93,228,199,.12)',
}

export const pill = (active: boolean): CSSProperties => ({
  cursor: 'pointer',
  padding: '9px 18px',
  borderRadius: 12,
  fontWeight: 800,
  fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
  fontSize: '13.5px',
  color: active ? '#13151f' : '#a6accd',
  background: active ? 'linear-gradient(135deg, #5de4c7, #89ddff)' : 'rgba(255,255,255,.05)',
  border: '1px solid ' + (active ? 'rgba(93,228,199,.8)' : 'rgba(255,255,255,.1)'),
  boxShadow: active ? '0 4px 14px rgba(93,228,199,.4)' : 'none',
  transition: 'all .15s ease',
})
