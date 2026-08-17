import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi, postApi } from '../api'
import { JoinByCode } from '../components/JoinByCode'
import type { PlayerColor } from '../game/types'
import { navigate } from '../router'
import { useApp } from '../store'
import { COL, btnGold, btnOutline, card, feltPanel, pill, sectionLabel } from '../theme'
import { UserAvatar } from '../components/UserAvatar'

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

  const [rooms, setRooms] = useState<Room[] | null>(null)
  const [roomFilter, setRoomFilter] = useState<'all' | 'classic' | 'duel'>('all')
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null)

  const [myRooms, setMyRooms] = useState<MyRoom[]>([])
  const [rejoiningId, setRejoiningId] = useState<string | null>(null)

  const [hostTable, setHostTable] = useState<MatchResult | null>(null)
  const [hostBusy, setHostBusy] = useState(false)
  const hostTableRef = useRef<MatchResult | null>(null)
  const hostTableUsedRef = useRef(false)

  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [joiningByCode, setJoiningByCode] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)

  const copyHostCode = () => {
    if (!hostTable?.inviteCode) return
    navigator.clipboard.writeText(hostTable.inviteCode).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 1500)
    })
  }

  const fetchRooms = () => {
    getApi<Room[]>('/api/games/rooms')
      .then((data) => setRooms(data))
      .catch(() => setRooms((prev) => prev ?? []))
  }

  const fetchMyRooms = () => {
    getApi<MyRoom[]>('/api/games/mine')
      .then((data) => setMyRooms(data))
      .catch(() => {})
  }

  useEffect(() => {
    fetchRooms()
    fetchMyRooms()
    const iv = setInterval(() => { fetchRooms(); fetchMyRooms() }, 1000)
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
    hostTableUsedRef.current = false
    try {
      const res = await postApi<MatchResult>('/api/match/pvp/invite', { clashEnabled: true })
      setHostTable(res)
      if (previous) postApi(`/api/game/${previous.gameId}/abort`).catch(() => {})
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

  // Track the live invite room so it can be aborted on unmount — without
  // this, every visit to the lobby that isn't followed by "Create Room"
  // leaves a ghost WAITING room sitting in Redis, cluttering everyone's
  // open-rooms list with tables nobody is actually hosting anymore.
  useEffect(() => {
    hostTableRef.current = hostTable
  }, [hostTable])

  useEffect(() => {
    return () => {
      if (hostTableRef.current && !hostTableUsedRef.current) {
        postApi(`/api/game/${hostTableRef.current.gameId}/abort`).catch(() => {})
      }
    }
  }, [])

  const createTable = () => {
    if (!hostTable) return
    hostTableUsedRef.current = true
    setActiveMatch(hostTable)
    navigate(`/game?gameId=${hostTable.gameId}`)
  }

  const joinByCode = async (code: string) => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    if (hostTable?.inviteCode && trimmed === hostTable.inviteCode) {
      createTable()
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
      onClick: () => navigate('/lobby/table?mode=4&bots=0&local=1'),
    },
    {
      key: 'testYourLuck',
      title: t('lobby.testYourLuck'),
      desc: t('lobbyBrowser.testYourLuckDesc'),
      glyph: '⚄',
      hue: COL.blue.base,
      badge: 'casual',
      onClick: () => navigate('/lobby/table?mode=1&bots=0&local=1'),
    },
  ]

  const badgeStyle = (badge: ModeCard['badge']): React.CSSProperties => {
    const hue = badge === 'ranked' ? '#f0c24e' : badge === 'casual' ? '#4bbf7b' : '#4a92e0'
    return {
      fontSize: 10.5, fontWeight: 800, letterSpacing: '.04em', color: hue,
      background: `${hue}22`, border: `1px solid ${hue}55`, borderRadius: 999, padding: '3px 8px',
    }
  }
  const badgeLabel = (badge: ModeCard['badge']) =>
    badge === 'ranked' ? t('lobbyBrowser.ranked') : badge === 'casual' ? t('lobbyBrowser.casual') : t('lobbyBrowser.invite')

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

          {myRooms.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={sectionLabel}>{t('lobbyBrowser.yourTables')} · {myRooms.length}</div>
              <div style={{ ...card, overflow: 'hidden' }}>
                {myRooms.map((room, i) => (
                  <div
                    key={room.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                      borderBottom: i < myRooms.length - 1 ? '1px solid #2a2015' : 'none',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 13.5, color: '#f0e2c4' }}>
                        {room.roomCode ?? room.gameType} <span style={{ color: '#a99a83', fontWeight: 600 }}>· {room.seats}/{room.maxSeats}</span>
                      </div>
                      <div style={{ color: '#a99a83', fontSize: 12 }}>
                        {room.status === 'WAITING' ? t('lobbyBrowser.statusWaiting') : t('lobbyBrowser.statusActive')}
                      </div>
                    </div>
                    <button
                      onClick={() => rejoinRoom(room)}
                      disabled={rejoiningId === room.id}
                      style={{ ...btnOutline, padding: '8px 16px', fontSize: 12.5, opacity: rejoiningId === room.id ? 0.6 : 1 }}
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
                        onClick={() => joinRoom(room)}
                        disabled={full || joiningRoomId === room.id}
                        style={{
                          ...btnGold, padding: '8px 16px', fontSize: 12.5,
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>
          <div style={{ ...feltPanel, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 17, color: '#dff0e0' }}>{t('lobbyBrowser.hostTableTitle')}</div>
            <div style={{ color: '#c9d9c9', fontSize: 13, lineHeight: 1.5 }}>{t('lobbyBrowser.hostTableDesc')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                onClick={copyHostCode}
                title={hostTable?.inviteCode ? t('game.copyRoomCode') : undefined}
                style={{
                  flex: 1, background: 'rgba(0,0,0,.25)', border: '1px solid #2e4a38', borderRadius: 10,
                  padding: '12px 14px', fontWeight: 800, fontSize: 18, letterSpacing: '.18em', color: '#f0e2c4',
                  cursor: hostTable?.inviteCode ? 'pointer' : 'default',
                }}
              >
                {hostTable?.inviteCode ?? '······'}
              </div>
              <button
                onClick={copyHostCode}
                disabled={!hostTable?.inviteCode}
                style={{
                  ...btnOutline, padding: '10px 14px', fontSize: 12.5,
                  opacity: !hostTable?.inviteCode ? 0.5 : 1,
                  color: codeCopied ? '#5fd08a' : '#fff',
                }}
              >
                {codeCopied ? t('game.copiedBtn') : t('game.copyBtn')}
              </button>
              <button
                onClick={() => spinNewTable(hostTable)}
                disabled={hostBusy}
                style={{ ...btnOutline, padding: '10px 14px', fontSize: 12.5, opacity: hostBusy ? 0.6 : 1 }}
              >
                ↻ {t('lobbyBrowser.newCodeBtn')}
              </button>
            </div>
            <button
              onClick={createTable}
              disabled={!hostTable || hostBusy}
              style={{ ...btnGold, opacity: !hostTable || hostBusy ? 0.6 : 1 }}
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
