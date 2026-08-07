import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { postApi } from '../api'
import { Board } from '../components/Board'
import type { PlayerColor } from '../game/types'
import { navigate, useRoute } from '../router'
import { useApp, type PlayerCount } from '../store'
import { COL, SEAT_COLORS, card, feltPanel, sectionLabel, type ColorKey } from '../theme'

const COLOR_KEYS: Record<ColorKey, string> = {
  red: 'lobby.colorRed',
  green: 'lobby.colorGreen',
  yellow: 'lobby.colorYellow',
  blue: 'lobby.colorBlue',
}

export function Lobby() {
  const { t } = useTranslation()
  const { query } = useRoute()
  const { seats, addBot, removeBot, addPlayer, removePlayer, renamePlayer, setActiveMatch } = useApp()
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [editingSeat, setEditingSeat] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  // Route-derived lobby configuration (single source of truth)
  const playerCount = (Number(query.get('mode')) as PlayerCount) || 4
  const allowAddPlayers = query.get('bots') !== '0'

  const visible = seats.slice(0, playerCount)
  const botCount = visible.filter((s) => s.type === 'bot').length
  const emptyCount = visible.filter((s) => s.type === 'empty').length
  // Hotseat/Multiplayer can start when at least the host + 1 other is seated.
  // Vs Bots can start once at least 1 bot is seated.
  const canStart = allowAddPlayers
    ? botCount >= 1
    : visible.filter((s) => s.type === 'you' || s.type === 'player').length >= 2

  const startBtnStyle: CSSProperties = canStart
    ? {
      border: 'none', borderRadius: 12, padding: 14, font: "800 15px 'Hanken Grotesk'", color: '#2a1c07',
      cursor: 'pointer', background: 'linear-gradient(180deg,#f0d18a,#c99b45)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.55),0 12px 22px -12px rgba(190,140,55,.8)', marginTop: 4,
    }
    : {
      border: '1px solid #3a2c1d', borderRadius: 12, padding: 14, font: "800 15px 'Hanken Grotesk'",
      color: '#6b5d49', cursor: 'not-allowed', background: '#1a130d', marginTop: 4,
    }

  const onStart = async () => {
    if (!canStart || starting) return
    setStartError(null)
    setStarting(true)
    try {
      const gameMode = allowAddPlayers ? 'pve' : (playerCount === 2 ? 'hotseat' : 'pvp')
      const res = await postApi<{ gameId: string; token: string; engineUrl: string; color: PlayerColor }>(
        '/api/match/create',
        {
          mode: gameMode,
          playerCount: playerCount,
          botCount: allowAddPlayers ? visible.filter((s) => s.type === 'bot').length : 0,
          clashEnabled: true,
        },
      )
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Failed to create match')
      setStarting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', borderBottom: '1px solid #2e2115' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            onClick={() => navigate('/home')}
            style={{
              cursor: 'pointer', width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center',
              border: '1px solid #3a2c1d', background: '#1a130d', fontSize: 16, color: '#c9bda3',
            }}
          >
            ←
          </div>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, color: '#f4e9cf' }}>{t('lobby.tableSetup')}</div>
            <div style={{ color: '#a99a83', fontSize: 13 }}>{t('lobby.privateMatchDesc')}</div>
          </div>
        </div>
      </header>

      <div
        style={{
          flex: 1, display: 'grid', gridTemplateColumns: '1.35fr .9fr', gap: 26, padding: '30px 34px',
          alignItems: 'start', maxWidth: 1200, margin: '0 auto', width: '100%',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={sectionLabel}>{t('lobby.seatsCount', { count: playerCount })}</div>
          <div style={{ display: 'grid', gridTemplateColumns: playerCount === 2 ? '1fr 1fr' : '1fr 1fr', gap: 16 }}>
            {visible.map((seat, i) => {
              const ck = SEAT_COLORS[i]
              const col = COL[ck]
              const colorName = t(COLOR_KEYS[ck])
              const avStyle: CSSProperties = {
                width: 42, height: 42, flex: 'none', borderRadius: 11, display: 'grid', placeItems: 'center',
                fontWeight: 800, fontSize: 14, color: '#12100a', background: `linear-gradient(180deg,${col.base},${col.dark})`,
              }
              return (
                <div key={i} style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, background: 'linear-gradient(180deg,#241b13,#1a130d)', border: '1px solid #3a2c1d' }}>
                  <div style={{ height: 4, background: col.base }} />
                  <div style={{ padding: '18px 18px 20px', minHeight: 150, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {seat.type === 'you' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={avStyle}>YO</div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: '#f0e2c4' }}>
                              {t('common.you')} <span style={{ color: '#c99b45', fontSize: 11, fontWeight: 700 }}>{t('lobby.hostBadge')}</span>
                            </div>
                            <div style={{ color: '#a99a83', fontSize: '12.5px' }}>{colorName}</div>
                          </div>
                        </div>
                        <div style={{ marginTop: 'auto', fontSize: '12.5px', color: '#7fae91', fontWeight: 700 }}>✓ {t('lobby.readyBadge')}</div>
                      </>
                    )}
                    {seat.type === 'bot' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={avStyle}>{seat.name.slice(0, 2).toUpperCase()}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 15, color: '#f0e2c4' }}>
                              {seat.name} <span style={{ color: '#a99a83', fontSize: 11, fontWeight: 700 }}>{t('lobby.botBadge')}</span>
                            </div>
                            <div style={{ color: '#a99a83', fontSize: '12.5px' }}>{t('lobby.colorPiece', { color: colorName })}</div>
                          </div>
                          <div
                            onClick={() => removeBot(i)}
                            style={{
                              cursor: 'pointer', color: '#a99a83', fontSize: 15, width: 26, height: 26,
                              display: 'grid', placeItems: 'center', borderRadius: 7, border: '1px solid #3a2c1d',
                            }}
                          >
                            ✕
                          </div>
                        </div>
                      </>
                    )}
                    {seat.type === 'player' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={avStyle}>{seat.name.slice(0, 2).toUpperCase()}</div>
                          <div style={{ flex: 1 }}>
                            {editingSeat === i ? (
                              <input
                                autoFocus
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={() => { renamePlayer(i, editName.trim() || seat.name); setEditingSeat(null) }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { renamePlayer(i, editName.trim() || seat.name); setEditingSeat(null) } }}
                                style={{
                                  width: '100%', background: '#1a130d', border: '1px solid #c99b45', borderRadius: 6,
                                  color: '#f0e2c4', padding: '4px 8px', fontSize: 14, fontWeight: 800,
                                }}
                              />
                            ) : (
                              <div
                                onClick={() => { setEditingSeat(i); setEditName(seat.name) }}
                                style={{ fontWeight: 800, fontSize: 15, color: '#f0e2c4', cursor: 'pointer' }}
                              >
                                {seat.name} <span style={{ color: '#a99a83', fontSize: 11, fontWeight: 700 }}>{t('lobby.playerBadge')}</span>
                              </div>
                            )}
                            <div style={{ color: '#a99a83', fontSize: '12.5px' }}>{t('lobby.colorPiece', { color: colorName })}</div>
                          </div>
                          <div
                            onClick={() => removePlayer(i)}
                            style={{
                              cursor: 'pointer', color: '#a99a83', fontSize: 15, width: 26, height: 26,
                              display: 'grid', placeItems: 'center', borderRadius: 7, border: '1px solid #3a2c1d',
                            }}
                          >
                            ✕
                          </div>
                        </div>
                      </>
                    )}
                    {seat.type === 'empty' && allowAddPlayers && (
                      <div
                        onClick={() => addBot(i)}
                        style={{
                          cursor: 'pointer', flex: 1, border: '1.5px dashed #4a3826', borderRadius: 12, display: 'flex',
                          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                          color: '#a99a83', minHeight: 120,
                        }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px dashed #4a3826', display: 'grid', placeItems: 'center', fontSize: 22, color: '#c99b45' }}>
                          +
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{t('lobby.addABot')}</div>
                      </div>
                    )}
                    {seat.type === 'empty' && !allowAddPlayers && (
                      <div
                        onClick={() => addPlayer(i)}
                        style={{
                          cursor: 'pointer', flex: 1, border: '1.5px dashed #4a3826', borderRadius: 12, display: 'flex',
                          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                          color: '#a99a83', minHeight: 120,
                        }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px dashed #4a3826', display: 'grid', placeItems: 'center', fontSize: 22, color: '#c99b45' }}>
                          +
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{t('lobby.addAPlayer')}</div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>
          <div style={{ ...feltPanel, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 190 }}>
              <Board />
            </div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 15, color: '#dff0e0', letterSpacing: '.04em' }}>
              {t('lobby.classicCrossBoard')}
            </div>
          </div>
          <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: '#a99a83' }}>{t('lobby.players')}</span>
              <span style={{ fontWeight: 700 }}>{playerCount - emptyCount} / {playerCount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: '#a99a83' }}>{t('lobby.botsLabel')}</span>
              <span style={{ fontWeight: 700 }}>
                {botCount === 1 ? t('lobby.botSingular', { count: botCount }) : t('lobby.botPlural', { count: botCount })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: '#a99a83' }}>{t('lobby.mode')}</span>
              <span style={{ fontWeight: 700 }}>{t('lobby.casualUnranked')}</span>
            </div>
            <button
              onClick={onStart}
              disabled={!canStart || starting}
              style={{ ...startBtnStyle, opacity: starting ? 0.7 : 1 }}
            >
              {starting ? 'Creating match…' : canStart ? 'Start game' : 'Add a bot to start'}
            </button>
            {startError && (
              <div style={{ textAlign: 'center', color: '#e05050', fontSize: 12 }}>{startError}</div>
            )}
            <div style={{ textAlign: 'center', color: '#a99a83', fontSize: 12 }}>
              {canStart
                ? (botCount > 1 ? t('lobby.youPlusBots', { count: botCount }) : t('lobby.youPlusBot', { count: botCount }))
                : t('lobby.atLeastOneOpponent')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
