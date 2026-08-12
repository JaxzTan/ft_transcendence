import { useTranslation } from 'react-i18next'
import { useEffect, useState, useRef } from 'react'
import { useRoute, navigate } from '../router'
import { useApp } from '../store'
import { card, goldText, avatarBlue, STATUS_STYLE, type PresenceStatus } from '../theme'
import { UserAvatar } from '../components/UserAvatar'

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Header Card */}
        <div style={{ ...card, padding: 36, display: 'flex', alignItems: 'center', gap: 32, position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: -50, right: -50, width: 320, height: 320,
            background: 'radial-gradient(circle, rgba(93, 228, 199, 0.18) 0%, transparent 65%)',
            pointerEvents: 'none'
          }} />

          <div style={{ position: 'relative' }}>
            <UserAvatar 
              username={profile.username}
              size={100}
              fallbackStyle={avatarBlue(100, 36, 30)}
              style={{ boxShadow: '0 0 0 4px rgba(93,228,199,0.35), 0 0 24px rgba(137,221,255,0.4)' }}
              cacheBuster={avatarBuster}
            />
            <span
              title={statusStyle.label}
              style={{
                position: 'absolute', right: 4, bottom: 4, width: 18, height: 18, borderRadius: '50%',
                background: statusStyle.color, border: '3px solid #13151f', boxShadow: `0 0 8px ${statusStyle.color}`,
              }}
            />
            {isOwnProfile && (
              <div 
                onClick={() => !uploading && fileInputRef.current?.click()}
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'rgba(19,21,31,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 13, fontWeight: 800, cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: 0, transition: 'opacity 0.2s', fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                  boxShadow: '0 0 0 4px rgba(93,228,199,0.35), 0 0 24px rgba(137,221,255,0.4)',
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
            <div style={{ ...goldText, fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontWeight: 900, fontSize: 38, lineHeight: 1.1, letterSpacing: -0.5 }}>
              {profile.username}
            </div>
            <div style={{ color: statusStyle.color, fontSize: 13.5, marginTop: 6, fontWeight: 700, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
              {t(STATUS_KEYS[profile.status] ?? STATUS_KEYS.offline)}
            </div>
            <div style={{ color: '#a6accd', fontSize: 14, marginTop: 4, fontWeight: 500 }}>
              {t('profile.memberSince')} {new Date(profile.createdAt).toLocaleDateString()}
            </div>
            {isOwnProfile && (
              <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
                <span onClick={handleRemoveAvatar} style={{ color: '#d0679d', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: 0.85 }} onMouseOver={(e) => e.currentTarget.style.opacity = '1'} onMouseOut={(e) => e.currentTarget.style.opacity = '0.85'}>
                  Remove Avatar
                </span>
                {uploadError && <span style={{ color: '#d0679d', fontSize: 12.5, fontWeight: 700 }}>· {uploadError}</span>}
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', background: 'linear-gradient(145deg, rgba(27,30,46,0.8), rgba(20,23,35,0.9))', padding: '18px 30px', borderRadius: 20, border: '1px solid rgba(93,228,199,0.2)', boxShadow: '0 8px 20px -6px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 12, color: '#5de4c7', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 800, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{t('dashboard.rating')}</div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#ffcb6b', marginTop: 4, fontFamily: "'Space Grotesk', 'Outfit', sans-serif", textShadow: '0 0 14px rgba(255,203,107,0.3)' }}>♛ {profile.rating}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
          <StatBox label={t('profile.wins')} value={profile.wins} color="#5de4c7" />
          <StatBox label={t('profile.losses')} value={profile.losses} color="#d0679d" />
          <StatBox label={t('profile.winRate')} value={`${winRate}%`} color="#89ddff" />
          <StatBox label={t('profile.bestStreak')} value={profile.bestWinStreak} color="#ffcb6b" />
        </div>

        <div style={{ ...card, padding: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <h3 style={{ margin: 0, fontSize: 20, color: '#f0f4fc', fontWeight: 900, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{t('profile.recentMatches')}</h3>
            {gamesData && gamesData.total > 0 && (
              <div style={{ color: '#a6accd', fontSize: 14, fontWeight: 600 }}>{t('profile.gamesPlayedCount', { count: gamesData.total })}</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!gamesData || gamesData.games.length === 0 ? (
              <div style={{ color: '#a6accd', fontStyle: 'italic', padding: '24px 0', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                {t('profile.noMatchesPlayed')}
              </div>
            ) : (
              gamesData.games.map((game) => {
                const isWinner = game.rank === 1
                const isDraw = game.status === 'COMPLETED' && !game.participants.some(p => p.rank === 1)
                const resultText = isWinner ? t('profile.resultVictory') : (isDraw ? t('profile.resultDraw') : t('profile.resultDefeat'))
                const resultColor = isWinner ? '#5de4c7' : (isDraw ? '#a6accd' : '#d0679d')

                const opponents = game.participants.filter(p => p.username !== profile.username)

                return (
                  <div key={game.gameId} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 22px', background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'all 0.2s', cursor: 'default'
                  }}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div style={{
                        fontWeight: 900, fontSize: 13, padding: '7px 14px', borderRadius: 10, letterSpacing: 1,
                        background: resultColor + '20', color: resultColor, border: `1px solid ${resultColor}55`,
                        width: 90, textAlign: 'center', fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
                        boxShadow: `0 0 10px ${resultColor}33`,
                      }}>
                        {resultText}
                      </div>

                      <div style={{ color: '#f0f4fc', fontWeight: 700, fontSize: 15, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                        {t('profile.vsLabel')} {opponents.length > 0 ? opponents.map(o => o.username).join(', ') : t('profile.botsUnknown')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                      <div style={{ color: '#ffcb6b', fontSize: 13.5, fontWeight: 700, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                        {t('profile.goalsCount', { count: game.piecesInGoal })}
                      </div>
                      <div style={{ color: '#a6accd', fontSize: 13, minWidth: 80, textAlign: 'right' }}>
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
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, boxShadow: `0 0 8px ${color}` }} />
      <div style={{ color: '#a6accd', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
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
        <h3 style={{ margin: 0, fontSize: 19, color: '#f0f4fc', fontWeight: 900, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
          {t('nav.friends')}
        </h3>
        <div style={{ background: 'linear-gradient(135deg, #5de4c7, #89ddff)', color: '#13151f', padding: '2px 9px', borderRadius: 12, fontSize: 12, fontWeight: 800, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
          {friends ? friends.length : 0}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!friends ? (
          <div style={{ color: '#a6accd', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>{t('common.loading')}</div>
        ) : friends.length === 0 ? (
          <div style={{ color: '#a6accd', fontSize: 13, textAlign: 'center', padding: '20px 0', background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
            {t('profile.noFriendsShort')}<br/><br/>
            <span style={{ color: '#5de4c7', cursor: 'pointer', fontWeight: 700 }}>{t('profile.findPlayers')}</span>
          </div>
        ) : (
          friends.map((friend) => {
            const status = STATUS_STYLE[friend.status] ?? STATUS_STYLE.offline
            return (
              <div key={friend.id} style={{
                display: 'flex', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.15s'
              }}
                onClick={() => navigate(`/profile?u=${friend.username}`)}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
              >
                <div style={{ position: 'relative', marginRight: 12, flexShrink: 0 }}>
                  <UserAvatar 
                    username={friend.username}
                    size={38}
                    fallbackStyle={avatarBlue(38, 13, 10)}
                    style={{ boxShadow: '0 0 0 2px rgba(93,228,199,0.3)' }}
                  />
                  <span
                    style={{
                      position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: '50%',
                      background: status.color, border: '2px solid #13151f', boxShadow: `0 0 6px ${status.color}`,
                    }}
                  />
                </div>

                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: '#f0f4fc', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                    {friend.username}
                  </div>
                  <div style={{ color: status.color, fontSize: 11.5, fontWeight: 700, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                    {t(STATUS_KEYS[friend.status] ?? STATUS_KEYS.offline)}
                  </div>
                </div>

                {/* Rating Badge */}
                <div style={{
                  padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,203,107,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,203,107,0.12)',
                  color: '#ffcb6b', fontSize: 12, fontWeight: 800, flexShrink: 0, fontFamily: "'Space Grotesk', 'Outfit', sans-serif"
                }}>
                  ♛ {friend.rating}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
