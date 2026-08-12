import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { postApi } from '../api'
import type { PlayerColor } from '../game/types'
import { navigate } from '../router'
import { useApp } from '../store'
import { btnGold, btnOutline, card } from '../theme'

export function MultiplayerLobby() {
  const { t } = useTranslation()
  const { setActiveMatch } = useApp()
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState<null | 'create' | 'join'>(null)
  const [error, setError] = useState<string | null>(null)

  const createGame = async () => {
    setError(null)
    setBusy('create')
    try {
      const res = await postApi<{ gameId: string; token: string; engineUrl: string; color: PlayerColor; inviteCode?: string }>('/api/match/create', {
        mode: 'pvp',
        playerCount: 4,
        botCount: 0,
        clashEnabled: true,
      })
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create match')
      setBusy(null)
    }
  }

  const joinGame = async () => {
    if (!inviteCode.trim()) { setError('Enter an invite code'); return }
    setError(null)
    setBusy('join')
    try {
      const res = await postApi<{ gameId: string; token: string; engineUrl: string; color: PlayerColor; inviteCode?: string }>(`/api/match/join/${encodeURIComponent(inviteCode.trim())}`, {})
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join match')
      setBusy(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'radial-gradient(100% 100% at 50% 10%, rgba(93,228,199,0.18) 0%, rgba(137,221,255,0.22) 45%, #13151f 100%)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 36px', borderBottom: '1px solid rgba(93,228,199,0.15)', background: 'rgba(20,23,35,0.65)', backdropFilter: 'blur(16px)' }}>
        <div
          onClick={() => navigate('/home')}
          style={{
            cursor: 'pointer', width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center',
            border: '1px solid rgba(93,228,199,0.25)', background: 'rgba(255,255,255,0.06)', fontSize: 16, color: '#f0f4fc',
          }}
        >
          ←
        </div>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontSize: 24, fontWeight: 900, color: '#f0f4fc' }}>{t('multiplayer.title')}</div>
          <div style={{ color: '#a6accd', fontSize: 13.5, fontWeight: 500 }}>{t('multiplayer.subtitle')}</div>
        </div>
      </header>

      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 30 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 800, width: '100%' }}>
          {/* Create Game */}
          <div className="interactive-card" style={{ ...card, padding: 32, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, display: 'grid', placeItems: 'center', fontSize: 26, color: '#13151f', background: 'linear-gradient(135deg, #5de4c7, #89ddff)', boxShadow: '0 0 20px rgba(93,228,199,0.5)' }}>
              ✦
            </div>
            <div style={{ fontWeight: 900, fontSize: 20, color: '#f0f4fc', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{t('multiplayer.createGame')}</div>
            <div style={{ color: '#a6accd', fontSize: 14, lineHeight: 1.5 }}>{t('multiplayer.createGameDesc')}</div>
            <button onClick={createGame} disabled={busy !== null} style={{ ...btnGold, padding: '14px 24px', marginTop: 'auto' }}>
              {busy === 'create' ? '…' : t('multiplayer.create')}
            </button>
          </div>

          {/* Join Game */}
          <div className="interactive-card" style={{ ...card, padding: 32, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, display: 'grid', placeItems: 'center', fontSize: 26, color: '#13151f', background: 'linear-gradient(135deg, #89ddff, #d0679d)', boxShadow: '0 0 20px rgba(137,221,255,0.5)' }}>
              ⌘
            </div>
            <div style={{ fontWeight: 900, fontSize: 20, color: '#f0f4fc', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{t('multiplayer.joinGame')}</div>
            <div style={{ color: '#a6accd', fontSize: 14, lineHeight: 1.5 }}>{t('multiplayer.joinGameDesc')}</div>
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB3X9K"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(93,228,199,0.3)', borderRadius: 12,
                color: '#f0f4fc', padding: '13px 16px', fontSize: 16, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase',
                fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
              }}
            />
            <button onClick={joinGame} disabled={busy !== null} style={{ ...btnOutline, padding: '14px 24px' }}>
              {busy === 'join' ? '…' : t('multiplayer.join')}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ textAlign: 'center', color: '#d0679d', fontSize: 13.5, marginBottom: 24, fontWeight: 600 }}>{error}</div>
      )}
    </div>
  )
}