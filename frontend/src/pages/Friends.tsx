import { useEffect, useState } from 'react'
import { navigate } from '../router'
import { avatarDim, btnGoldSmall, card, input } from '../theme'

type PresenceStatus = 'online' | 'playing' | 'offline'

type Friend = {
  id: string
  username: string
  avatarStyle: any
  rating: number
  friendsSince: string
  status: PresenceStatus
}

const STATUS_STYLE: Record<PresenceStatus, { color: string; label: string }> = {
  online: { color: '#4bbf7b', label: 'Online' },
  playing: { color: '#f0c24e', label: 'In a game' },
  offline: { color: '#6b6255', label: 'Offline' },
}

type FriendRequest = {
  id: string
  userId: string
  username: string
  avatarStyle: any
  createdAt: string
}

export function Friends() {
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
        setMsg({ text: 'User not found.', type: 'error' })
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
        let errorMsg = 'Could not send request.'
        try {
          const errorData = await reqRes.json()
          errorMsg = errorData.message || errorMsg
        } catch(err) {}
        setMsg({ text: `Error ${reqRes.status}: ${errorMsg}`, type: 'error' })
        return
      }

      setMsg({ text: 'Friend request sent!', type: 'success' })
      setSearchUsername('')
    } catch (e) {
      setMsg({ text: 'An error occurred.', type: 'error' })
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
    return <div style={{ color: '#a99a83', textAlign: 'center', marginTop: 80, fontSize: 18 }}>Loading friends...</div>
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 40 }}>
      
      {/* Search Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input 
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
            placeholder="Add a friend by username" 
            style={{ ...input, flex: 1, width: undefined }} 
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddFriend() }}
          />
          <button onClick={handleAddFriend} style={btnGoldSmall}>Add friend</button>
        </div>
        {msg && (
          <div style={{ 
            color: msg.type === 'error' ? '#e4574d' : '#4bbf7b', 
            fontSize: 13, 
            fontWeight: 600,
            paddingLeft: 4 
          }}>
            {msg.text}
          </div>
        )}
      </div>

      {/* Requests */}
      <div style={{ ...card, padding: '20px 22px' }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#f0e2c4', marginBottom: 12 }}>Pending Requests · {requests.length}</div>
        
        {requests.length === 0 ? (
          <div style={{ color: '#a99a83', fontStyle: 'italic', fontSize: 14 }}>No pending requests.</div>
        ) : (
          requests.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid #2a2015' }}>
              <div style={{ ...avatarDim(38), fontSize: 13 }}>{r.username.slice(0, 2).toUpperCase()}</div>
              <div style={{ flex: 1, fontWeight: 700, fontSize: '14.5px' }}>{r.username}</div>
              <button
                onClick={() => handleAccept(r.id)}
                style={{
                  border: 'none', borderRadius: 9, padding: '8px 16px', font: "800 13px 'Hanken Grotesk'",
                  color: '#0d1b12', cursor: 'pointer', background: 'linear-gradient(180deg,#5fd08a,#2c8a53)',
                }}
              >
                Accept
              </button>
              <button
                onClick={() => handleDecline(r.id)}
                style={{
                  border: '1px solid #4a3826', borderRadius: 9, padding: '8px 14px', font: "700 13px 'Hanken Grotesk'",
                  color: '#c9bda3', cursor: 'pointer', background: 'transparent',
                }}
              >
                Ignore
              </button>
            </div>
          ))
        )}
      </div>

      {/* Friends */}
      <div style={{ ...card, padding: '20px 22px' }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#f0e2c4', marginBottom: 12 }}>Your friends · {friends.length}</div>
        
        {friends.length === 0 ? (
          <div style={{ color: '#a99a83', fontStyle: 'italic', fontSize: 14 }}>You have no friends yet.</div>
        ) : (
          friends.map((f) => {
            const status = STATUS_STYLE[f.status] ?? STATUS_STYLE.offline
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 0', borderBottom: '1px solid #2a2015' }}>
                <div style={{ position: 'relative', flex: 'none' }}>
                  <div style={{ ...avatarDim(40), fontSize: 13, cursor: 'pointer' }} onClick={() => navigate(`/profile?u=${f.username}`)}>
                    {f.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span
                    style={{
                      position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: '50%',
                      background: status.color, border: '2px solid #1a130d',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14.5px', cursor: 'pointer' }} onClick={() => navigate(`/profile?u=${f.username}`)}>
                    {f.username}
                  </div>
                  <div style={{ fontSize: '12.5px', color: status.color, fontWeight: 600 }}>
                    {status.label}
                  </div>
                </div>
                <div style={{ color: '#a99a83', fontSize: 13, fontWeight: 700 }}>♛ {f.rating}</div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => navigate('/lobby')}
                    style={{
                      cursor: 'pointer',
                      border: '1px solid #b8873a',
                      borderRadius: 9,
                      padding: '7px 15px',
                      fontWeight: 800,
                      fontSize: '12.5px',
                      color: '#2a1c07',
                      background: 'linear-gradient(180deg,#f0d18a,#c99b45)',
                    }}
                  >
                    Play
                  </button>
                  <button
                    onClick={() => handleRemove(f.id)}
                    style={{
                      cursor: 'pointer',
                      border: '1px solid #4a2626',
                      borderRadius: 9,
                      padding: '7px 12px',
                      fontWeight: 700,
                      fontSize: '12.5px',
                      color: '#c9a3a3',
                      background: 'transparent',
                    }}
                  >
                    Unfriend
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
