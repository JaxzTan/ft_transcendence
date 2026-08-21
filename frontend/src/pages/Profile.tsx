import { useEffect, useState, useRef } from 'react'
import { RetroNavbar } from '../components/RetroNavbar'
import { UserAvatar } from '../components/UserAvatar'
import { useRoute, navigate } from '../router'
import { useApp } from '../store'
import { STATUS_STYLE, type PresenceStatus } from '../theme'
import { retroAudio } from '../utils/audio'
import { getRankTier } from '../utils/ranks'
import { RankBadge } from '../components/RankBadge'
import '../styles/retrowave.css'

type ThemeType = 'synthwave' | 'win95' | 'terminal'

type UserProfile = {
  id: string
  username: string
  avatarStyle: string | null
  rating: number
  highestRating: number
  wins: number
  losses: number
  winStreak: number
  bestWinStreak: number
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

const ACHIEVEMENTS_DEF = [
  { key: 'achFirstBlood', title: 'FIRST BLOOD', desc: 'Secure your 1st match victory', icon: '◈' },
  { key: 'achOnFire', title: 'ON FIRE', desc: 'Achieve a 3-game win streak', icon: '▲' },
  { key: 'achDiceMaster', title: 'DICE MASTER', desc: 'Reach 50 total match victories', icon: '⚄' },
  { key: 'achBabySteps', title: 'BABY STEPS', desc: 'Win 1st game vs training bots', icon: '⚙' },
  { key: 'achTheDiceLoveMe', title: 'DICE LOVER', desc: 'Win 10 games vs training bots', icon: '★' },
  { key: 'achTactician', title: 'TACTICIAN', desc: 'Reach 100 combat victories', icon: '♟' },
  { key: 'achMaster', title: 'MASTER', desc: 'Reach 250 combat victories', icon: '♛' },
  { key: 'achGrandBotMaster', title: 'GRAND MASTER', desc: 'Reach 500 combat victories', icon: '◆' },
  { key: 'achWorldChampion', title: 'CHAMPION', desc: 'Reach 1,000 combat victories', icon: '★' },
  { key: 'achLoveTheMachine', title: 'VETERAN', desc: 'Complete 100 total matches', icon: '⚡' },
  { key: 'achft_Transcendence', title: 'TRANSCENDENCE', desc: 'Win 100 PvP human matches', icon: '✦' },
  { key: 'achSpeedDemon', title: 'SPEED DEMON', desc: 'Win match in under 30 mins', icon: '⏱' },
  { key: 'achUnstoppable', title: 'UNSTOPPABLE', desc: 'Capture 3 pieces in 1 game', icon: '⚔' },
  { key: 'achCleanSweep', title: 'CLEAN SWEEP', desc: 'Win 4 pieces while rivals have 0', icon: '◈' },
  { key: 'achLastLaugh', title: 'LAST LAUGH', desc: 'Win while all rivals have goal pieces', icon: '❖' },
]

export function Profile() {
  const { query } = useRoute()
  const { user } = useApp()
  const username = query.get('u') || user?.username
  const isOwnProfile = user?.username === username

  // ------------------------------------------------------------------------
  // THEME & CRT CONTROLS
  // ------------------------------------------------------------------------
  const [theme, setTheme] = useState<ThemeType>('synthwave')
  const [crtEnabled, setCrtEnabled] = useState(true)

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

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [gamesData, setGamesData] = useState<MatchHistory | null>(null)
  const [friendsData, setFriendsData] = useState<Friend[] | null>(null)
  const [achievements, setAchievements] = useState<Record<string, boolean>>({})
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Active View Tab: 'logs' | 'achievements' | 'allies'
  const [activeTab, setActiveTab] = useState<'logs' | 'achievements' | 'allies'>('logs')
  const [achievementFilter, setAchievementFilter] = useState<'all' | 'unlocked' | 'locked'>('all')

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
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json()
        setUploadError(err.message || 'Failed to upload avatar.')
      } else {
        retroAudio.playUiBeep(880, 0.06)
        setAvatarBuster(Date.now())
      }
    } catch (e) {
      setUploadError('An error occurred during upload.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    try {
      const res = await fetch('/api/user/avatar', {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        retroAudio.playUiBeep(440, 0.06)
        setAvatarBuster(Date.now())
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (!username) return
    let cancelled = false
    setLoading(true)

    fetch(`/api/user/${username}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setProfile(data)
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    fetch(`/api/user/${username}/games?limit=30`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setGamesData(data)
      })
      .catch(() => {
        if (!cancelled) setGamesData(null)
      })

    fetch('/api/achievements', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setAchievements(data)
      })
      .catch(() => {
        if (!cancelled) setAchievements({})
      })

    fetch('/api/friends', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          const list = Array.isArray(data) ? data : data?.friends || []
          setFriendsData(list)
        }
      })
      .catch(() => {
        if (!cancelled) setFriendsData([])
      })

    fetch('/api/leaderboard?mode=global&limit=50', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        if (isOwnProfile && data?.myRank?.rank) {
          setLeaderboardRank(data.myRank.rank)
        } else if (data?.entries) {
          const match = data.entries.find((e: { username: string; rank: number }) => e.username === username)
          setLeaderboardRank(match ? match.rank : null)
        }
      })
      .catch(() => {
        if (!cancelled) setLeaderboardRank(null)
      })

    return () => {
      cancelled = true
    }
  }, [username, avatarBuster, isOwnProfile])

  const totalGames = profile ? profile.wins + profile.losses : 0
  const winRate = totalGames > 0 ? Math.round((profile!.wins / totalGames) * 100) : 0
  const statusStyle = profile ? STATUS_STYLE[profile.status] || STATUS_STYLE.offline : STATUS_STYLE.offline
  const rankTier = profile ? getRankTier(profile.rating, leaderboardRank) : getRankTier(1200)
  const peakRating = profile ? profile.highestRating || profile.rating : 1200
  const peakTier = getRankTier(peakRating)

  const unlockedCount = ACHIEVEMENTS_DEF.filter((a) => !!achievements[a.key]).length
  const totalAchievements = ACHIEVEMENTS_DEF.length
  const achievementPercent = Math.round((unlockedCount / totalAchievements) * 100)

  const filteredAchievements = ACHIEVEMENTS_DEF.filter((a) => {
    const isUnlocked = !!achievements[a.key]
    if (achievementFilter === 'unlocked') return isUnlocked
    if (achievementFilter === 'locked') return !isUnlocked
    return true
  })

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
      <div
        className={`crt-screen ${crtEnabled ? 'crt-curved' : ''}`}
        id="crtScreen"
        style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div
          className="crt-scanlines"
          id="crtOverlay"
          style={{ display: crtEnabled ? 'block' : 'none' }}
        />
        <div className="crt-flicker" />

        {/* Navigation Dock */}
        <RetroNavbar
          activeRoute="/profile"
          crtEnabled={crtEnabled}
          toggleCrt={toggleCrt}
        />

        {/* Main Content Wrapper */}
        <div
          className="app-wrapper"
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Top Hero Banner */}
          <header className="hero-section" style={{ padding: '10px 0 8px', flexShrink: 0, textAlign: 'left' }}>
            <h1 className="hero-title" style={{ fontSize: '1.35rem', margin: 0, letterSpacing: '1px' }}>
              PLAYER DOSSIER // CALLSIGN DATABASE
            </h1>
          </header>

          {loading ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--accent-yellow)', fontSize: '0.95rem', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
              INITIALIZING PILOT DOSSIER TELEMETRY...
            </div>
          ) : !profile ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#ff0055', fontSize: '0.95rem', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
              PLAYER "{username}" NOT FOUND IN ARCHIVES.
            </div>
          ) : (
            /* Main Unified Dossier Window */
            <div
              className="retro-window"
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                margin: '0 0 14px',
                overflow: 'hidden',
                background: 'rgba(12, 4, 30, 0.92)',
                border: '1.5px solid rgba(0, 240, 255, 0.45)',
                boxShadow: '0 0 28px rgba(0, 240, 255, 0.18)',
              }}
            >
              {/* Window Header */}
              <div
                className="window-header"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 16px',
                  background: 'linear-gradient(90deg, rgba(255, 0, 127, 0.25), rgba(0, 240, 255, 0.25))',
                  borderBottom: '1px solid rgba(0, 240, 255, 0.3)',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.82rem', letterSpacing: '0.04em', fontWeight: 900, color: '#ffffff' }}>
                  // DOSSIER SPECIFICATIONS • {profile.username.toUpperCase()} (ID: #{profile.id.slice(0, 8).toUpperCase()})
                </span>
                <div className="window-controls" style={{ display: 'flex', gap: 6 }}>
                  <span className="window-btn min" />
                  <span className="window-btn max" />
                </div>
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  ENLARGED OPERATIVE COMMAND HUD (Top Prominent Section)
                 ───────────────────────────────────────────────────────────── */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(280px, auto) 1fr minmax(200px, auto)',
                  gap: 28,
                  alignItems: 'center',
                  padding: '24px 30px',
                  background: 'rgba(18, 6, 42, 0.88)',
                  borderBottom: '2px solid rgba(0, 240, 255, 0.25)',
                  flexShrink: 0,
                }}
              >
                {/* 1. Left: Big Operative Identity & Large Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  {/* Large Avatar Capsule */}
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        padding: 4,
                        borderRadius: 16,
                        background: `linear-gradient(135deg, ${rankTier.color}, var(--accent-cyan))`,
                        boxShadow: `0 0 22px ${rankTier.glow}`,
                      }}
                    >
                      <UserAvatar
                        username={profile.username}
                        avatarStyle={profile.avatarStyle}
                        size={110}
                        fallbackStyle={{
                          width: 110,
                          height: 110,
                          borderRadius: 12,
                          background: 'rgba(10, 2, 28, 0.95)',
                          color: 'var(--accent-cyan)',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '2.4rem',
                          fontWeight: 900,
                          fontFamily: 'var(--font-display)',
                        }}
                        cacheBuster={avatarBuster}
                      />
                    </div>

                    {/* Live Status Beacon */}
                    <span
                      title={statusStyle.label}
                      style={{
                        position: 'absolute',
                        right: 4,
                        bottom: 4,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: statusStyle.color,
                        border: '3px solid #0d0221',
                        boxShadow: `0 0 10px ${statusStyle.color}`,
                      }}
                    />

                    {isOwnProfile && (
                      <div
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 16,
                          background: 'rgba(5, 2, 18, 0.82)',
                          backdropFilter: 'blur(4px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-cyan)',
                          fontSize: '0.78rem',
                          fontWeight: 900,
                          fontFamily: 'var(--font-display)',
                          cursor: uploading ? 'not-allowed' : 'pointer',
                          opacity: 0,
                          transition: 'opacity 0.2s ease',
                          textAlign: 'center',
                          padding: 6,
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseOut={(e) => (e.currentTarget.style.opacity = '0')}
                      >
                        {uploading ? 'SCANNING...' : 'CHANGE PIC'}
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

                  {/* Operative Callsign & Meta */}
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.95rem',
                        fontWeight: 900,
                        color: '#ffffff',
                        letterSpacing: '0.05em',
                        lineHeight: 1.1,
                        textShadow: '0 0 16px rgba(0, 240, 255, 0.6)',
                      }}
                    >
                      {profile.username}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <span
                        style={{
                          color: statusStyle.color,
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-display)',
                          fontWeight: 900,
                          background: 'rgba(0, 0, 0, 0.45)',
                          border: `1px solid ${statusStyle.color}`,
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        ● {statusStyle.label.toUpperCase()}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', fontFamily: 'var(--font-display)' }}>
                        COMMISSIONED: {new Date(profile.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Action Controls */}
                    <div style={{ marginTop: 12 }}>
                      {isOwnProfile ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            className="retro-btn"
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                              padding: '4px 12px',
                              fontSize: '0.72rem',
                              color: 'var(--accent-cyan)',
                              borderColor: 'rgba(0, 240, 255, 0.45)',
                              fontFamily: 'var(--font-display)',
                              borderRadius: 5,
                            }}
                          >
                            UPLOAD PIC
                          </button>
                          <button
                            className="retro-btn"
                            onClick={handleRemoveAvatar}
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.72rem',
                              color: '#ff0055',
                              borderColor: 'rgba(255, 0, 85, 0.45)',
                              fontFamily: 'var(--font-display)',
                              borderRadius: 5,
                            }}
                          >
                            RESET
                          </button>
                          {uploadError && (
                            <span style={{ color: '#ff0055', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
                              {uploadError}
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          className="retro-btn"
                          onClick={() => {
                            retroAudio.playUiBeep(640, 0.04)
                            navigate('/profile')
                          }}
                          style={{
                            padding: '4px 14px',
                            fontSize: '0.75rem',
                            color: 'var(--accent-cyan)',
                            borderColor: 'rgba(0, 240, 255, 0.45)',
                            fontFamily: 'var(--font-display)',
                            borderRadius: 5,
                          }}
                        >
                          ◄ RETURN TO MY PROFILE
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Center: Enlarged Telemetry Stats Strip */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 16,
                    background: 'rgba(10, 3, 24, 0.75)',
                    padding: '18px 24px',
                    borderRadius: 10,
                    border: '1.5px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: 'inset 0 0 16px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  {/* Wins */}
                  <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.08)', paddingRight: 10 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', fontFamily: 'var(--font-display)', fontWeight: 900 }}>
                      VICTORIES
                    </div>
                    <div style={{ color: '#00ff88', fontSize: '1.9rem', fontWeight: 900, fontFamily: 'var(--font-display)', marginTop: 4, lineHeight: 1 }}>
                      {profile.wins}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'var(--font-display)', marginTop: 4 }}>
                      OF {totalGames} MATCHES
                    </div>
                  </div>

                  {/* Defeats */}
                  <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.08)', paddingRight: 10 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', fontFamily: 'var(--font-display)', fontWeight: 900 }}>
                      DEFEATS
                    </div>
                    <div style={{ color: '#ff007f', fontSize: '1.9rem', fontWeight: 900, fontFamily: 'var(--font-display)', marginTop: 4, lineHeight: 1 }}>
                      {profile.losses}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'var(--font-display)', marginTop: 4 }}>
                      OF {totalGames} MATCHES
                    </div>
                  </div>

                  {/* Win Ratio */}
                  <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.08)', paddingRight: 10 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', fontFamily: 'var(--font-display)', fontWeight: 900 }}>
                      WIN RATIO
                    </div>
                    <div style={{ color: 'var(--accent-cyan)', fontSize: '1.9rem', fontWeight: 900, fontFamily: 'var(--font-display)', marginTop: 4, lineHeight: 1 }}>
                      {winRate}%
                    </div>
                    <div style={{ width: '85%', height: 4, background: 'rgba(255,255,255,0.1)', margin: '6px auto 0', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${winRate}%`, height: '100%', background: 'var(--accent-cyan)', boxShadow: '0 0 6px var(--accent-cyan)' }} />
                    </div>
                  </div>

                  {/* Best Streak */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', fontFamily: 'var(--font-display)', fontWeight: 900 }}>
                      BEST STREAK
                    </div>
                    <div style={{ color: '#ffe600', fontSize: '1.9rem', fontWeight: 900, fontFamily: 'var(--font-display)', marginTop: 4, lineHeight: 1 }}>
                      {profile.bestWinStreak}
                    </div>
                    <div style={{ color: '#ffe600', fontSize: '0.68rem', fontFamily: 'var(--font-display)', marginTop: 4 }}>
                      CURRENT: <strong>{profile.winStreak}</strong>
                    </div>
                  </div>
                </div>

                {/* 3. Right: Prominent Combat Rating & Rank Citadel */}
                <div
                  style={{
                    padding: '18px 24px',
                    borderRadius: 10,
                    background: 'linear-gradient(180deg, rgba(24, 6, 45, 0.95), rgba(10, 2, 24, 0.98))',
                    border: `2px solid ${rankTier.color}`,
                    boxShadow: `0 0 24px ${rankTier.glow}, inset 0 0 14px ${rankTier.glow}`,
                    textAlign: 'center',
                    minWidth: 180,
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: rankTier.color, fontFamily: 'var(--font-display)', fontWeight: 900, letterSpacing: '1px' }}>
                    COMBAT RATING
                  </div>
                  <div
                    style={{
                      fontSize: '2.2rem',
                      fontWeight: 900,
                      color: '#ffffff',
                      fontFamily: 'var(--font-display)',
                      letterSpacing: '0.04em',
                      margin: '2px 0 6px',
                      textShadow: `0 0 16px ${rankTier.glow}`,
                    }}
                  >
                    ♛ {profile.rating}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                    <RankBadge tier={rankTier} fontSize="12.5px" padding="3.5px 12px" />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                    PEAK: <strong style={{ color: peakTier.color }}>♛ {peakRating}</strong>
                  </div>
                </div>
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  MASSIVE TACTICAL VIEWPORT (Lower Segment)
                 ───────────────────────────────────────────────────────────── */}
              {/* Tabs Selection Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 28px',
                  background: 'rgba(10, 3, 24, 0.96)',
                  borderBottom: '2px solid rgba(0, 240, 255, 0.3)',
                  flexShrink: 0,
                }}
              >
                {/* Left: Tab Selectors */}
                <div style={{ display: 'flex', gap: 16 }}>
                  <button
                    className={`retro-btn ${activeTab === 'logs' ? 'active' : ''}`}
                    onClick={() => {
                      retroAudio.playUiBeep(640, 0.04)
                      setActiveTab('logs')
                    }}
                    style={{
                      padding: '12px 26px',
                      fontSize: '1.05rem',
                      fontFamily: 'var(--font-display)',
                      letterSpacing: '0.04em',
                      fontWeight: 900,
                      background: activeTab === 'logs' ? 'var(--accent-pink)' : 'rgba(255, 255, 255, 0.04)',
                      color: activeTab === 'logs' ? '#ffffff' : 'var(--text-muted)',
                      border: `2px solid ${activeTab === 'logs' ? 'var(--accent-pink)' : 'rgba(255, 255, 255, 0.15)'}`,
                      borderRadius: 10,
                      boxShadow: activeTab === 'logs' ? '0 0 20px rgba(255, 0, 127, 0.5)' : 'none',
                    }}
                  >
                    ⚔️ COMBAT LOGS ({gamesData?.total ?? 0})
                  </button>

                  <button
                    className={`retro-btn ${activeTab === 'achievements' ? 'active' : ''}`}
                    onClick={() => {
                      retroAudio.playUiBeep(680, 0.04)
                      setActiveTab('achievements')
                    }}
                    style={{
                      padding: '12px 26px',
                      fontSize: '1.05rem',
                      fontFamily: 'var(--font-display)',
                      letterSpacing: '0.04em',
                      fontWeight: 900,
                      background: activeTab === 'achievements' ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.04)',
                      color: activeTab === 'achievements' ? '#0d0221' : 'var(--text-muted)',
                      border: `2px solid ${activeTab === 'achievements' ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.15)'}`,
                      borderRadius: 10,
                      boxShadow: activeTab === 'achievements' ? '0 0 20px rgba(0, 240, 255, 0.5)' : 'none',
                    }}
                  >
                    🏆 ACHIEVEMENTS ({unlockedCount}/{totalAchievements})
                  </button>

                  <button
                    className={`retro-btn ${activeTab === 'allies' ? 'active' : ''}`}
                    onClick={() => {
                      retroAudio.playUiBeep(720, 0.04)
                      setActiveTab('allies')
                    }}
                    style={{
                      padding: '12px 26px',
                      fontSize: '1.05rem',
                      fontFamily: 'var(--font-display)',
                      letterSpacing: '0.04em',
                      fontWeight: 900,
                      background: activeTab === 'allies' ? '#ffe600' : 'rgba(255, 255, 255, 0.04)',
                      color: activeTab === 'allies' ? '#0d0221' : 'var(--text-muted)',
                      border: `2px solid ${activeTab === 'allies' ? '#ffe600' : 'rgba(255, 255, 255, 0.15)'}`,
                      borderRadius: 10,
                      boxShadow: activeTab === 'allies' ? '0 0 20px rgba(255, 230, 0, 0.5)' : 'none',
                    }}
                  >
                    ♟ ALLIED OPERATIVES ({friendsData?.length ?? 0})
                  </button>
                </div>

                {/* Right Tab Action */}
                {activeTab === 'achievements' && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(['all', 'unlocked', 'locked'] as const).map((f) => (
                      <button
                        key={f}
                        className={`retro-btn ${achievementFilter === f ? 'active' : ''}`}
                        onClick={() => {
                          retroAudio.playUiBeep(800, 0.03)
                          setAchievementFilter(f)
                        }}
                        style={{
                          padding: '6px 16px',
                          fontSize: '0.85rem',
                          fontFamily: 'var(--font-display)',
                          textTransform: 'uppercase',
                          background: achievementFilter === f ? 'rgba(0, 240, 255, 0.25)' : 'transparent',
                          color: achievementFilter === f ? 'var(--accent-cyan)' : 'var(--text-muted)',
                          border: `1.5px solid ${achievementFilter === f ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.12)'}`,
                          borderRadius: 6,
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'allies' && (
                  <button
                    className="retro-btn"
                    onClick={() => navigate('/friends')}
                    style={{
                      padding: '8px 18px',
                      fontSize: '0.88rem',
                      fontFamily: 'var(--font-display)',
                      color: 'var(--accent-cyan)',
                      borderColor: 'rgba(0, 240, 255, 0.45)',
                      borderRadius: 8,
                    }}
                  >
                    COMM-LINK HUB →
                  </button>
                )}
              </div>

              {/* Massive Scrollable Tab Viewport */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '24px 32px',
                  background: 'rgba(15, 5, 35, 0.75)',
                }}
              >
                {/* ─────────────────────────────────────────────────────────────
                    TAB 1: MASSIVE COMBAT LOGS (Match History Stream)
                   ───────────────────────────────────────────────────────────── */}
                {activeTab === 'logs' && (
                  <div>
                    {!gamesData || gamesData.games.length === 0 ? (
                      <div style={{ padding: 64, textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.15rem', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                        NO COMBAT ARCHIVES RECORDED FOR THIS OPERATIVE.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {gamesData.games.map((g) => {
                          const isWin = g.rank === 1
                          return (
                            <div
                              key={g.gameId}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '22px 30px',
                                borderRadius: 12,
                                background: isWin ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 0, 127, 0.08)',
                                border: `2px solid ${isWin ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 0, 127, 0.42)'}`,
                                fontFamily: 'var(--font-display)',
                                letterSpacing: '0.03em',
                                transition: 'all 0.18s ease',
                              }}
                            >
                              {/* Left: Result & info */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                                <span
                                  style={{
                                    fontSize: '1.2rem',
                                    fontWeight: 900,
                                    padding: '10px 20px',
                                    borderRadius: 8,
                                    background: isWin ? 'rgba(0, 255, 136, 0.28)' : 'rgba(255, 0, 127, 0.28)',
                                    color: isWin ? '#00ff88' : '#ff007f',
                                    border: `1.5px solid ${isWin ? '#00ff88' : '#ff007f'}`,
                                    textShadow: isWin ? '0 0 12px #00ff88' : '0 0 12px #ff007f',
                                    minWidth: 155,
                                    textAlign: 'center',
                                  }}
                                >
                                  {isWin ? '#1 VICTORY' : `RANK #${g.rank ?? '?'}`}
                                </span>

                                <div>
                                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ffffff', letterSpacing: '0.04em' }}>
                                    {isWin ? 'MISSION ACCOMPLISHED' : 'TACTICAL DEFEAT'}
                                  </div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: 5 }}>
                                    {g.participants.length} COMBATANTS • {new Date(g.startedAt).toLocaleDateString()} {new Date(g.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Telemetry data */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                                <div style={{ textAlign: 'right', fontSize: '1.15rem', color: 'var(--text-muted)' }}>
                                  CAP: <strong style={{ color: '#ffffff' }}>{g.piecesCaptured}</strong> • GOAL: <strong style={{ color: isWin ? '#00ff88' : '#ffffff' }}>{g.piecesInGoal}/4</strong>
                                </div>
                                <span
                                  style={{
                                    fontSize: '1.05rem',
                                    padding: '8px 20px',
                                    borderRadius: 8,
                                    background: isWin ? 'rgba(0, 255, 136, 0.28)' : 'rgba(255, 0, 127, 0.28)',
                                    color: isWin ? '#00ff88' : '#ff007f',
                                    fontWeight: 900,
                                    border: `1.5px solid ${isWin ? '#00ff88' : '#ff007f'}`,
                                  }}
                                >
                                  {isWin ? 'WIN' : 'LOSS'}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    TAB 2: MASSIVE ACHIEVEMENTS MATRIX
                   ───────────────────────────────────────────────────────────── */}
                {activeTab === 'achievements' && (
                  <div>
                    {/* Completion Progress Bar */}
                    <div
                      style={{
                        padding: '22px 30px',
                        borderRadius: 12,
                        background: 'rgba(10, 3, 24, 0.75)',
                        border: '2px solid rgba(0, 240, 255, 0.3)',
                        marginBottom: 24,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: 10 }}>
                        <span style={{ color: 'var(--accent-cyan)', letterSpacing: '0.05em' }}>SYSTEM SYNCHRONIZATION</span>
                        <span style={{ color: '#ffe600' }}>{unlockedCount} / {totalAchievements} ({achievementPercent}%)</span>
                      </div>
                      <div style={{ width: '100%', height: 12, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 6, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${achievementPercent}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, var(--accent-cyan), #ffe600)',
                            boxShadow: '0 0 14px rgba(0, 240, 255, 0.75)',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Massive Achievements Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                        gap: 20,
                      }}
                    >
                      {filteredAchievements.map((ach) => {
                        const isUnlocked = !!achievements[ach.key]
                        return (
                          <div
                            key={ach.key}
                            style={{
                              padding: '22px 24px',
                              borderRadius: 12,
                              background: isUnlocked ? 'rgba(40, 16, 76, 0.92)' : 'rgba(10, 4, 25, 0.55)',
                              border: isUnlocked ? '2px solid #ffe600' : '1.5px dashed rgba(255, 255, 255, 0.18)',
                              boxShadow: isUnlocked ? '0 0 22px rgba(255, 230, 0, 0.32), inset 0 0 14px rgba(255, 230, 0, 0.12)' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 22,
                              opacity: isUnlocked ? 1 : 0.45,
                              transition: 'all 0.18s ease',
                            }}
                          >
                            <div
                              style={{
                                width: 64,
                                height: 64,
                                borderRadius: 12,
                                background: isUnlocked ? 'rgba(255, 230, 0, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                                border: `2px solid ${isUnlocked ? '#ffe600' : 'rgba(255,255,255,0.14)'}`,
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: '2.1rem',
                                color: isUnlocked ? '#ffe600' : 'rgba(255, 255, 255, 0.4)',
                                flexShrink: 0,
                                textShadow: isUnlocked ? '0 0 12px #ffe600' : 'none',
                              }}
                            >
                              {ach.icon}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: '1.2rem',
                                  fontWeight: 900,
                                  fontFamily: 'var(--font-display)',
                                  color: isUnlocked ? '#ffffff' : 'var(--text-muted)',
                                  letterSpacing: '0.04em',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {ach.title}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.94rem',
                                  fontFamily: 'var(--font-display)',
                                  color: isUnlocked ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.4)',
                                  marginTop: 5,
                                  lineHeight: 1.35,
                                }}
                              >
                                {ach.desc}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    TAB 3: MASSIVE ALLIED OPERATIVES (Friends List)
                   ───────────────────────────────────────────────────────────── */}
                {activeTab === 'allies' && (
                  <div>
                    {!friendsData || friendsData.length === 0 ? (
                      <div style={{ padding: 64, textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.15rem', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                        NO ALLIED OPERATIVES LINKED IN COMM ARCHIVES.
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                          gap: 20,
                        }}
                      >
                        {friendsData.map((f) => {
                          const fTier = getRankTier(f.rating)
                          const fStatus = STATUS_STYLE[f.status] || STATUS_STYLE.offline
                          return (
                            <div
                              key={f.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '20px 24px',
                                borderRadius: 12,
                                background: 'rgba(14, 5, 36, 0.92)',
                                border: '2px solid rgba(0, 240, 255, 0.35)',
                                cursor: 'pointer',
                                transition: 'all 0.18s ease',
                                minHeight: 110,
                                boxSizing: 'border-box',
                              }}
                              onClick={() => {
                                retroAudio.playUiBeep(640, 0.04)
                                navigate(`/profile?u=${f.username}`)
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(0, 240, 255, 0.18)'
                                e.currentTarget.style.borderColor = 'var(--accent-cyan)'
                                e.currentTarget.style.transform = 'translateY(-3px)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(14, 5, 36, 0.92)'
                                e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.35)'
                                e.currentTarget.style.transform = 'translateY(0)'
                              }}
                            >
                              {/* Left: Avatar + Callsign + Status Beacon */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0, flex: 1, paddingRight: 16 }}>
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                  <UserAvatar
                                    username={f.username}
                                    avatarStyle={f.avatarStyle}
                                    size={68}
                                    fallbackStyle={{
                                      width: 68,
                                      height: 68,
                                      borderRadius: 11,
                                      background: 'rgba(10, 2, 28, 0.9)',
                                      color: 'var(--accent-cyan)',
                                      display: 'grid',
                                      placeItems: 'center',
                                      fontWeight: 900,
                                      fontSize: '1.45rem',
                                      fontFamily: 'var(--font-display)',
                                    }}
                                  />
                                  <span
                                    style={{
                                      position: 'absolute',
                                      right: -1,
                                      bottom: -1,
                                      width: 15,
                                      height: 15,
                                      borderRadius: '50%',
                                      background: fStatus.color,
                                      border: '3px solid #0d0221',
                                      boxShadow: `0 0 10px ${fStatus.color}`,
                                    }}
                                  />
                                </div>

                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div
                                    style={{
                                      fontSize: '1.35rem',
                                      fontWeight: 900,
                                      color: '#ffffff',
                                      fontFamily: 'var(--font-display)',
                                      letterSpacing: '0.04em',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {f.username}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '0.94rem',
                                      color: fStatus.color,
                                      fontFamily: 'var(--font-display)',
                                      fontWeight: 'bold',
                                      marginTop: 4,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                    }}
                                  >
                                    ● {fStatus.label.toUpperCase()}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Perfectly Aligned Telemetry Rating & Badge */}
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-end',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  minWidth: 140,
                                  textAlign: 'right',
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: '1.45rem',
                                    fontWeight: 900,
                                    color: '#ffffff',
                                    fontFamily: 'var(--font-display)',
                                    lineHeight: 1.1,
                                    letterSpacing: '0.03em',
                                  }}
                                >
                                  ♛ {f.rating}
                                </div>
                                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                                  <RankBadge tier={fTier} fontSize="12.5px" padding="3.5px 10px" />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
