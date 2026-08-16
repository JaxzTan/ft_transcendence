import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { postApi } from '../api'
import type { PlayerColor } from '../game/types'
import { navigate } from '../router'
import { useApp } from '../store'
import { avatarDim, btnGoldSmall, card, input, STATUS_STYLE, type PresenceStatus } from '../theme'
import { UserAvatar } from '../components/UserAvatar'

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

const STATUS_KEYS: Record<PresenceStatus, string> = {
  online: 'friends.online',
  playing: 'friends.inGame',
  offline: 'friends.offline',
}

export function Friends() {
  const { t } = useTranslation()
  const { setActiveMatch } = useApp()
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [searchUsername, setSearchUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ text: string, type: 'error' | 'success' } | null>(null)

  const fetchData = async () => {
    try {
      const [fRes, rRes] = await Promise.all([
        fetch('/api/friends', { credentials: 'include' }),
        fetch('/api/friends/requests', { credentials: 'include' })
      ])
      if (fRes.ok && rRes.ok) {
        const friendsData = await fRes.json()
        const requestsData = await rRes.json()
        setFriends(friendsData)
        setRequests(requestsData.received)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // Presence isn't pushed, so poll for it — matches the client's own
    // heartbeat cadence in store.tsx.
    const id = setInterval(fetchData, 15_000)
    return () => clearInterval(id)
  }, [])

  const handleAddFriend = async () => {
    setMsg(null)
    if (!searchUsername.trim()) return

    try {
      const userRes = await fetch(`/api/user/${searchUsername.trim()}`)
      if (!userRes.ok) {
        setMsg({ text: t('friends.userNotFound'), type: 'error' })
        return
      }
      const userData = await userRes.json()

      const reqRes = await fetch(`/api/friends/request/${userData.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}),
        credentials: 'include'
      })
      if (!reqRes.ok) {
        let errorMsg = t('friends.couldNotSendRequest')
        try {
          const errorData = await reqRes.json()
          errorMsg = errorData.message || errorMsg
        } catch(err) {}
        setMsg({ text: `Error ${reqRes.status}: ${errorMsg}`, type: 'error' })
        return
      }

      setMsg({ text: t('friends.requestSent'), type: 'success' })
      setSearchUsername('')
    } catch (e) {
      setMsg({ text: t('friends.genericError'), type: 'error' })
    }
  }

  const handleAccept = async (requestId: string) => {
    await fetch(`/api/friends/accept/${requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include'
    })
    fetchData()
  }

  const handleDecline = async (requestId: string) => {
    await fetch(`/api/friends/decline/${requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include'
    })
    fetchData()
  }

  const [invitingId, setInvitingId] = useState<string | null>(null)

  const handleInvite = async (friendId: string) => {
    setInvitingId(friendId)
    setMsg(null)
    try {
      const res = await postApi<{ gameId: string; token: string; engineUrl: string; color: PlayerColor; inviteCode?: string }>(
        '/api/friends/' + friendId + '/invite',
      )
      // Seat the host in the room now, before the friend can accept — otherwise
      // the friend would be the only one who ever actually joins the engine game.
      setActiveMatch(res)
      navigate(`/game?gameId=${res.gameId}`)
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : t('friends.genericError'), type: 'error' })
      setInvitingId(null)
    }
  }

  const handleRemove = async (friendId: string) => {
    await fetch(`/api/friends/remove/${friendId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include'
    })
    fetchData()
  }

  if (loading) {
    return <div style={{ color: '#b8a9d4', textAlign: 'center', marginTop: 80, fontSize: 18 }}>{t('friends.loadingFriends')}</div>
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 40 }}>

      {/* Search Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
            placeholder={t('friends.addByUsernamePlaceholder')}
            style={{ ...input, flex: 1, width: undefined }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddFriend() }}
          />
          <button onClick={handleAddFriend} style={btnGoldSmall}>{t('friends.addFriendAction')}</button>
        </div>
        {msg && (
          <div style={{
            color: msg.type === 'error' ? '#ff6b8a' : '#4adeab',
            fontSize: 13,
            fontWeight: 600,
            paddingLeft: 4
          }}>
            {msg.text}
          </div>
        )}
      </div>

      {/* Requests */}
      <div style={{ ...card, padding: '22px 26px' }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: '#f8f0ff', marginBottom: 14, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
          {t('friends.pendingRequests')} · <span style={{ color: '#a78bfa' }}>{requests.length}</span>
        </div>

        {requests.length === 0 ? (
          <div style={{ color: '#b8a9d4', fontStyle: 'italic', fontSize: 14 }}>{t('friends.noPendingRequests')}</div>
        ) : (
          requests.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <UserAvatar 
                username={r.username}
                size={40}
                fallbackStyle={{ ...avatarDim(40), fontSize: 14 }}
              />
              <div style={{ flex: 1, fontWeight: 700, fontSize: '15px', color: '#f8f0ff', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{r.username}</div>
              <button
                onClick={() => handleAccept(r.id)}
                style={{
                  border: 'none', borderRadius: 10, padding: '9px 18px', font: "800 13px 'Space Grotesk', 'Outfit', sans-serif",
                  color: '#0f0a1a', cursor: 'pointer', background: 'linear-gradient(135deg, #a78bfa, #6bb8ff)',
                  boxShadow: '0 0 14px rgba(167,139,250,0.4)',
                }}
              >
                {t('friends.accept')}
              </button>
              <button
                onClick={() => handleDecline(r.id)}
                style={{
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '9px 16px', font: "700 13px 'Space Grotesk', 'Outfit', sans-serif",
                  color: '#b8a9d4', cursor: 'pointer', background: 'rgba(255,255,255,0.04)',
                }}
              >
                {t('friends.ignoreBtn')}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Friends */}
      <div style={{ ...card, padding: '22px 26px' }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: '#f8f0ff', marginBottom: 14, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
          {t('friends.yourFriendsLabel')} · <span style={{ color: '#6bb8ff' }}>{friends.length}</span>
        </div>

        {friends.length === 0 ? (
          <div style={{ color: '#b8a9d4', fontStyle: 'italic', fontSize: 14 }}>{t('friends.noFriendsYet')}</div>
        ) : (
          friends.map((f) => {
            const status = STATUS_STYLE[f.status] ?? STATUS_STYLE.offline
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ position: 'relative', flex: 'none', cursor: 'pointer' }} onClick={() => navigate(`/profile?u=${f.username}`)}>
                  <UserAvatar 
                    username={f.username}
                    size={42}
                    fallbackStyle={{ ...avatarDim(42), fontSize: 14 }}
                  />
                  <span
                    style={{
                      position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: '50%',
                      background: status.color, border: '2.5px solid #0f0a1a', boxShadow: `0 0 8px ${status.color}`,
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#f8f0ff', fontFamily: "'Space Grotesk', 'Outfit', sans-serif", cursor: 'pointer' }} onClick={() => navigate(`/profile?u=${f.username}`)}>
                    {f.username}
                  </div>
                  <div style={{ fontSize: '12.5px', color: status.color, fontWeight: 700, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                    {t(STATUS_KEYS[f.status] ?? STATUS_KEYS.offline)}
                  </div>
                </div>
                <div style={{ color: '#ffd66b', fontSize: 14, fontWeight: 800, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>♛ {f.rating}</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => handleInvite(f.id)}
                    disabled={invitingId === f.id}
                    style={{
                      cursor: invitingId === f.id ? 'default' : 'pointer',
                      border: 'none',
                      borderRadius: 10,
                      padding: '8px 18px',
                      fontWeight: 800,
                      fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                      fontSize: '13px',
                      color: '#0f0a1a',
                      background: 'linear-gradient(135deg, #a78bfa, #6bb8ff)',
                      boxShadow: '0 0 14px rgba(167,139,250,0.4)',
                      opacity: invitingId === f.id ? 0.6 : 1,
                    }}
                  >
                    {invitingId === f.id ? t('friends.invitingBtn') : t('friends.playBtn')}
                  </button>
                  <button
                    onClick={() => handleRemove(f.id)}
                    style={{
                      cursor: 'pointer',
                      border: '1px solid rgba(255,107,138,0.3)',
                      borderRadius: 10,
                      padding: '8px 14px',
                      fontWeight: 700,
                      fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                      fontSize: '13px',
                      color: '#ff6b8a',
                      background: 'rgba(255,107,138,0.1)',
                    }}
                  >
                    {t('friends.unfriendBtn')}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
