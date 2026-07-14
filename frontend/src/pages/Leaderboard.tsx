import { useState } from 'react'
import type { CSSProperties } from 'react'
import { LEADERS, MEDAL_COLORS, MY_ROW } from '../data'
import { avatarDim, card } from '../theme'

const ROW_BASE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '64px 1fr 120px 120px 90px',
  gap: 8,
  padding: '12px 20px',
  borderBottom: '1px solid #241a10',
  alignItems: 'center',
}

const MEDAL_BASE: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  display: 'grid',
  placeItems: 'center',
  fontWeight: 800,
  fontSize: 13,
}

const TABS = [
  { k: 'global', label: 'Global' },
  { k: 'friends', label: 'Friends' },
  { k: 'weekly', label: 'Weekly' },
]

export function Leaderboard() {
  const [tab, setTab] = useState('global')

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {TABS.map((t) => {
          const active = tab === t.k
          return (
            <div
              key={t.k}
              onClick={() => setTab(t.k)}
              style={{
                cursor: 'pointer',
                padding: '9px 18px',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: '13.5px',
                color: active ? '#2a1c07' : '#c9bda3',
                background: active ? 'linear-gradient(180deg,#f0d18a,#c99b45)' : '#1a130d',
                border: '1px solid ' + (active ? '#b8873a' : '#3a2c1d'),
              }}
            >
              {t.label}
            </div>
          )
        })}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '64px 1fr 120px 120px 90px',
            gap: 8,
            padding: '14px 20px',
            borderBottom: '1px solid #2e2115',
            font: "700 12px 'Hanken Grotesk'",
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: '#a99a83',
          }}
        >
          <div>Rank</div>
          <div>Player</div>
          <div style={{ textAlign: 'right' }}>Rating</div>
          <div style={{ textAlign: 'right' }}>Wins</div>
          <div style={{ textAlign: 'right' }}>Win %</div>
        </div>
        {LEADERS.map((l, i) => (
          <div key={l.name} style={ROW_BASE}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span
                style={
                  i < 3
                    ? { ...MEDAL_BASE, background: MEDAL_COLORS[i], color: '#241a0c' }
                    : { ...MEDAL_BASE, background: 'transparent', color: '#a99a83' }
                }
              >
                {i + 1}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ ...avatarDim(34) }}>{l.name.slice(0, 2).toUpperCase()}</div>
              <span style={{ fontWeight: 700, fontSize: '14.5px' }}>{l.name}</span>
            </div>
            <div style={{ textAlign: 'right', fontWeight: 800, color: '#f0c24e' }}>♛ {l.rating}</div>
            <div style={{ textAlign: 'right', fontWeight: 600, color: '#c9bda3' }}>{l.wins}</div>
            <div style={{ textAlign: 'right', fontWeight: 600, color: '#c9bda3' }}>{l.wr}</div>
          </div>
        ))}
        <div
          style={{
            ...ROW_BASE,
            background: 'linear-gradient(90deg,rgba(74,146,224,.14),transparent)',
            borderTop: '1px solid #4a92e055',
            borderBottom: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ ...MEDAL_BASE, background: 'transparent', color: '#4a92e0' }}>{MY_ROW.rank}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center',
                fontWeight: 800, fontSize: 12, background: 'linear-gradient(180deg,#4a92e0,#2c66ad)', color: '#0d1b28',
              }}
            >
              YO
            </div>
            <span style={{ fontWeight: 800, fontSize: '14.5px' }}>You</span>
          </div>
          <div style={{ textAlign: 'right', fontWeight: 800, color: '#f0c24e' }}>♛ {MY_ROW.rating.toLocaleString()}</div>
          <div style={{ textAlign: 'right', fontWeight: 600, color: '#c9bda3' }}>{MY_ROW.wins}</div>
          <div style={{ textAlign: 'right', fontWeight: 600, color: '#c9bda3' }}>{MY_ROW.wr}</div>
        </div>
      </div>
    </div>
  )
}
