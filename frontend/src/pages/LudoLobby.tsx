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
  const hostPanelRef = useRef<HTMLDivElement>(null)

  const [rooms, setRooms] = useState<Room[] | null>(null)
  const [roomFilter, setRoomFilter] = useState<'all' | 'classic' | 'duel'>('all')
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null)

  const [myRooms, setMyRooms] = useState<MyRoom[]>([])
  const [rejoiningId, setRejoiningId] = useState<string | null>(null)

  const [hostTable, setHostTable] = useState<MatchResult | null>(null)
  const [hostBusy, setHostBusy] = useState(false)

  const [quickMatchBusy, setQuickMatchBusy] = useState(false)

  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [joiningByCode, setJoiningByCode] = useState(false)

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

  const spinNewTable = async (previous?: MatchResult | null) => {
    setHostBusy(true)
    setError(null)
    try {
      const res = await postApi<MatchResult>('/api/match/pvp/invite', { clashEnabled: true })
      setHostTable(res)
      if (previous) postApi(`/api/game/${previous.gameId}/abort`).catch(() => { })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to host a table')
    } finally {
      setHostBusy(false)
    }
  }

  const spunRef = useRef(false)
  useEffect(() => {
    if (spunRef.current) return
    spunRef.current = true
    spinNewTable()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createTable = () => {
    if (!hostTable) return
    setActiveMatch(hostTable)
    navigate(`/game?gameId=${hostTable.gameId}`)
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
      onClick: () => hostPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    },
  ]

  const badgeStyle = (badge: ModeCard['badge']): React.CSSProperties => {
    const hue = badge === 'ranked' ? '#ffcb6b' : badge === 'casual' ? '#5de4c7' : '#89ddff'
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 36px', borderBottom: '1px solid rgba(93,228,199,0.15)', background: 'rgba(20,23,35,0.65)', backdropFilter: 'blur(16px)' }}>
        {/* <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
            <div style={{ fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontSize: 24, fontWeight: 900, color: '#f0f4fc' }}>{t('lobby.title')}</div>
            <div style={{ color: '#a6accd', fontSize: 13.5, fontWeight: 500 }}>{t('lobbyBrowser.subtitle')}</div>
          </div>
        </div> */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') joinByCode(roomCodeInput) }}
            placeholder={t('lobbyBrowser.roomCodePlaceholder')}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(93,228,199,0.3)', borderRadius: 12,
              color: '#f0f4fc', padding: '11px 16px', fontSize: 13.5, fontWeight: 800, letterSpacing: '.14em', width: 150,
              fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
            }}
          />
          <button
            onClick={() => joinByCode(roomCodeInput)}
            disabled={!roomCodeInput.trim() || joiningByCode}
            style={{ ...btnGold, padding: '11px 20px', fontSize: 13.5, opacity: !roomCodeInput.trim() || joiningByCode ? 0.5 : 1 }}
          >
            {joiningByCode ? t('lobbyBrowser.joiningBtn') : t('lobbyBrowser.joinRoomBtn')}
          </button>
        </div>
      </header>

      <div
        style={{
          flex: 1, display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 28, padding: '32px 36px',
          alignItems: 'start', maxWidth: 1320, margin: '0 auto', width: '100%',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...sectionLabel, color: '#5de4c7' }}>{t('lobbyBrowser.gameModes')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {modeCards.map((m) => (
                <div
                  key={m.key}
                  onClick={m.onClick}
                  className="interactive-card"
                  style={{
                    cursor: 'pointer', borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', gap: 12,
                    background: 'linear-gradient(145deg, rgba(27,30,46,0.85), rgba(20,23,35,0.95))',
                    border: '1px solid rgba(93,228,199,0.25)',
                    boxShadow: '0 12px 28px -8px rgba(0,0,0,0.5)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div
                      style={{
                        width: 50, height: 50, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 24,
                        color: '#13151f', background: `linear-gradient(135deg, ${m.hue}, ${m.hue}aa)`,
                        boxShadow: `0 0 16px ${m.hue}66`,
                      }}
                    >
                      {m.glyph}
                    </div>
                    <span style={badgeStyle(m.badge)}>{badgeLabel(m.badge)}</span>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 17, color: '#f0f4fc', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{m.title}</div>
                  <div style={{ color: '#a6accd', fontSize: 13.5, lineHeight: 1.45 }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {myRooms.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ ...sectionLabel, color: '#89ddff' }}>{t('lobbyBrowser.yourTables')} · {myRooms.length}</div>
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
                      <div style={{ fontWeight: 800, fontSize: 14.5, color: '#f0f4fc', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                        {room.roomCode ?? room.gameType} <span style={{ color: '#a6accd', fontWeight: 600 }}>· {room.seats}/{room.maxSeats}</span>
                      </div>
                      <div style={{ color: '#a6accd', fontSize: 12.5 }}>
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
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ ...sectionLabel, color: '#5de4c7' }}>{t('lobbyBrowser.openRooms')} · {filteredRooms.length}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span onClick={() => setRoomFilter('all')} style={pill(roomFilter === 'all')}>{t('lobbyBrowser.filterAll')}</span>
                <span onClick={() => setRoomFilter('classic')} style={pill(roomFilter === 'classic')}>{t('lobbyBrowser.filter4Player')}</span>
                <span onClick={() => setRoomFilter('duel')} style={pill(roomFilter === 'duel')}>{t('lobbyBrowser.filterDuel')}</span>
              </div>
            </div>

            <div style={{ ...card, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 1fr 1fr auto', gap: 12, padding: '14px 20px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 11.5, fontWeight: 800, letterSpacing: '.08em',
                  textTransform: 'uppercase', color: '#a6accd', fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                }}
              >
                <div>{t('lobbyBrowser.colRoomId')}</div>
                <div>{t('lobbyBrowser.colHost')}</div>
                <div>{t('lobbyBrowser.colSeats')}</div>
                <div>{t('lobbyBrowser.colStakes')}</div>
                <div />
              </div>

              {rooms === null ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#a6accd', fontSize: 14 }}>{t('lobbyBrowser.loadingRooms')}</div>
              ) : filteredRooms.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#a6accd', fontSize: 14 }}>{t('lobbyBrowser.noOpenRooms')}</div>
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
                      <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: '.08em', color: '#f0f4fc', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{room.roomCode}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 32, height: 32, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center',
                            fontWeight: 900, fontSize: 12, color: '#13151f', background: hue,
                            boxShadow: `0 0 10px ${hue}66`, fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                          }}
                        >
                          {room.host.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14.5, color: '#f0f4fc', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{room.host}</div>
                          <div style={{ color: '#a6accd', fontSize: 12 }}>
                            {room.maxSeats}-player · {room.mode === 'duel' ? 'duel' : 'classic'}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: full ? '#d0679d' : '#5de4c7', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 20 }}>
          <div ref={hostPanelRef} style={{ ...feltPanel, padding: 26, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontSize: 20, fontWeight: 900, color: '#f0f4fc' }}>{t('lobbyBrowser.hostTableTitle')}</div>
            <div style={{ color: '#cbd5e1', fontSize: 13.5, lineHeight: 1.5 }}>{t('lobbyBrowser.hostTableDesc')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  flex: 1, background: 'rgba(0,0,0,.35)', border: '1px solid rgba(93,228,199,0.4)', borderRadius: 14,
                  padding: '14px 16px', fontWeight: 900, fontSize: 20, letterSpacing: '.2em', color: '#f0f4fc',
                  fontFamily: "'Space Grotesk', 'Outfit', sans-serif", textAlign: 'center', textShadow: '0 0 12px rgba(93,228,199,0.5)',
                }}
              >
                {hostTable?.inviteCode ?? '······'}
              </div>
              <button
                onClick={() => spinNewTable(hostTable)}
                disabled={hostBusy}
                style={{ ...btnOutline, padding: '12px 16px', fontSize: 13, opacity: hostBusy ? 0.6 : 1 }}
              >
                ↻ {t('lobbyBrowser.newCodeBtn')}
              </button>
            </div>
            <button
              onClick={createTable}
              disabled={!hostTable || hostBusy}
              style={{ ...btnGold, opacity: !hostTable || hostBusy ? 0.6 : 1, padding: 14 }}
            >
              {hostBusy ? t('lobbyBrowser.creatingTableBtn') : t('lobbyBrowser.createTableBtn')}
            </button>
          </div>

          <div style={{ ...card, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 17, color: '#f0f4fc', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{t('lobbyBrowser.quickMatchTitle')}</div>
            <div style={{ color: '#a6accd', fontSize: 13.5, lineHeight: 1.5 }}>{t('lobbyBrowser.quickMatchDesc')}</div>
            <button
              onClick={findMeATable}
              disabled={quickMatchBusy}
              style={{ ...btnOutline, textAlign: 'center', opacity: quickMatchBusy ? 0.6 : 1, padding: 14 }}
            >
              {quickMatchBusy ? t('lobbyBrowser.findingTableBtn') : t('lobbyBrowser.findMeATableBtn')}
            </button>
          </div>

          {error && (
            <div style={{ textAlign: 'center', color: '#d0679d', fontSize: 13, fontWeight: 600, background: 'rgba(208,103,157,0.15)', padding: '10px 14px', borderRadius: 10 }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  )
}
