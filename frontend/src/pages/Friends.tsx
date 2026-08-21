import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { postApi } from '../api'
import { UserAvatar } from '../components/UserAvatar'
import { RetroNavbar } from '../components/RetroNavbar'
import type { PlayerColor } from '../game/types'
import { navigate } from '../router'
import { useApp } from '../store'
import { STATUS_STYLE, type PresenceStatus } from '../theme'
import { retroAudio } from '../utils/audio'
import '../styles/retrowave.css'

type ThemeType = 'synthwave' | 'win95' | 'terminal'

type Friend = {
  id: string
  username: string
  avatarStyle: any
  rating: number
  friendsSince: string
  status: PresenceStatus
}

type FriendRequest = {
  id: string
  userId: string
  username: string
  avatarStyle: any
  createdAt: string
}

type BlockedUser = {
  id: string
  username: string
  avatarStyle: any
  rating: number
  blockedSince: string
}

const STATUS_KEYS: Record<PresenceStatus, string> = {
  online: 'friends.online',
  playing: 'friends.inGame',
  offline: 'friends.offline',
}

export function Friends() {
  const { t } = useTranslation()
  const { setActiveMatch } = useApp()

  // ------------------------------------------------------------------------
  // THEME & CRT CONTROLS
  // ------------------------------------------------------------------------
  const [theme, setTheme] = useState<ThemeType>('synthwave')
  const [isThemePopoverOpen, setIsThemePopoverOpen] = useState(false)
  const [crtEnabled, setCrtEnabled] = useState(true)

  const applyTheme = (newTheme: ThemeType) => {
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    document.body.setAttribute('data-theme', newTheme)
    localStorage.setItem('retro_theme', newTheme)
    retroAudio.playUiBeep(880, 0.05)
  }

  useEffect(() => {
    const savedTheme = (localStorage.getItem('retro_theme') as ThemeType) || 'synthwave'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)
    document.body.setAttribute('data-theme', savedTheme)

    const savedCrt = localStorage.getItem('retro_crt')
    if (savedCrt === 'false') {
      setCrtEnabled(false)
    }
  }, [])

  const toggleCrt = () => {
    const next = !crtEnabled
    setCrtEnabled(next)
    localStorage.setItem('retro_crt', next ? 'true' : 'false')
    retroAudio.playUiBeep(440, 0.05)
  }

  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [blocked, setBlocked] = useState<BlockedUser[]>([])
  const [searchUsername, setSearchUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null)
  const [invitingId, setInvitingId] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const [fRes, rRes, bRes] = await Promise.all([
        fetch('/api/friends', { credentials: 'include' }),
        fetch('/api/friends/requests', { credentials: 'include' }),
        fetch('/api/friends/blocked', { credentials: 'include' }),
      ])
      if (fRes.ok && rRes.ok) {
        const friendsData = await fRes.json()
        const requestsData = await rRes.json()
        setFriends(friendsData)
        setRequests(requestsData.received)
      }
      if (bRes && bRes.ok) {
        const blockedData = await bRes.json()
        setBlocked(blockedData)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 15_000)
    return () => clearInterval(id)
  }, [])

  const handleAddFriend = async () => {
    setMsg(null)
    if (!searchUsername.trim()) return

    try {
      const userRes = await fetch(`/api/user/${searchUsername.trim()}`)
      if (!userRes.ok) {
        retroAudio.playUiBeep(320, 0.08)
        setMsg({ text: t('friends.userNotFound'), type: 'error' })
        return
      }
      const userData = await userRes.json()

      const reqRes = await fetch(`/api/friends/request/${userData.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        credentials: 'include',
      })
      if (!reqRes.ok) {
        let errorMsg = t('friends.couldNotSendRequest')
        try {
          const errorData = await reqRes.json()
          errorMsg = errorData.message || errorMsg
        } catch (err) {}
        retroAudio.playUiBeep(320, 0.08)
        setMsg({ text: `Error ${reqRes.status}: ${errorMsg}`, type: 'error' })
        return
      }

      retroAudio.playUiBeep(880, 0.06)
      setMsg({ text: t('friends.requestSent'), type: 'success' })
      setSearchUsername('')
    } catch (e) {
      retroAudio.playUiBeep(320, 0.08)
      setMsg({ text: t('friends.genericError'), type: 'error' })
    }
  }

  const handleAccept = async (requestId: string) => {
    retroAudio.playUiBeep(880, 0.06)
    await fetch(`/api/friends/accept/${requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include',
    })
    fetchData()
  }

  const handleDecline = async (requestId: string) => {
    retroAudio.playUiBeep(440, 0.06)
    await fetch(`/api/friends/decline/${requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include',
    })
    fetchData()
  }

  const handleInvite = async (friendId: string) => {
    setInvitingId(friendId)
    setMsg(null)
    retroAudio.playUiBeep(780, 0.06)
    try {
      const res = await postApi<{
        gameId: string
        token: string
        engineUrl: string
        color: PlayerColor
        inviteCode?: string
        mode: 'pvp' | 'pve' | 'hotseat'
        playerCount: number
      }>('/api/friends/' + friendId + '/invite')
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : t('friends.genericError'), type: 'error' })
      setInvitingId(null)
    }
  }

  const handleRemove = async (friendId: string) => {
    retroAudio.playUiBeep(440, 0.06)
    await fetch(`/api/friends/remove/${friendId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include',
    })
    fetchData()
  }

  const handleBlock = async (friendId: string) => {
    retroAudio.playUiBeep(320, 0.08)
    await fetch(`/api/friends/block/${friendId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include',
    })
    fetchData()
  }

  const handleUnblock = async (targetUserId: string) => {
    retroAudio.playUiBeep(640, 0.06)
    await fetch(`/api/friends/unblock/${targetUserId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include',
    })
    fetchData()
  }

  const onlineFriendsCount = friends.filter((f) => f.status === 'online' || f.status === 'playing').length

  return (
    <>
      {/* Animated 3D Synthwave Grid & Sun Background */}
      <div className="grid-background">
        <div className="synthwave-sun" />
        <div className="grid-horizon" />
        <div className="perspective-grid" />
        <div className="win95-starfield" />
        <div className="terminal-vector-core" />
      </div>

      {/* CRT Monitor Overlay FX Container */}
      <div className={`crt-screen ${crtEnabled ? 'crt-curved' : ''}`} id="crtScreen">
        <div
          className="crt-scanlines"
          id="crtOverlay"
          style={{ display: crtEnabled ? 'block' : 'none' }}
        />
        <div className="crt-flicker" />

        {/* Main Content Wrapper */}
        <div className="app-wrapper">
          {/* Navigation Header */}
          <RetroNavbar
            activeRoute="/friends"
            crtEnabled={crtEnabled}
            toggleCrt={toggleCrt}
          />

          {/* Hero Telemetry Banner */}
          <header className="hero-section" style={{ padding: '16px 0 14px' }}>
            <h1 className="hero-title" style={{ fontSize: '1.45rem', marginBottom: 4 }}>
              CYBER COMMS // PILOT NETWORK
            </h1>
            <p className="hero-subtitle" style={{ fontSize: '0.75rem', marginBottom: 0 }}>
              ESTABLISH DIRECT FREQUENCIES, MANAGE ALLIED COMRADES & DISPATCH DUEL INVITES
            </p>

            <div className="badge-bar" style={{ marginTop: 12 }}>
              <span
                className="retro-badge"
                style={{
                  border: '1px solid #00ff88',
                  color: '#00ff88',
                }}
              >
                // ACTIVE SIGNALS: {onlineFriendsCount} ONLINE
              </span>
              <span
                className="retro-badge"
                style={{
                  border: '1px solid var(--accent-cyan)',
                  color: 'var(--accent-cyan)',
                }}
              >
                // TOTAL COMRADES: {friends.length}
              </span>
              <span
                className="retro-badge"
                style={{
                  border: requests.length > 0 ? '1px solid #ffe600' : '1px dashed rgba(255,255,255,0.2)',
                  color: requests.length > 0 ? '#ffe600' : 'var(--text-muted)',
                }}
              >
                // PENDING REQUESTS: {requests.length}
              </span>
            </div>
          </header>

          {/* Main Friends Container */}
          <div style={{ maxWidth: 960, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Search Bar / Add Friend Module */}
            <section className="retro-window">
              <div className="window-header">
                <span>📡 TRANSMIT FREQUENCY REQUEST // ADD COMRADE</span>
                <div className="window-controls">
                  <span className="window-btn min" />
                  <span className="window-btn max" />
                </div>
              </div>

              <div className="window-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    value={searchUsername}
                    onChange={(e) => setSearchUsername(e.target.value)}
                    placeholder={t('friends.addByUsernamePlaceholder')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddFriend()
                    }}
                    style={{
                      flex: 1,
                      background: 'rgba(5, 2, 18, 0.9)',
                      border: '1.5px solid var(--accent-cyan)',
                      borderRadius: 4,
                      color: '#ffe600',
                      padding: '10px 14px',
                      fontSize: '0.85rem',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                    }}
                  />
                  <button
                    className="retro-btn"
                    onClick={handleAddFriend}
                    style={{ padding: '0 18px', fontSize: '0.78rem' }}
                  >
                    + {t('friends.addFriendAction')}
                  </button>
                </div>

                {msg && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 4,
                      background: msg.type === 'error' ? 'rgba(255, 0, 85, 0.15)' : 'rgba(0, 255, 136, 0.15)',
                      border: `1px solid ${msg.type === 'error' ? '#ff0055' : '#00ff88'}`,
                      color: msg.type === 'error' ? '#ff0055' : '#00ff88',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {msg.type === 'error' ? '⚠️ ' : '✓ '}
                    {msg.text}
                  </div>
                )}
              </div>
            </section>

            {/* Pending Requests Window */}
            {requests.length > 0 && (
              <section className="retro-window">
                <div className="window-header">
                  <span>📥 INCOMING FREQUENCY TRANSMISSIONS ({requests.length})</span>
                  <div className="window-controls">
                    <span className="window-btn min" />
                    <span className="window-btn max" />
                  </div>
                </div>

                <div className="window-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {requests.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        borderRadius: 4,
                        background: 'rgba(255, 230, 0, 0.08)',
                        border: '1px solid rgba(255, 230, 0, 0.3)',
                      }}
                    >
                      <UserAvatar
                        username={r.username}
                        avatarStyle={r.avatarStyle}
                        size={36}
                        fallbackStyle={{
                          width: 36,
                          height: 36,
                          borderRadius: 4,
                          background: 'rgba(10, 2, 28, 0.9)',
                          color: '#ffe600',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 'bold',
                        }}
                      />
                      <div style={{ flex: 1, fontWeight: 'bold', fontSize: '0.85rem', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                        {r.username}
                      </div>
                      <button
                        className="retro-btn"
                        onClick={() => handleAccept(r.id)}
                        style={{
                          padding: '6px 14px',
                          fontSize: '0.72rem',
                          background: '#00ff88',
                          color: '#0d0221',
                          borderColor: '#00ff88',
                        }}
                      >
                        ✓ {t('friends.accept')}
                      </button>
                      <button
                        className="retro-btn"
                        onClick={() => handleDecline(r.id)}
                        style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                      >
                        ✕ {t('friends.ignoreBtn')}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Active Friends List Window */}
            <section className="retro-window">
              <div className="window-header">
                <span>♟ ALLIED PILOT NETWORK ({friends.length})</span>
                <div className="window-controls">
                  <span className="window-btn min" />
                  <span className="window-btn max" />
                </div>
              </div>

              <div className="window-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {loading ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--accent-yellow)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                    SCANNING NETWORK SIGNALS...
                  </div>
                ) : friends.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                    NO ALLIED COMRADES DETECTED. TRANSMIT A FREQUENCY REQUEST ABOVE!
                  </div>
                ) : (
                  friends.map((f) => {
                    const status = STATUS_STYLE[f.status] ?? STATUS_STYLE.offline
                    return (
                      <div
                        key={f.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          borderRadius: 4,
                          background: 'rgba(25, 10, 56, 0.75)',
                          border: '1px solid rgba(0, 240, 255, 0.2)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div
                          style={{ position: 'relative', cursor: 'pointer' }}
                          onClick={() => {
                            retroAudio.playUiBeep(640, 0.04)
                            navigate(`/profile?u=${f.username}`)
                          }}
                        >
                          <UserAvatar
                            username={f.username}
                            avatarStyle={f.avatarStyle}
                            size={38}
                            fallbackStyle={{
                              width: 38,
                              height: 38,
                              borderRadius: 4,
                              background: 'rgba(10, 2, 28, 0.9)',
                              color: 'var(--accent-cyan)',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 'bold',
                            }}
                          />
                          <span
                            style={{
                              position: 'absolute',
                              right: -2,
                              bottom: -2,
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: status.color,
                              border: '1.5px solid #0d0221',
                              boxShadow: `0 0 6px ${status.color}`,
                            }}
                          />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 'bold',
                              fontSize: '0.85rem',
                              color: '#ffffff',
                              fontFamily: 'var(--font-mono)',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            onClick={() => {
                              retroAudio.playUiBeep(640, 0.04)
                              navigate(`/profile?u=${f.username}`)
                            }}
                          >
                            {f.username}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: status.color, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                            {t(STATUS_KEYS[f.status] ?? STATUS_KEYS.offline)}
                          </div>
                        </div>

                        <div style={{ fontWeight: 'bold', fontSize: '0.82rem', color: '#ffe600', fontFamily: 'var(--font-mono)' }}>
                          ♛ {f.rating}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            className="retro-btn"
                            onClick={() => handleInvite(f.id)}
                            disabled={invitingId === f.id}
                            style={{
                              padding: '5px 12px',
                              fontSize: '0.7rem',
                              background: 'var(--accent-pink)',
                              opacity: invitingId === f.id ? 0.6 : 1,
                            }}
                          >
                            {invitingId === f.id ? '// DISPATCHING...' : '⚔️ ' + t('friends.playBtn')}
                          </button>
                          <button
                            className="retro-btn"
                            onClick={() => handleRemove(f.id)}
                            style={{ padding: '5px 10px', fontSize: '0.7rem' }}
                            title="Unfriend"
                          >
                            ✕
                          </button>
                          <button
                            className="retro-btn"
                            onClick={() => handleBlock(f.id)}
                            style={{
                              padding: '5px 10px',
                              fontSize: '0.7rem',
                              borderColor: '#ff0055',
                              color: '#ff0055',
                            }}
                            title="Block Pilot"
                          >
                            🚫
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            {/* Blocked Pilots Window */}
            {blocked.length > 0 && (
              <section className="retro-window">
                <div className="window-header">
                  <span>🚫 RESTRICTED FREQUENCIES // BLOCKED PILOTS ({blocked.length})</span>
                  <div className="window-controls">
                    <span className="window-btn min" />
                    <span className="window-btn max" />
                  </div>
                </div>

                <div className="window-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {blocked.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        borderRadius: 4,
                        background: 'rgba(255, 0, 85, 0.08)',
                        border: '1px solid rgba(255, 0, 85, 0.25)',
                      }}
                    >
                      <UserAvatar
                        username={b.username}
                        size={34}
                        fallbackStyle={{
                          width: 34,
                          height: 34,
                          borderRadius: 4,
                          background: 'rgba(10, 2, 28, 0.9)',
                          color: '#ff0055',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 'bold',
                        }}
                      />
                      <div style={{ flex: 1, fontWeight: 'bold', fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {b.username}
                      </div>
                      <button
                        className="retro-btn"
                        onClick={() => handleUnblock(b.id)}
                        style={{ padding: '4px 12px', fontSize: '0.7rem' }}
                      >
                        {t('friends.unblockBtn')}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
