import { useEffect, useState, useRef } from 'react'
import { useRoute } from '../router'
import { useApp } from '../store'
import { card, goldText, avatarBlue, STATUS_STYLE, type PresenceStatus } from '../theme'

const STATUS_KEYS: Record<PresenceStatus, string> = {
  online: 'friends.online',
  playing: 'friends.inGame',
  offline: 'friends.offline',
}

type UserProfile = {
  id: string
  username: string
  rating: number
  highestRating: number
  wins: number
  losses: number
  winStreak: number
  bestWinStreak: number
  daysActive: number
  createdAt: string
  status: PresenceStatus
}

type Participant = {
  username: string
  avatarStyle: any
  color: number
  rank: number | null
  piecesInGoal: number
}

type MatchHistory = {
  games: Array<{
    gameId: string
    status: string
    color: number
    rank: number | null
    piecesCaptured: number
    piecesInGoal: number
    startedAt: string
    endedAt: string | null
    participants: Participant[]
  }>
  total: number
  page: number
  limit: number
}

type Friend = {
  id: string
  username: string
  avatarStyle: any
  rating: number
  friendsSince: string
  status: PresenceStatus
}

export function Profile() {
  const { t } = useTranslation()
  const { query } = useRoute()
  const { user } = useApp()
  const username = query.get('u') || user?.username
  const isOwnProfile = user?.username === username

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [gamesData, setGamesData] = useState<MatchHistory | null>(null)
  const [friendsData, setFriendsData] = useState<Friend[] | null>(null)
  const [loading, setLoading] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [avatarBuster, setAvatarBuster] = useState(Date.now())

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('File size must be less than 2MB.')
      return
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Allowed: PNG, JPEG, GIF, WebP.')
      return
    }

    setUploading(true)
    setUploadError('')
    const formData = new FormData()
    formData.append('avatar', file)

    try {
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })
      if (!res.ok) {
        const err = await res.json()
        setUploadError(err.message || 'Failed to upload avatar.')
      } else {
        setAvatarBuster(Date.now())
      }
    } catch (e) {
      setUploadError('An error occurred during upload.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    setUploading(true)
    setUploadError('')
    try {
      await fetch('/api/user/avatar', {
        method: 'DELETE',
        credentials: 'include'
      })
      setAvatarBuster(Date.now())
    } catch (e) {
      setUploadError('Failed to remove avatar.')
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    if (!username) return
    setLoading(true)

    const fetches = [
      fetch(`/api/user/${username}`).then((res) => res.ok ? res.json() : null),
      fetch(`/api/user/${username}/games`).then((res) => res.ok ? res.json() : null),
    ]

    if (isOwnProfile) {
      fetches.push(fetch('/api/friends').then((res) => res.ok ? res.json() : null))
    }

    Promise.all(fetches).then(([profileData, gamesRes, friendsRes]) => {
      setProfile(profileData)
      setGamesData(gamesRes)
      if (isOwnProfile && friendsRes) {
        setFriendsData(friendsRes)
      }
      setLoading(false)
    })
  }, [username, isOwnProfile])

  // Presence isn't pushed, so poll for it — matches the client's own
  // heartbeat cadence in store.tsx. Games/stats don't need this refetch.
  useEffect(() => {
    if (!username) return
    const id = setInterval(() => {
      fetch(`/api/user/${username}`).then((res) => res.ok && res.json()).then((data) => {
        if (data) setProfile(data)
      })
      if (isOwnProfile) {
        fetch('/api/friends').then((res) => res.ok && res.json()).then((data) => {
          if (data) setFriendsData(data)
        })
      }
    }, 15_000)
    return () => clearInterval(id)
  }, [username, isOwnProfile])

  if (loading) {
    return <div style={{ color: '#a99a83', textAlign: 'center', marginTop: 80, fontSize: 18 }}>{t('profile.loadingProfile')}</div>
  }

  if (!profile) {
    return (
      <div style={{ color: '#e4574d', textAlign: 'center', marginTop: 80, fontSize: 18, fontWeight: 600 }}>
        {t('profile.userNotFoundQuoted', { username })}
      </div>
    )
  }


  const totalGames = profile.wins + profile.losses
  const winRate = totalGames > 0 ? Math.round((profile.wins / totalGames) * 100) : 0
  const statusStyle = STATUS_STYLE[profile.status] ?? STATUS_STYLE.offline

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 32, paddingBottom: 60, alignItems: 'start' }}>
      
      {/* Left Column: Stats & Matches */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Header Card */}
        <div style={{ ...card, padding: 36, display: 'flex', alignItems: 'center', gap: 32, position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: -50, right: -50, width: 300, height: 300,
            background: 'radial-gradient(circle, rgba(201, 155, 69, 0.15) 0%, transparent 65%)',
            pointerEvents: 'none'
          }} />

          <div style={{ position: 'relative' }}>
            <UserAvatar 
              username={profile.username}
              size={100}
              fallbackStyle={avatarBlue(100, 36, 30)}
              style={{ boxShadow: '0 0 0 4px #1a130d, 0 0 0 2px #3a2c1d' }}
              cacheBuster={avatarBuster}
            />
            <span
              title={statusStyle.label}
              style={{
                position: 'absolute', right: 4, bottom: 4, width: 18, height: 18, borderRadius: '50%',
                background: statusStyle.color, border: '3px solid #1a130d',
              }}
            />
            {isOwnProfile && (
              <div 
                onClick={() => !uploading && fileInputRef.current?.click()}
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: 0, transition: 'opacity 0.2s',
                  boxShadow: '0 0 0 4px #1a130d, 0 0 0 2px #3a2c1d'
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '0'}
              >
                {uploading ? '...' : 'Upload'}
              </div>
            )}
            <input 
              type="file" 
              accept="image/png, image/jpeg, image/gif, image/webp" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ ...goldText, fontFamily: "'Cinzel',serif", fontWeight: 800, fontSize: 40, lineHeight: 1.1 }}>
              {profile.username}
            </div>
            <div style={{ color: statusStyle.color, fontSize: 13, marginTop: 6, fontWeight: 700 }}>
              {t(STATUS_KEYS[profile.status] ?? STATUS_KEYS.offline)}
            </div>
            <div style={{ color: '#a99a83', fontSize: 14, marginTop: 2, fontWeight: 500 }}>
              {t('profile.memberSince')} {new Date(profile.createdAt).toLocaleDateString()}
            </div>
            {isOwnProfile && (
              <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
                <span onClick={handleRemoveAvatar} style={{ color: '#e4574d', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: 0.8 }} onMouseOver={(e) => e.currentTarget.style.opacity = '1'} onMouseOut={(e) => e.currentTarget.style.opacity = '0.8'}>
                  Remove Avatar
                </span>
                {uploadError && <span style={{ color: '#e4574d', fontSize: 12, fontWeight: 700 }}>· {uploadError}</span>}
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', background: 'linear-gradient(180deg,#241b13,#17110b)', padding: '16px 28px', borderRadius: 20, border: '1px solid #3a2c1d', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05)' }}>
            <div style={{ fontSize: 12, color: '#a99a83', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>{t('dashboard.rating')}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#f0e2c4', marginTop: 4 }}>{profile.rating}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          <StatBox label={t('profile.wins')} value={profile.wins} color="#4bbf7b" />
          <StatBox label={t('profile.losses')} value={profile.losses} color="#e4574d" />
          <StatBox label={t('profile.winRate')} value={`${winRate}%`} color="#4a92e0" />
          <StatBox label={t('profile.bestStreak')} value={profile.bestWinStreak} color="#f0c24e" />
        </div>

        <div style={{ ...card, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 20, color: '#f0e2c4', fontWeight: 700, fontFamily: "'Cinzel',serif" }}>{t('profile.recentMatches')}</h3>
            {gamesData && gamesData.total > 0 && (
              <div style={{ color: '#a99a83', fontSize: 14, fontWeight: 600 }}>{t('profile.gamesPlayedCount', { count: gamesData.total })}</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!gamesData || gamesData.games.length === 0 ? (
              <div style={{ color: '#a99a83', fontStyle: 'italic', padding: '20px 0', textAlign: 'center', background: '#17110b', borderRadius: 12, border: '1px solid #2e2115' }}>
                {t('profile.noMatchesPlayed')}
              </div>
            ) : (
              gamesData.games.map((game) => {
                const isWinner = game.rank === 1
                const isDraw = game.status === 'COMPLETED' && !game.participants.some(p => p.rank === 1) // Edge case if no winners
                const resultText = isWinner ? t('profile.resultVictory') : (isDraw ? t('profile.resultDraw') : t('profile.resultDefeat'))
                const resultColor = isWinner ? '#4bbf7b' : (isDraw ? '#a99a83' : '#e4574d')

                const opponents = game.participants.filter(p => p.username !== profile.username)

                return (
                  <div key={game.gameId} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', background: '#17110b', borderRadius: 16, border: '1px solid #2e2115',
                    transition: 'background 0.2s, transform 0.2s', cursor: 'default'
                  }}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#1e1610'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#17110b'; e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div style={{
                        fontWeight: 800, fontSize: 13, padding: '6px 12px', borderRadius: 8, letterSpacing: 1,
                        background: resultColor + '22', color: resultColor, border: `1px solid ${resultColor}44`,
                        width: 85, textAlign: 'center'
                      }}>
                        {resultText}
                      </div>

                      <div style={{ color: '#f0e2c4', fontWeight: 600, fontSize: 15 }}>
                        {t('profile.vsLabel')} {opponents.length > 0 ? opponents.map(o => o.username).join(', ') : t('profile.botsUnknown')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                      <div style={{ color: '#c99b45', fontSize: 13, fontWeight: 700 }}>
                        {t('profile.goalsCount', { count: game.piecesInGoal })}
                      </div>
                      <div style={{ color: '#a99a83', fontSize: 13, minWidth: 80, textAlign: 'right' }}>
                        {new Date(game.startedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {isOwnProfile && (
        <FriendsSidebar friends={friendsData} navigate={navigate} />
      )}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: React.ReactNode; color: string }) {
  return (
    <div style={{ ...card, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, opacity: 0.8 }} />
      <div style={{ color: '#a99a83', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color, fontFamily: "'Hanken Grotesk', sans-serif" }}>
        {value}
      </div>
    </div>
  )
}

function FriendsSidebar({ friends, navigate }: { friends: Friend[] | null, navigate: (url: string) => void }) {
  const { t } = useTranslation()
  return (
    <div style={{ ...card, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#f0e2c4', fontWeight: 700, fontFamily: "'Cinzel',serif" }}>
          {t('nav.friends')}
        </h3>
        <div style={{ background: '#241b13', color: '#c99b45', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
          {friends ? friends.length : 0}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!friends ? (
          <div style={{ color: '#a99a83', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>{t('common.loading')}</div>
        ) : friends.length === 0 ? (
          <div style={{ color: '#a99a83', fontSize: 13, textAlign: 'center', padding: '20px 0', background: '#17110b', borderRadius: 12, border: '1px solid #2e2115' }}>
            {t('profile.noFriendsShort')}<br/><br/>
            <span style={{ color: '#c99b45', cursor: 'pointer', fontWeight: 600 }}>{t('profile.findPlayers')}</span>
          </div>
        ) : (
          friends.map((friend) => {
            const status = STATUS_STYLE[friend.status] ?? STATUS_STYLE.offline
            return (
              <div key={friend.id} style={{
                display: 'flex', alignItems: 'center', padding: '8px 12px', background: '#1a140e',
                borderRadius: 12, border: '1px solid #2e2115', cursor: 'pointer', transition: 'background 0.2s'
              }}
                onClick={() => navigate(`/profile?u=${friend.username}`)}
                onMouseOver={(e) => { e.currentTarget.style.background = '#241b13' }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#1a140e' }}
              >
                <div style={{ position: 'relative', marginRight: 12, flexShrink: 0 }}>
                  <UserAvatar 
                    username={friend.username}
                    size={36}
                    fallbackStyle={avatarBlue(36, 12, 10)}
                    style={{ boxShadow: '0 0 0 2px #1a130d, 0 0 0 1px #3a2c1d' }}
                  />
                  <span
                    style={{
                      position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: '50%',
                      background: status.color, border: '2px solid #1a140e',
                    }}
                  />
                </div>

                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#f0e2c4', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {friend.username}
                  </div>
                  <div style={{ color: status.color, fontSize: 11, fontWeight: 600 }}>
                    {t(STATUS_KEYS[friend.status] ?? STATUS_KEYS.offline)}
                  </div>
                </div>

                {/* Rating Badge (Steam Level style) */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', border: '2px solid #c99b45',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'radial-gradient(circle, rgba(201,155,69,0.2) 0%, rgba(201,155,69,0) 70%)',
                  color: '#f0e2c4', fontSize: 11, fontWeight: 800, flexShrink: 0
                }}>
                  {friend.rating}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
