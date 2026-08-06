import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { postApi } from '../api'
import { navigate } from '../router'
import { useApp } from '../store'
import { btnGold, btnOutline, card, COL, goldText } from '../theme'

const PLACE_COLORS = ['#f0c24e', '#cfd3d8', '#c98a4a', '#7a6c56']

// The app currently only ever joins matches as 'red' (see Game.tsx / initialView) — no
// per-user color assignment exists yet, so this mirrors that same standing assumption.
const MY_COLOR = 'red'

export function Results() {
  const { t } = useTranslation()
  const { mode, seats, lastResult, setActiveMatch } = useApp()
  const [rematching, setRematching] = useState(false)
  const [rematchError, setRematchError] = useState<string | null>(null)

  if (!lastResult) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#12100a', color: '#f0e2c4' }}>
        <div style={{ ...card, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>No recent match result</div>
          <div style={{ color: '#a99a83', marginBottom: 20 }}>Play a game first to see results here.</div>
          <button onClick={() => navigate('/lobby')} style={{ ...btnGold, padding: '12px 24px' }}>
            Go to Lobby
          </button>
        </div>
      </div>
    )
  }

  const ranked = [...lastResult.players].sort((a, b) => b.piecesInGoal - a.piecesInGoal)
  const won = lastResult.winner === MY_COLOR

  // "Rematch" votes (client → 'rematch' → server 'game_created') only work while still
  // connected to the finished game's socket room; Game.tsx disconnects on navigating here.
  // Until that's redesigned, "Play Again" creates a fresh match the same way Lobby does.
  const onRematch = async () => {
    setRematchError(null)
    setRematching(true)
    try {
      const res = await postApi<{ gameId: string; token: string; engineUrl: string }>('/api/match/create', {
        mode: 'pve',
        playerCount: mode,
        botCount: seats.slice(0, mode).filter((s) => s.type === 'bot').length,
        clashEnabled: true,
        color: MY_COLOR,
      })
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (err) {
      setRematchError(err instanceof Error ? err.message : 'Failed to create match')
      setRematching(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 40,
        background: 'radial-gradient(90% 80% at 50% 0%,#22432f,#12100a 70%)',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 560, borderRadius: 22, padding: 38, textAlign: 'center',
          background: 'linear-gradient(180deg,#241b13,#171009)', border: '1px solid #4a3826',
          boxShadow: '0 40px 80px -30px #000',
        }}
      >
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, letterSpacing: '.34em', color: '#c99b45' }}>
          {t('results.matchComplete')}
        </div>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 48, lineHeight: 1, margin: '14px 0 6px', ...goldText }}>
          {won ? t('results.victory') : t('results.defeat')}
        </div>
        <div style={{ color: '#c9bda3', fontSize: 15 }}>
          {won ? t('results.victoryDesc') : lastResult.resultDetail}
        </div>
        <div
          style={{
            width: 96, height: 96, margin: '26px auto', borderRadius: '50%',
            background: `linear-gradient(180deg,${COL[lastResult.winner].base},${COL[lastResult.winner].dark})`,
            display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 800, color: '#0d1b28',
            boxShadow: '0 0 0 4px #f0d18a,0 0 40px rgba(240,209,138,.4)',
          }}
        >
          {lastResult.winner.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '0 auto 22px', maxWidth: 340 }}>
          {ranked.map((p, i) => (
            <div
              key={p.color}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12,
                background: i === 0 ? 'linear-gradient(90deg,rgba(240,209,138,.16),#1a130d)' : '#1a130d',
                border: '1px solid ' + (i === 0 ? '#c99b45' : '#2e2115'),
              }}
            >
              <div
                style={{
                  width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center',
                  fontWeight: 800, fontSize: 13, color: '#241a0c', background: PLACE_COLORS[i],
                }}
              >
                {i + 1}
              </div>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: COL[p.color].base }} />
              <div style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: 14, color: '#f0e2c4' }}>
                {p.color === MY_COLOR ? t('common.you') : p.username}
              </div>
              <div style={{ color: '#a99a83', fontSize: 13, fontWeight: 600 }}>
                {t('results.piecesHome', { count: p.piecesInGoal })}
              </div>
            </div>
          ))}
        </div>
        {rematchError && (
          <div style={{ color: '#e05050', fontSize: 13, marginBottom: 12 }}>{rematchError}</div>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onRematch}
            disabled={rematching}
            style={{ flex: 1, border: 'none', borderRadius: 12, padding: 14, font: "800 15px 'Hanken Grotesk'",
              color: '#2a1c07', cursor: rematching ? 'default' : 'pointer', opacity: rematching ? 0.6 : 1,
              background: 'linear-gradient(180deg,#f0d18a,#c99b45)' }}
          >
            {rematching ? '…' : t('results.rematchBtn')}
          </button>
          <button onClick={() => navigate('/leaderboard')} style={{ ...btnOutline, flex: 1, padding: 14 }}>
            {t('nav.leaderboard')}
          </button>
          <button onClick={() => navigate('/home')} style={{ ...btnOutline, flex: 1, padding: 14 }}>
            {t('nav.home')}
          </button>
        </div>
      </div>
    </div>
  )
}
