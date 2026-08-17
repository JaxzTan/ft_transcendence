import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { postApi, getApi } from '../api'
import type { PlayerColor } from '../game/types'
import { navigate } from '../router'
import { useApp } from '../store'
import { btnGold, btnOutline, card } from '../theme'

type RoomStatus = 'idle' | 'waiting' | 'playing'

export function MultiplayerLobby() {
  const { t } = useTranslation()
  const { setActiveMatch } = useApp()
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState<null | 'create' | 'join' | 'ready' | 'exit' | 'quick'>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<RoomStatus>('idle')
  const [gameId, setGameId] = useState<string | null>(null)
  const [readyCount, setReadyCount] = useState(0)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [allReady, setAllReady] = useState(false)

  const startWaiting = useCallback((gid: string) => {
    setGameId(gid)
    setStatus('waiting')
    setAllReady(false)
    setReadyCount(0)
    setTotalPlayers(0)
  }, [])

  const createGame = async () => {
    setError(null)
    setBusy('create')
    try {
      const res = await postApi<{ gameId: string; token: string; engineUrl: string; color: PlayerColor; inviteCode?: string; mode: 'pvp' | 'pve' | 'hotseat'; playerCount: number }>('/api/match/create', {
        mode: 'pvp',
        playerCount: 4,
        botCount: 0,
        clashEnabled: true,
      })
      setActiveMatch(res)
      startWaiting(res.gameId)
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
      const res = await postApi<{ gameId: string; token: string; engineUrl: string; color: PlayerColor; inviteCode?: string; mode: 'pvp' | 'pve' | 'hotseat'; playerCount: number }>(`/api/match/join/${encodeURIComponent(inviteCode.trim())}`, {})
      setActiveMatch(res)
      startWaiting(res.gameId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join match')
      setBusy(null)
    }
  }

  const quickMatch = async () => {
    setError(null)
    setBusy('quick')
    try {
      const res = await postApi<{ gameId: string; token: string; engineUrl: string; color: PlayerColor; inviteCode?: string; mode: 'pvp' | 'pve' | 'hotseat'; playerCount: number }>('/api/match/pvp/random', {})
      setActiveMatch(res)
      startWaiting(res.gameId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quick match failed')
      setBusy(null)
    }
  }

  const toggleReady = async () => {
    if (!gameId) return
    setBusy('ready')
    try {
      const res = await postApi<{ message: string; gameId: string; readyCount: number; totalPlayers: number; allReady: boolean }>(`/api/game/${gameId}/ready`, {})
      setReadyCount(res.readyCount)
      setTotalPlayers(res.totalPlayers)
      setAllReady(res.allReady)
      if (res.allReady) {
        navigate(`/game?gameId=${gameId}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ready failed')
    } finally {
      setBusy(null)
    }
  }

  const exitRoom = async () => {
    if (!gameId) return
    setBusy('exit')
    try {
      await postApi(`/api/game/${gameId}/resign`, {})
      setStatus('idle')
      setGameId(null)
      setAllReady(false)
      setReadyCount(0)
      setTotalPlayers(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Exit failed')
    } finally {
      setBusy(null)
    }
  }

  // Poll my rooms to detect when game starts or room closes
  useEffect(() => {
    if (status !== 'waiting' || !gameId) return
    const interval = setInterval(async () => {
      try {
        const rooms = await getApi<Array<{ id: string; status: string }>>('/api/games/mine')
        const mine = rooms.find(r => r.id === gameId)
        if (!mine) {
          setStatus('idle')
          setGameId(null)
          setAllReady(false)
          return
        }
        if (mine.status === 'ACTIVE' || mine.status === 'ENDED') {
          navigate(`/game?gameId=${gameId}`)
        }
      } catch { /* ignore poll errors */ }
    }, 2000)
    return () => clearInterval(interval)
  }, [status, gameId])

  if (status === 'waiting' && gameId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'radial-gradient(90% 80% at 50% 0%,#22432f,#12100a 70%)' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 32px', borderBottom: '1px solid #2e2115' }}>
          <div onClick={() => { setStatus('idle'); setGameId(null); setAllReady(false); setReadyCount(0); setTotalPlayers(0) }}
            style={{ cursor: 'pointer', width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', border: '1px solid #3a2c1d', background: '#1a130d', fontSize: 16, color: '#c9bda3' }}>←</div>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, color: '#f4e9cf' }}>{t('multiplayer.title')}</div>
            <div style={{ color: '#a99a83', fontSize: 13 }}>{t('multiplayer.subtitle')}</div>
          </div>
        </header>

        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 30 }}>
          <div style={{ ...card, padding: 28, maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#f0e2c4' }}>{t('multiplayer.waitingForPlayers')}</div>
            <div style={{ color: '#a99a83', fontSize: 14 }}>
              {readyCount}/{totalPlayers} players ready
              {allReady && <span style={{ color: '#7ec699', marginLeft: 8 }}>— Starting!</span>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={toggleReady} disabled={busy !== null} style={{ ...btnGold, flex: 1, padding: '13px 22px' }}>
                {busy === 'ready' ? '…' : allReady ? 'Ready ✓' : 'Ready'}
              </button>
              <button onClick={exitRoom} disabled={busy !== null} style={{ ...btnOutline, padding: '13px 22px' }}>
                {busy === 'exit' ? '…' : 'Exit'}
              </button>
            </div>
          </div>
        </div>

        {error && <div style={{ textAlign: 'center', color: '#e05050', fontSize: 13, marginBottom: 20 }}>{error}</div>}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'radial-gradient(90% 80% at 50% 0%,#22432f,#12100a 70%)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 32px', borderBottom: '1px solid #2e2115' }}>
        <div onClick={() => navigate('/home')} style={{ cursor: 'pointer', width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', border: '1px solid #3a2c1d', background: '#1a130d', fontSize: 16, color: '#c9bda3' }}>←</div>
        <div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, color: '#f4e9cf' }}>{t('multiplayer.title')}</div>
          <div style={{ color: '#a99a83', fontSize: 13 }}>{t('multiplayer.subtitle')}</div>
        </div>
      </header>

      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 30 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 760, width: '100%' }}>
          {/* Quick Match */}
          <div style={{ ...card, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 24, color: '#e05050', background: 'rgba(255,255,255,.04)', border: '1px solid #e0505044' }}>⚡</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#f0e2c4' }}>{t('multiplayer.quickTitle')}</div>
            <div style={{ color: '#a99a83', fontSize: 14, lineHeight: 1.5 }}>{t('multiplayer.quickDesc')}</div>
            <button onClick={quickMatch} disabled={busy !== null} style={{ ...btnGold, padding: '13px 22px', marginTop: 'auto' }}>
              {busy === 'quick' ? '…' : 'Find Match'}
            </button>
          </div>

          {/* Create Game */}
          <div style={{ ...card, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 24, color: '#f0c24e', background: 'rgba(255,255,255,.04)', border: '1px solid #f0c24e44' }}>✦</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#f0e2c4' }}>{t('multiplayer.createGame')}</div>
            <div style={{ color: '#a99a83', fontSize: 14, lineHeight: 1.5 }}>{t('multiplayer.createGameDesc')}</div>
            <button onClick={createGame} disabled={busy !== null} style={{ ...btnGold, padding: '13px 22px', marginTop: 'auto' }}>
              {busy === 'create' ? '…' : t('multiplayer.create')}
            </button>
          </div>

          {/* Join Game */}
          <div style={{ ...card, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 24, color: '#4a92e0', background: 'rgba(255,255,255,.04)', border: '1px solid #4a92e044' }}>⌘</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#f0e2c4' }}>{t('multiplayer.joinGame')}</div>
            <div style={{ color: '#a99a83', fontSize: 14, lineHeight: 1.5 }}>{t('multiplayer.joinGameDesc')}</div>
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB3X9K"
              style={{ width: '100%', background: '#1a130d', border: '1px solid #3a2c1d', borderRadius: 10, color: '#f0e2c4', padding: '12px 14px', fontSize: 16, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase' }}
            />
            <button onClick={joinGame} disabled={busy !== null} style={{ ...btnOutline, padding: '13px 22px' }}>
              {busy === 'join' ? '…' : t('multiplayer.join')}
            </button>
          </div>
        </div>
      </div>

      {error && <div style={{ textAlign: 'center', color: '#e05050', fontSize: 13, marginBottom: 20 }}>{error}</div>}
    </div>
  )
}