import { useEffect, useState } from 'react'
import { useRoute } from '../router'
import { useApp } from '../store'
import { card, goldText, avatarBlue } from '../theme'

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

export function Profile() {
  const { query } = useRoute()
  const { user } = useApp()
  const username = query.get('u') || user?.username

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [gamesData, setGamesData] = useState<MatchHistory | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!username) return
    setLoading(true)
    Promise.all([
      fetch(`/api/user/${username}`).then((res) => res.ok ? res.json() : null),
      fetch(`/api/user/${username}/games`).then((res) => res.ok ? res.json() : null),
    ]).then(([profileData, gamesRes]) => {
      setProfile(profileData)
      setGamesData(gamesRes)
      setLoading(false)
    })
  }, [username])

  if (loading) {
    return <div style={{ color: '#a99a83', textAlign: 'center', marginTop: 80, fontSize: 18 }}>Loading profile...</div>
  }

  if (!profile) {
    return (
      <div style={{ color: '#e4574d', textAlign: 'center', marginTop: 80, fontSize: 18, fontWeight: 600 }}>
        User "{username}" not found.
      </div>
    )
  }

  const initials = profile.username.slice(0, 2).toUpperCase()
  const totalGames = profile.wins + profile.losses
  const winRate = totalGames > 0 ? Math.round((profile.wins / totalGames) * 100) : 0

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 60 }}>
      {/* Header Card */}
      <div style={{ ...card, padding: 36, display: 'flex', alignItems: 'center', gap: 32, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -50, right: -50, width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(201, 155, 69, 0.15) 0%, transparent 65%)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{ ...avatarBlue(100, 36, 30), boxShadow: '0 0 0 4px #1a130d, 0 0 0 2px #3a2c1d' }}>
            {initials}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ ...goldText, fontFamily: "'Cinzel',serif", fontWeight: 800, fontSize: 40, lineHeight: 1.1 }}>
            {profile.username}
          </div>
          <div style={{ color: '#a99a83', fontSize: 14, marginTop: 6, fontWeight: 500 }}>
            Member since {new Date(profile.createdAt).toLocaleDateString()}
          </div>
        </div>

        <div style={{ textAlign: 'center', background: 'linear-gradient(180deg,#241b13,#17110b)', padding: '16px 28px', borderRadius: 20, border: '1px solid #3a2c1d', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05)' }}>
          <div style={{ fontSize: 12, color: '#a99a83', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>Rating</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#f0e2c4', marginTop: 4 }}>{profile.rating}</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
        <StatBox label="Wins" value={profile.wins} color="#4bbf7b" />
        <StatBox label="Losses" value={profile.losses} color="#e4574d" />
        <StatBox label="Win Rate" value={`${winRate}%`} color="#4a92e0" />
        <StatBox label="Best Streak" value={profile.bestWinStreak} color="#f0c24e" />
      </div>

      {/* Match History */}
      <div style={{ ...card, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 20, color: '#f0e2c4', fontWeight: 700, fontFamily: "'Cinzel',serif" }}>Recent Matches</h3>
          {gamesData && gamesData.total > 0 && (
            <div style={{ color: '#a99a83', fontSize: 14, fontWeight: 600 }}>{gamesData.total} Games Played</div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!gamesData || gamesData.games.length === 0 ? (
            <div style={{ color: '#a99a83', fontStyle: 'italic', padding: '20px 0', textAlign: 'center', background: '#17110b', borderRadius: 12, border: '1px solid #2e2115' }}>
              No matches played yet.
            </div>
          ) : (
            gamesData.games.map((game) => {
              const isWinner = game.rank === 1
              const isDraw = game.status === 'COMPLETED' && !game.participants.some(p => p.rank === 1) // Edge case if no winners
              const resultText = isWinner ? 'VICTORY' : (isDraw ? 'DRAW' : 'DEFEAT')
              const resultColor = isWinner ? '#4bbf7b' : (isDraw ? '#a99a83' : '#e4574d')

              // Filter out current user from opponents list to show who they played against
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
                      vs {opponents.length > 0 ? opponents.map(o => o.username).join(', ') : 'Bots / Unknown'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{ color: '#c99b45', fontSize: 13, fontWeight: 700 }}>
                      {game.piecesInGoal} / 4 Goals
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
