import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi, postApi } from '../api'
import type { PlayerColor } from '../game/types'
import { navigate } from '../router'
import { useApp } from '../store'
import { COL, btnGold, btnGoldSmall, btnOutline, card, feltPanel, pill, sectionLabel } from '../theme'

type Room = {
  id: string
  roomCode: string
  host: string
  seats: number
  maxSeats: number
  mode: 'classic' | 'duel'
}

type MyRoom = {
  id: string
  roomCode: string | null
  status: 'WAITING' | 'ACTIVE'
  gameType: string
  seats: number
  maxSeats: number
}

type MatchResult = { gameId: string; token: string; engineUrl: string; color: PlayerColor; inviteCode?: string }

type ModeCard = {
  key: string
  title: string
  desc: string
  glyph: string
  hue: string
  badge: 'casual' | 'ranked' | 'invite'
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
  const { setActiveMatch } = useApp()
  const joinPanelRef = useRef<HTMLDivElement>(null)
  const roomInputRef = useRef<HTMLInputElement>(null)

  const [rooms, setRooms] = useState<Room[] | null>(null)
  const [roomFilter, setRoomFilter] = useState<'all' | 'classic' | 'duel'>('all')
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null)

  const [myRooms, setMyRooms] = useState<MyRoom[]>([])
  const [rejoiningId, setRejoiningId] = useState<string | null>(null)

  const [quickMatchBusy, setQuickMatchBusy] = useState(false)

  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [joiningByCode, setJoiningByCode] = useState(false)

  const [yourTablesExpanded, setYourTablesExpanded] = useState(true)
  const [openRoomsExpanded, setOpenRoomsExpanded] = useState(true)

  const [error, setError] = useState<string | null>(null)

  const fetchRooms = () => {
    getApi<Room[]>('/api/games/rooms')
      .then((data) => setRooms(data))
      .catch(() => setRooms((prev) => prev ?? []))
  }

  const fetchMyRooms = () => {
    getApi<MyRoom[]>('/api/games/mine')
      .then((data) => setMyRooms(data))
      .catch(() => { })
  }

  useEffect(() => {
    fetchRooms()
    fetchMyRooms()
    const iv = setInterval(() => { fetchRooms(); fetchMyRooms() }, 5000)
    return () => clearInterval(iv)
  }, [])

  const rejoinRoom = async (room: MyRoom) => {
    setRejoiningId(room.id)
    setError(null)
    try {
      const res = await postApi<MatchResult>(`/api/game/${room.id}/rejoin`, {})
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rejoin table')
      setRejoiningId(null)
      fetchMyRooms()
    }
  }

  const findMeATable = async () => {
    setQuickMatchBusy(true)
    setError(null)
    try {
      const res = await postApi<MatchResult>('/api/match/pvp/random', { clashEnabled: true })
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find a table')
      setQuickMatchBusy(false)
    }
  }

  const joinByCode = async (code: string) => {
    if (!code.trim()) return
    setJoiningByCode(true)
    setError(null)
    try {
      const res = await postApi<MatchResult>(`/api/match/join/${encodeURIComponent(code.trim().toUpperCase())}`, {})
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
      badge: 'casual',
      onClick: () => navigate('/lobby/table?mode=4&bots=1'),
    },
    {
      key: 'classic4P',
      title: t('lobby.classic4P'),
      desc: t('lobbyBrowser.classic4PDesc'),
      glyph: '✦',
      hue: COL.yellow.base,
      badge: 'ranked',
      onClick: () => navigate('/lobby/table?mode=4&bots=0'),
    },
    {
      key: 'duel2P',
      title: t('lobby.duel2P'),
      desc: t('lobbyBrowser.duel2PDesc'),
      glyph: '✕',
      hue: COL.red.base,
      badge: 'ranked',
      onClick: () => navigate('/lobby/table?mode=2&bots=0'),
    },
    {
      key: 'privateTable',
      title: t('lobby.privateTable'),
      desc: t('lobbyBrowser.privateTableDesc'),
      glyph: '⌘',
      hue: COL.blue.base,
      badge: 'invite',
      onClick: () => {
        joinPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        roomInputRef.current?.focus()
      },
    },
  ]

  const badgeStyle = (badge: ModeCard['badge']): React.CSSProperties => {
    const hue = badge === 'ranked' ? '#ffd66b' : badge === 'casual' ? '#a78bfa' : '#6bb8ff'
    return {
      fontSize: 11, fontWeight: 800, letterSpacing: '.06em', color: hue,
      background: `${hue}20`, border: `1px solid ${hue}55`, borderRadius: 999, padding: '4px 10px',
      fontFamily: "'Space Grotesk', 'Outfit', sans-serif", textTransform: 'uppercase',
    }
  }
  const badgeLabel = (badge: ModeCard['badge']) =>
    badge === 'ranked' ? t('lobbyBrowser.ranked') : badge === 'casual' ? t('lobbyBrowser.casual') : t('lobbyBrowser.invite')

  const filteredRooms = (rooms ?? []).filter((r) => roomFilter === 'all' || r.mode === roomFilter)

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          flex: 1, display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 28,
          alignItems: 'start', maxWidth: 1320, margin: '0 auto', width: '100%',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...sectionLabel, color: '#a78bfa' }}>{t('lobbyBrowser.gameModes')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {modeCards.map((m) => (
                <div
                  key={m.key}
                  onClick={m.onClick}
                  className="interactive-card"
                  style={{
                    cursor: 'pointer', borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', gap: 12,
                    background: 'linear-gradient(145deg, rgba(40,28,65,0.85), rgba(25,18,42,0.95))',
                    border: '1px solid rgba(167,139,250,0.25)',
                    boxShadow: '0 12px 28px -8px rgba(0,0,0,0.5)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div
                      style={{
                        width: 50, height: 50, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 24,
                        color: '#0f0a1a', background: `linear-gradient(135deg, ${m.hue}, ${m.hue}aa)`,
                        boxShadow: `0 0 16px ${m.hue}66`,
                      }}
                    >
                      {m.glyph}
                    </div>
                    <span style={badgeStyle(m.badge)}>{badgeLabel(m.badge)}</span>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 17, color: '#f8f0ff', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{m.title}</div>
                  <div style={{ color: '#b8a9d4', fontSize: 13.5, lineHeight: 1.45 }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {myRooms.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                onClick={() => setYourTablesExpanded((prev) => !prev)}
                style={{
                  ...sectionLabel,
                  color: '#6bb8ff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  userSelect: 'none',
                  padding: '4px 0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{t('lobbyBrowser.yourTables')} · {myRooms.length}</span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    transition: 'transform 0.2s ease',
                    transform: yourTablesExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                    color: '#6bb8ff',
                  }}
                >
                  ▼
                </div>
              </div>
              <div
                style={{
                  maxHeight: yourTablesExpanded ? 1000 : 0,
                  opacity: yourTablesExpanded ? 1 : 0,
                  overflow: 'hidden',
                  transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
                }}
              >
                <div style={{ ...card, overflow: 'hidden' }}>
                  {myRooms.map((room, i) => (
                    <div
                      key={room.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
                        borderBottom: i < myRooms.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 14.5, color: '#f8f0ff', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                          {room.roomCode ?? room.gameType} <span style={{ color: '#b8a9d4', fontWeight: 600 }}>· {room.seats}/{room.maxSeats}</span>
                        </div>
                        <div style={{ color: '#b8a9d4', fontSize: 12.5 }}>
                          {room.status === 'WAITING' ? t('lobbyBrowser.statusWaiting') : t('lobbyBrowser.statusActive')}
                        </div>
                      </div>
                      <button
                        onClick={() => rejoinRoom(room)}
                        disabled={rejoiningId === room.id}
                        style={{ ...btnGoldSmall, padding: '8px 18px', fontSize: 13, opacity: rejoiningId === room.id ? 0.6 : 1 }}
                      >
                        {rejoiningId === room.id ? t('lobbyBrowser.joiningBtn') : t('lobbyBrowser.rejoinBtn')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                onClick={() => setOpenRoomsExpanded((prev) => !prev)}
                style={{
                  ...sectionLabel,
                  color: '#a78bfa',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  userSelect: 'none',
                  padding: '4px 0',
                }}
              >
                <span>{t('lobbyBrowser.openRooms')} · {filteredRooms.length}</span>
                <span
                  style={{
                    fontSize: 12,
                    display: 'inline-block',
                    transition: 'transform 0.2s ease',
                    transform: openRoomsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                    color: '#a78bfa',
                  }}
                >
                  ▼
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span onClick={() => setRoomFilter('all')} style={pill(roomFilter === 'all')}>{t('lobbyBrowser.filterAll')}</span>
                <span onClick={() => setRoomFilter('classic')} style={pill(roomFilter === 'classic')}>{t('lobbyBrowser.filter4Player')}</span>
                <span onClick={() => setRoomFilter('duel')} style={pill(roomFilter === 'duel')}>{t('lobbyBrowser.filterDuel')}</span>
              </div>
            </div>

            <div
              style={{
                maxHeight: openRoomsExpanded ? 2000 : 0,
                opacity: openRoomsExpanded ? 1 : 0,
                overflow: 'hidden',
                transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
              }}
            >
              <div style={{ ...card, overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 1fr 1fr auto', gap: 12, padding: '14px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 11.5, fontWeight: 800, letterSpacing: '.08em',
                    textTransform: 'uppercase', color: '#b8a9d4', fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                  }}
                >
                  <div>{t('lobbyBrowser.colRoomId')}</div>
                  <div>{t('lobbyBrowser.colHost')}</div>
                  <div>{t('lobbyBrowser.colSeats')}</div>
                  <div>{t('lobbyBrowser.colStakes')}</div>
                  <div />
                </div>

                {rooms === null ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#b8a9d4', fontSize: 14 }}>{t('lobbyBrowser.loadingRooms')}</div>
                ) : filteredRooms.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#b8a9d4', fontSize: 14 }}>{t('lobbyBrowser.noOpenRooms')}</div>
                ) : (
                  filteredRooms.map((room) => {
                    const full = room.seats >= room.maxSeats
                    const hue = hueForHost(room.host)
                    return (
                      <div
                        key={room.id}
                        style={{
                          display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 1fr 1fr auto', gap: 12, padding: '16px 20px',
                          borderBottom: '1px solid rgba(255,255,255,0.06)', alignItems: 'center',
                        }}
                      >
                        <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: '.08em', color: '#f8f0ff', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{room.roomCode}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 32, height: 32, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center',
                              fontWeight: 900, fontSize: 12, color: '#0f0a1a', background: hue,
                              boxShadow: `0 0 10px ${hue}66`, fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                            }}
                          >
                            {room.host.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14.5, color: '#f8f0ff', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{room.host}</div>
                            <div style={{ color: '#b8a9d4', fontSize: 12 }}>
                              {room.maxSeats}-player · {room.mode === 'duel' ? 'duel' : 'classic'}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: full ? '#ff6b8a' : '#a78bfa', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                          {room.seats}/{room.maxSeats}
                        </div>
                        <div>
                          <span style={badgeStyle('ranked')}>{t('lobbyBrowser.ranked')}</span>
                        </div>
                        <button
                          onClick={() => joinRoom(room)}
                          disabled={full || joiningRoomId === room.id}
                          style={{
                            ...btnGold, padding: '8px 18px', fontSize: 13,
                            opacity: full ? 0.4 : joiningRoomId === room.id ? 0.7 : 1,
                            cursor: full ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {full ? t('lobbyBrowser.fullBtn') : joiningRoomId === room.id ? t('lobbyBrowser.joiningBtn') : t('lobbyBrowser.joinBtn')}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 20 }}>
          {/* Join with Room Code Panel */}
          <div ref={joinPanelRef} style={{ ...feltPanel, padding: 26, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontSize: 20, fontWeight: 900, color: '#f8f0ff' }}>
              {t('lobbyBrowser.joinRoomBtn')}
            </div>
            <div style={{ color: '#d4c8e8', fontSize: 13.5, lineHeight: 1.5 }}>
              {t('lobbyBrowser.privateTableDesc')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                ref={roomInputRef}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') joinByCode(roomCodeInput) }}
                placeholder={t('lobbyBrowser.roomCodePlaceholder')}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(167,139,250,0.35)',
                  borderRadius: 14,
                  color: '#f8f0ff',
                  padding: '14px 16px',
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: '.2em',
                  textAlign: 'center',
                  fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                }}
              />
              <button
                onClick={() => joinByCode(roomCodeInput)}
                disabled={!roomCodeInput.trim() || joiningByCode}
                style={{
                  ...btnGold,
                  width: '100%',
                  padding: 14,
                  fontSize: 14,
                  opacity: !roomCodeInput.trim() || joiningByCode ? 0.5 : 1,
                  cursor: !roomCodeInput.trim() || joiningByCode ? 'not-allowed' : 'pointer',
                }}
              >
                {joiningByCode ? t('lobbyBrowser.joiningBtn') : t('lobbyBrowser.joinRoomBtn')}
              </button>
            </div>
          </div>

          {/* Quick Match Panel */}
          <div style={{ ...card, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 17, color: '#f8f0ff', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{t('lobbyBrowser.quickMatchTitle')}</div>
            <div style={{ color: '#b8a9d4', fontSize: 13.5, lineHeight: 1.5 }}>{t('lobbyBrowser.quickMatchDesc')}</div>
            <button
              onClick={findMeATable}
              disabled={quickMatchBusy}
              style={{ ...btnOutline, textAlign: 'center', opacity: quickMatchBusy ? 0.6 : 1, padding: 14 }}
            >
              {quickMatchBusy ? t('lobbyBrowser.findingTableBtn') : t('lobbyBrowser.findMeATableBtn')}
            </button>
          </div>

          {error && (
            <div style={{ textAlign: 'center', color: '#ff6b8a', fontSize: 13, fontWeight: 600, background: 'rgba(255,107,138,0.15)', padding: '10px 14px', borderRadius: 10 }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  )
}
