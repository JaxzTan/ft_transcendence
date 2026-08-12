import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { postApi } from '../api'
import type { PlayerColor } from '../game/types'
import { navigate } from '../router'
import { useApp } from '../store'
import { btnGold, btnOutline, card, COL, goldText } from '../theme'

const PLACE_COLORS = ['#ffcb6b', '#add7ff', '#d0679d', '#506477']

export function Results() {
  const { t } = useTranslation()
  const { user, playerCount, seats, lastResult, setActiveMatch } = useApp()
  const [rematching, setRematching] = useState(false)
  const [rematchError, setRematchError] = useState<string | null>(null)

  if (!lastResult) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#13151f', color: '#f0f4fc' }}>
        <div style={{ ...card, padding: 36, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>No recent match result</div>
          <div style={{ color: '#a6accd', marginBottom: 20 }}>Play a game first to see results here.</div>
          <button onClick={() => navigate('/lobby')} style={{ ...btnGold, padding: '12px 24px' }}>
            Go to Lobby
          </button>
        </div>
      </div>
    )
  }

  const ranked = [...lastResult.players].sort((a, b) => b.piecesInGoal - a.piecesInGoal)
  const myColor = lastResult.players.find((p) => !p.isBot && p.username === user?.username)?.color
  const won = lastResult.winner === myColor
  const winnerPlayer = lastResult.players.find((p) => p.color === lastResult.winner)
  const winnerName = winnerPlayer ? (winnerPlayer.color === myColor ? t('common.you') : winnerPlayer.username) : lastResult.winner
  const winnerInitials = (winnerPlayer?.username ?? lastResult.winner).slice(0, 2).toUpperCase()

  const onRematch = async () => {
    setRematchError(null)
    setRematching(true)
    try {
      const res = await postApi<{ gameId: string; token: string; color: PlayerColor }>('/api/match/create', {
        mode: 'pve',
        playerCount: playerCount,
        botCount: seats.slice(0, playerCount).filter((s) => s.type === 'bot').length,
        clashEnabled: true,
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
        background: 'radial-gradient(100% 100% at 50% 10%, rgba(93,228,199,0.18) 0%, rgba(137,221,255,0.22) 45%, #13151f 100%)',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 580, borderRadius: 28, padding: '42px 38px', textAlign: 'center',
          background: 'linear-gradient(145deg, rgba(27,30,46,0.94), rgba(20,23,35,0.98))',
          border: '1px solid rgba(93,228,199,0.3)',
          boxShadow: '0 40px 90px -25px rgba(0,0,0,.85), 0 0 40px rgba(93,228,199,.2)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div style={{ fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontSize: 13, letterSpacing: '.34em', color: '#5de4c7', fontWeight: 800, textTransform: 'uppercase' }}>
          {t('results.matchComplete')}
        </div>
        <div style={{ fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontSize: 52, lineHeight: 1, fontWeight: 900, margin: '14px 0 8px', ...goldText }}>
          {won ? t('results.victory') : t('results.defeat')}
        </div>
        <div style={{ color: '#cbd5e1', fontSize: 16, fontWeight: 500 }}>
          {won ? t('results.victoryDesc') : lastResult.resultDetail}
        </div>
        <div
          style={{
            width: 104, height: 104, margin: '28px auto 12px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${COL[lastResult.winner].base}, ${COL[lastResult.winner].dark})`,
            display: 'grid', placeItems: 'center', fontSize: 38, fontWeight: 900, color: '#13151f',
            boxShadow: `0 0 0 5px rgba(255,255,255,0.8), 0 0 40px ${COL[lastResult.winner].base}`,
            fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
          }}
        >
          {winnerInitials}
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#f0f4fc', marginBottom: 20, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
          {winnerName}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '0 auto 26px', maxWidth: 360 }}>
          {ranked.map((p, i) => (
            <div
              key={p.color}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14,
                background: i === 0 ? 'linear-gradient(135deg, rgba(93,228,199,0.18), rgba(137,221,255,0.22))' : 'rgba(255,255,255,0.04)',
                border: '1px solid ' + (i === 0 ? 'rgba(93,228,199,0.6)' : 'rgba(255,255,255,0.08)'),
                boxShadow: i === 0 ? '0 0 20px rgba(93,228,199,0.3)' : 'none',
              }}
            >
              <div
                style={{
                  width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center',
                  fontWeight: 900, fontSize: 13, color: '#13151f', background: PLACE_COLORS[i],
                  fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                }}
              >
                {i + 1}
              </div>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: COL[p.color].base, boxShadow: `0 0 8px ${COL[p.color].base}` }} />
              <div style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: 14.5, color: '#f0f4fc', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                {p.color === myColor ? t('common.you') : p.username}
              </div>
              <div style={{ color: '#a6accd', fontSize: 13, fontWeight: 600 }}>
                {t('results.piecesHome', { count: p.piecesInGoal })}
              </div>
            </div>
          ))}
        </div>
        {rematchError && (
          <div style={{ color: '#d0679d', fontSize: 13, marginBottom: 12, background: 'rgba(208,103,157,0.15)', padding: '8px 12px', borderRadius: 8 }}>{rematchError}</div>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onRematch}
            disabled={rematching}
            style={{ ...btnGold, flex: 1, padding: 14 }}
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
