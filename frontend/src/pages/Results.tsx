import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { postApi } from '../api'
import type { PlayerColor } from '../game/types'
import { navigate } from '../router'
import { useApp } from '../store'
import { btnGold, btnOutline, card, COL, goldText } from '../theme'
import { UserAvatar } from '../components/UserAvatar'

const PLACE_COLORS = ['#f0c24e', '#cfd3d8', '#c98a4a', '#7a6c56']

export function Results() {
  const { t } = useTranslation()
  const { user, playerCount, seats, lastResult, setActiveMatch } = useApp()
  const [rematching, setRematching] = useState(false)
  const [rematchError, setRematchError] = useState<string | null>(null)

  if (!lastResult) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#12100a', color: '#f0e2c4' }}>
        <div style={{ ...card, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{t('results.noRecentResult')}</div>
          <div style={{ color: '#a99a83', marginBottom: 20 }}>{t('results.noRecentResultDesc')}</div>
          <button onClick={() => navigate('/lobby')} style={{ ...btnGold, padding: '12px 24px' }}>
            {t('home.goToLobby')}
          </button>
        </div>
      </div>
    )
  }

  const ranked = [...lastResult.players].sort((a, b) => b.piecesInGoal - a.piecesInGoal)
  const myColor = lastResult.players.find((p) => !p.isBot && p.username === user?.username)?.color
  const won = lastResult.winner === myColor
  // On a loss, show how many of the player's own pieces made it home before
  // the game ended (the raw engine resultDetail is the winner's end reason).
  const myPiecesHome = ranked.find((p) => p.color === myColor)?.piecesInGoal ?? 0
  const winnerPlayer = lastResult.players.find((p) => p.color === lastResult.winner)
  // Color-name fallback must be translated: the raw color string (e.g. "blue")
  // is what leaks when no winner player row exists.
  // Translate every possible winner color (the four PlayerColors + a defensive
  // fallback so t() never receives undefined or leaks a raw string).
  const COLOR_NAME_KEYS: Record<string, string> = {
    red: 'lobby.colorRed',
    green: 'lobby.colorGreen',
    yellow: 'lobby.colorYellow',
    blue: 'lobby.colorBlue',
  }
  const winnerColorName = COLOR_NAME_KEYS[lastResult.winner] ?? COLOR_NAME_KEYS.red
  const winnerName = winnerPlayer ? (winnerPlayer.color === myColor ? t('common.you') : winnerPlayer.username) : t(winnerColorName)
  const winnerInitials = (winnerPlayer?.username ?? lastResult.winner).slice(0, 2).toUpperCase()

  // "Rematch" votes (client → 'rematch' → server 'game_created') only work while still
  // connected to the finished game's socket room; Game.tsx disconnects on navigating here.
  // Until that's redesigned, "Play Again" creates a fresh match the same way Lobby does.
  const onRematch = async () => {
    setRematchError(null)
    setRematching(true)
    try {
      // "Play Again" must replay the mode that just finished. The REST
      // /api/match/rematch route is unusable here (processGameEnd deletes the
      // match hash, so the rematch lookup can't find the finished game), so
      // PvP creates a fresh WAITING room via create — same as Create Room.
      const finishedMode = lastResult?.mode ?? (seats.some((s) => s.type === 'bot') ? 'pve' : 'pvp')
      const res = await postApi<{ gameId: string; token: string; color: PlayerColor; mode: 'pvp' | 'pve' | 'hotseat'; playerCount: number }>('/api/match/create', {
        mode: finishedMode,
        playerCount: finishedMode === 'hotseat' ? (lastResult?.playerCount ?? playerCount) : (lastResult?.playerCount ?? playerCount),
        botCount: finishedMode === 'pve' ? seats.slice(0, playerCount).filter((s) => s.type === 'bot').length : 0,
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
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, letterSpacing: '.34em', color: lastResult.abandoned ? '#a99a83' : '#c99b45' }}>
          {lastResult.abandoned ? t('results.abandoned') : t('results.matchComplete')}
        </div>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 48, lineHeight: 1, margin: '14px 0 6px', ...(lastResult.abandoned ? { color: '#a99a83' } : goldText) }}>
          {lastResult.abandoned ? t('results.abandoned') : (won ? t('results.victory') : t('results.defeat'))}
        </div>
        <div style={{ color: '#c9bda3', fontSize: 15 }}>
          {lastResult.abandoned
            ? t('results.abandonedDesc')
            : won ? t('results.victoryDesc') : t('results.piecesHome', { count: myPiecesHome })}
        </div>
        {winnerPlayer && !winnerPlayer.isBot ? (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '26px auto 10px' }}>
            <UserAvatar
              username={winnerPlayer.username}
              size={96}
              fallbackStyle={{
                width: 96, height: 96, borderRadius: '50%',
                background: `linear-gradient(180deg,${COL[lastResult.winner].base},${COL[lastResult.winner].dark})`,
                fontSize: 34, fontWeight: 800, color: '#0d1b28',
              }}
              style={{
                boxShadow: '0 0 0 4px #f0d18a,0 0 40px rgba(240,209,138,.4)',
              }}
            />
          </div>
        ) : (
          <div
            style={{
              width: 96, height: 96, margin: '26px auto 10px', borderRadius: '50%',
              background: `linear-gradient(180deg,${COL[lastResult.winner].base},${COL[lastResult.winner].dark})`,
              display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 800, color: '#0d1b28',
              boxShadow: '0 0 0 4px #f0d18a,0 0 40px rgba(240,209,138,.4)',
            }}
          >
            {winnerInitials}
          </div>
        )}
        <div style={{ fontWeight: 800, fontSize: 16, color: '#f0e2c4', marginBottom: 16 }}>
          {winnerName}
        </div>
        {!lastResult.abandoned && (
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
                {p.color === myColor ? t('common.you') : p.username}
              </div>
              <div style={{ color: '#a99a83', fontSize: 13, fontWeight: 600 }}>
                {t('results.piecesHome', { count: p.piecesInGoal })}
              </div>
            </div>
          ))}
        </div>
        )}
        {rematchError && (
          <div style={{ color: '#e05050', fontSize: 13, marginBottom: 12 }}>{rematchError}</div>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          {lastResult.abandoned ? (
            <>
              <button onClick={() => navigate('/lobby')} style={{ ...btnGold, flex: 1, padding: 14 }}>
                {t('home.goToLobby')}
              </button>
              <button onClick={() => navigate('/home')} style={{ ...btnOutline, flex: 1, padding: 14 }}>
                {t('nav.home')}
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
