import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi, postApi } from '../api'
import { JoinByCode } from '../components/JoinByCode'
import { UserAvatar } from '../components/UserAvatar'
import type { PlayerColor } from '../game/types'
import { navigate } from '../router'
import { useApp } from '../store'
import { COL, btnGold, card, feltPanel, pill, sectionLabel } from '../theme'

type Room = {
  id: string
  roomCode: string
  host: string
  seats: number
  maxSeats: number
  mode: 'classic' | 'duel'
}

type MatchResult = { gameId: string; token: string; engineUrl: string; color: PlayerColor; inviteCode?: string; mode: 'pvp' | 'pve' | 'hotseat'; playerCount: number }

type ModeCard = {
  key: string
  title: string
  desc: string
  glyph: string
  hue: string
  badge: 'casual' | 'ranked' | 'invite' | 'semiRanked'
  onClick: () => void
}

const ROOM_AVATAR_HUES = [COL.red.base, COL.green.base, COL.yellow.base, COL.blue.base]

function hueForHost(host: string): string {
  let hash = 0
  for (let i = 0; i < host.length; i++) hash = (hash * 31 + host.charCodeAt(i)) >>> 0
  return ROOM_AVATAR_HUES[hash % ROOM_AVATAR_HUES.length]
}

export function LudoLobby() {
  const { t } = useTranslation()
  const { user, setActiveMatch } = useApp()

  const [rooms, setRooms] = useState<Room[] | null>(null)
  const [roomFilter, setRoomFilter] = useState<'all' | 'classic' | 'duel'>('all')
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null)

  // Whether the current player already has a WAITING/ACTIVE room — drives the
  // "Create Room" guard (a player may only have one room at a time). Keep the
  // /api/games/mine call silent: the "Your Tables" section is gone, this is a
  // bare boolean, not data rendered to the user.
  const [hasActiveGame, setHasActiveGame] = useState(false)
  const [hostBusy, setHostBusy] = useState(false)

  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [joiningByCode, setJoiningByCode] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const fetchRooms = () => {
    getApi<Room[]>('/api/games/rooms')
      .then((data) => setRooms(data))
      .catch(() => setRooms((prev) => prev ?? []))
  }

  const fetchHasActiveGame = () => {
    getApi<Array<{ id: string }>>('/api/games/mine')
      .then((data) => setHasActiveGame(data.length > 0))
      .catch(() => {})
  }

  useEffect(() => {
    fetchRooms()
    fetchHasActiveGame()
    const iv = setInterval(() => { fetchRooms(); fetchHasActiveGame() }, 1000)
    return () => clearInterval(iv)
  }, [])

  const createRoom = async () => {
    if (hasActiveGame) {
      setError(t('lobbyBrowser.createRoomWhileActiveError'))
      return
    }
    setHostBusy(true)
    setError(null)
    try {
      const res = await postApi<MatchResult>('/api/match/pvp/invite', { clashEnabled: true })
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to host a table')
    } finally {
      setHostBusy(false)
    }
  }

  const rejoinRoom = async (room: Room) => {
    setJoiningRoomId(room.id)
    setError(null)
    try {
      const res = await postApi<MatchResult>(`/api/game/${room.id}/rejoin`, {})
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rejoin table')
      setJoiningRoomId(null)
      fetchRooms()
    }
  }

  const joinByCode = async (code: string) => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    // Typing your own room's code: the backend rejects joining your own invite,
    // so route to the rejoin endpoint instead — same as the Rejoin button.
    const ownRoom = (rooms ?? []).find((r) => r.host === user?.username && r.roomCode === trimmed)
    if (ownRoom) {
      await rejoinRoom(ownRoom)
      return
    }
    setJoiningByCode(true)
    setError(null)
    try {
      const res = await postApi<MatchResult>(`/api/match/join/${encodeURIComponent(trimmed)}`, {})
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
      setJoiningByCode(false)
    }
  }

  const joinRoom = async (room: Room) => {
    setJoiningRoomId(room.id)
    setError(null)
    try {
      const res = await postApi<MatchResult>(`/api/match/join/${encodeURIComponent(room.roomCode)}`, {})
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
      setJoiningRoomId(null)
      fetchRooms()
    }
  }

  const modeCards: ModeCard[] = [
    {
      key: 'vsBots',
      title: t('lobby.vsBots'),
      desc: t('lobbyBrowser.vsBotsDesc'),
      glyph: '♟',
      hue: COL.green.base,
      badge: 'semiRanked',
      onClick: () => navigate('/lobby/table?mode=4&bots=1'),
    },
    {
      key: 'duel2P',
      title: t('lobby.duel2P'),
      desc: t('lobbyBrowser.duel2PDesc'),
      glyph: '✕',
      hue: COL.red.base,
      badge: 'casual',
      onClick: () => navigate('/lobby/table?mode=4&bots=0&local=1'),
    },
  ]

  const badgeStyle = (badge: ModeCard['badge']): React.CSSProperties => {
    const hue = badge === 'ranked' ? '#f0c24e' : badge === 'semiRanked' ? '#8fc47a' : badge === 'casual' ? '#4bbf7b' : '#4a92e0'
    return {
      fontSize: 10.5, fontWeight: 800, letterSpacing: '.04em', color: hue,
      background: `${hue}22`, border: `1px solid ${hue}55`, borderRadius: 999, padding: '3px 8px',
    }
  }
  const badgeLabel = (badge: ModeCard['badge']) =>
    badge === 'ranked' ? t('lobbyBrowser.ranked')
      : badge === 'semiRanked' ? t('lobbyBrowser.semiRanked')
      : badge === 'casual' ? t('lobbyBrowser.casual')
      : t('lobbyBrowser.invite')

  const filteredRooms = (rooms ?? []).filter((r) => roomFilter === 'all' || r.mode === roomFilter)

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
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, color: '#f4e9cf' }}>{t('lobby.title')}</div>
            <div style={{ color: '#a99a83', fontSize: 13 }}>{t('lobbyBrowser.subtitle')}</div>
          </div>
        </div>
      </header>

      <div
        style={{
          flex: 1, display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 26, padding: '30px 34px',
          alignItems: 'start', maxWidth: 1300, margin: '0 auto', width: '100%',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={sectionLabel}>{t('lobbyBrowser.gameModes')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {modeCards.map((m) => (
                <div
                  key={m.key}
                  onClick={m.onClick}
                  style={{
                    cursor: 'pointer', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
                    ...card,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div
                      style={{
                        width: 46, height: 46, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 22,
                        color: m.hue, background: 'rgba(255,255,255,.04)', border: `1px solid ${m.hue}44`,
                      }}
                    >
                      {m.glyph}
                    </div>
                    <span style={badgeStyle(m.badge)}>{badgeLabel(m.badge)}</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#f0e2c4' }}>{m.title}</div>
                  <div style={{ color: '#a99a83', fontSize: 13, lineHeight: 1.4 }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={sectionLabel}>{t('lobbyBrowser.openRooms')} · {filteredRooms.length}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span onClick={() => setRoomFilter('all')} style={pill(roomFilter === 'all')}>{t('lobbyBrowser.filterAll')}</span>
                <span onClick={() => setRoomFilter('classic')} style={pill(roomFilter === 'classic')}>{t('lobbyBrowser.filter4Player')}</span>
              </div>
            </div>

            <div style={{ ...card, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 1fr 1fr auto', gap: 12, padding: '10px 18px',
                  borderBottom: '1px solid #2a2015', fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
                  textTransform: 'uppercase', color: '#a99a83',
                }}
              >
                <div>{t('lobbyBrowser.colRoomId')}</div>
                <div>{t('lobbyBrowser.colHost')}</div>
                <div>{t('lobbyBrowser.colSeats')}</div>
                <div>{t('lobbyBrowser.colStakes')}</div>
                <div />
              </div>

              {rooms === null ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#a99a83', fontSize: 13.5 }}>{t('lobbyBrowser.loadingRooms')}</div>
              ) : filteredRooms.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#a99a83', fontSize: 13.5 }}>{t('lobbyBrowser.noOpenRooms')}</div>
              ) : (
                filteredRooms.map((room) => {
                  const isOwn = room.host === user?.username
                  const full = room.seats >= room.maxSeats
                  const hue = hueForHost(room.host)
                  return (
                    <div
                      key={room.id}
                      style={{
                        display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 1fr 1fr auto', gap: 12, padding: '14px 18px',
                        borderBottom: '1px solid #2a2015', alignItems: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: '.06em', color: '#e8dcc6' }}>{room.roomCode}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UserAvatar
                          username={room.host}
                          size={30}
                          fallbackStyle={{
                            width: 30, height: 30, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center',
                            fontWeight: 800, fontSize: 11, color: '#12100a', background: hue,
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: '#f0e2c4' }}>{room.host}</div>
                          <div style={{ color: '#a99a83', fontSize: 12 }}>
                            {room.maxSeats}-player · {room.mode === 'duel' ? 'duel' : 'classic'}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: full ? '#e05050' : '#4bbf7b' }}>
                        {room.seats}/{room.maxSeats}
                      </div>
                      <div>
                        <span style={badgeStyle('ranked')}>{t('lobbyBrowser.ranked')}</span>
                      </div>
                      <button
                        onClick={() => (isOwn ? rejoinRoom(room) : joinRoom(room))}
                        disabled={(!isOwn && full) || joiningRoomId === room.id}
                        style={{
                          ...btnGold, padding: '8px 16px', fontSize: 12.5,
                          opacity: (!isOwn && full) || joiningRoomId === room.id ? 0.4 : 1,
                          cursor: !isOwn && full ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isOwn
                          ? (joiningRoomId === room.id ? t('lobbyBrowser.joiningBtn') : t('lobbyBrowser.rejoinBtn'))
                          : full ? t('lobbyBrowser.fullBtn') : joiningRoomId === room.id ? t('lobbyBrowser.joiningBtn') : t('lobbyBrowser.joinBtn')}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>
          <div style={{ ...feltPanel, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 17, color: '#dff0e0' }}>{t('lobbyBrowser.hostTableTitle')}</div>
            <div style={{ color: '#c9d9c9', fontSize: 13, lineHeight: 1.5 }}>{t('lobbyBrowser.hostTableDesc')}</div>
            <button
              onClick={createRoom}
              disabled={hostBusy}
              style={{ ...btnGold, opacity: hostBusy ? 0.6 : 1 }}
            >
              {hostBusy ? t('lobbyBrowser.creatingTableBtn') : t('lobbyBrowser.createTableBtn')}
            </button>
          </div>

          <JoinByCode
            value={roomCodeInput}
            onChange={setRoomCodeInput}
            onSubmit={() => joinByCode(roomCodeInput)}
            busy={joiningByCode}
          />

          {error && (
            <div style={{ textAlign: 'center', color: '#e05050', fontSize: 12.5 }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  )
}