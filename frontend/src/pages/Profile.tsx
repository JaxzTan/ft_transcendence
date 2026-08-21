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
  const [mainTab, setMainTab] = useState<'history' | 'achievements'>('history')
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null)
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

    fetch(`/api/user/${username}`, { credentials: 'include' })
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

    fetch(`/api/user/${username}/games?limit=30`, { credentials: 'include' })
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

        {/* Global Navigation Dock */}
        <RetroNavbar
          activeRoute="/profile"
          crtEnabled={crtEnabled}
          toggleCrt={toggleCrt}
        />

        {/* Full-Width App Wrapper Matching Leaderboard */}
        <div
          className="app-wrapper"
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Top Hero Banner */}
          <header className="hero-section" style={{ padding: '16px 0 18px', marginBottom: 12, flexShrink: 0 }}>
            <h1 className="hero-title" style={{ fontSize: '1.45rem', margin: 0, letterSpacing: '1.5px' }}>
              PILOT DOSSIER // CALLSIGN DATABASE
            </h1>
          </header>

          {loading ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--accent-yellow)', fontSize: '1rem', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
              INITIALIZING STEAM DOSSIER TELEMETRY...
            </div>
          ) : !profile ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#ff0055', fontSize: '1rem', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
              PLAYER "{username}" NOT FOUND IN ARCHIVES.
            </div>
          ) : (
            /* Full-Width Unified Retro Window Container */
            <section
              className="retro-window"
              style={{
                width: '100%',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minHeight: 0,
              }}
            >
              {/* Window Header */}
              <div
                className="window-header"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 18px',
                  fontSize: '0.85rem',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'bold', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                  <span>// STEAM PILOT DOSSIER • {profile.username.toUpperCase()} (ID: #{profile.id.slice(0, 8).toUpperCase()})</span>
                </div>
                <div className="window-controls" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="window-btn min" />
                  <span className="window-btn max" />
                </div>
              </div>

              {/* Fixed Viewport Window Body (No Page Scroll) */}
              <div
                className="window-body"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  padding: '14px 20px 16px',
                  flex: 1,
                  overflow: 'hidden',
                  minHeight: 0,
                }}
              >
                {/* ═══════════════════════════════════════════════════════════════
                    1. STEAM PROFILE HERO HEADER (Avatar + Identity + ELO Citadel)
                   ═══════════════════════════════════════════════════════════════ */}
                <div
                  style={{
                    background: 'linear-gradient(180deg, rgba(26, 10, 58, 0.95) 0%, rgba(12, 4, 30, 0.98) 100%)',
                    border: '1.5px solid rgba(0, 240, 255, 0.35)',
                    boxShadow: '0 0 24px rgba(0, 240, 255, 0.15)',
                    borderRadius: 8,
                    padding: '18px 24px',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(320px, 1.35fr) minmax(200px, 1fr) minmax(200px, 1fr)',
                    gap: 16,
                    alignItems: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {/* Ambient Rank Tier Glow */}
                  <div
                    style={{
                      position: 'absolute',
                      top: -60,
                      right: -60,
                      width: 260,
                      height: 260,
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${rankTier.glow} 0%, rgba(0,0,0,0) 70%)`,
                      opacity: 0.25,
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Col 1: Avatar + Callsign + Meta Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
                    {/* Large Avatar Capsule */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div
                        style={{
                          padding: 4,
                          borderRadius: 8,
                          background: `linear-gradient(135deg, ${rankTier.color}, var(--accent-cyan))`,
                          boxShadow: `0 0 20px ${rankTier.glow}`,
                        }}
                      >
                        <UserAvatar
                          username={profile.username}
                          avatarStyle={profile.avatarStyle}
                          size={95}
                          fallbackStyle={{
                            width: 95,
                            height: 95,
                            borderRadius: 6,
                            background: 'rgba(8, 2, 22, 0.95)',
                            color: 'var(--accent-cyan)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '2.3rem',
                            fontWeight: 900,
                            fontFamily: 'var(--font-display)',
                          }}
                          cacheBuster={avatarBuster}
                        />
                      </div>

                      {/* Live Presence Beacon */}
                      <span
                        title={statusStyle.label}
                        style={{
                          position: 'absolute',
                          right: 3,
                          bottom: 3,
                          width: 15,
                          height: 15,
                          borderRadius: '50%',
                          background: statusStyle.color,
                          border: '2.5px solid #0d0221',
                          boxShadow: `0 0 8px ${statusStyle.color}`,
                        }}
                      />

                      {isOwnProfile && (
                        <div
                          onClick={() => !uploading && fileInputRef.current?.click()}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 8,
                            background: 'rgba(5, 2, 18, 0.82)',
                            backdropFilter: 'blur(3px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent-cyan)',
                            fontSize: '0.72rem',
                            fontWeight: 900,
                            fontFamily: 'var(--font-display)',
                            cursor: uploading ? 'not-allowed' : 'pointer',
                            opacity: 0,
                            transition: 'opacity 0.2s ease',
                            textAlign: 'center',
                            padding: 4,
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseOut={(e) => (e.currentTarget.style.opacity = '0')}
                        >
                          {uploading ? 'SCANNING...' : 'CHANGE AVATAR'}
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

                    {/* Pilot Identity Texts */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '1.8rem',
                          fontWeight: 900,
                          color: '#ffffff',
                          letterSpacing: '0.04em',
                          lineHeight: 1.1,
                          textShadow: '0 0 16px rgba(0, 240, 255, 0.6)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {profile.username}
                      </div>

                      <div style={{ color: 'var(--accent-cyan)', fontSize: '0.76rem', fontFamily: 'var(--font-display)', marginTop: 3, letterSpacing: '0.5px' }}>
                        CYBER LUDO '84 GLADIATOR
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            color: statusStyle.color,
                            fontSize: '0.72rem',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 900,
                            background: 'rgba(0, 0, 0, 0.45)',
                            border: `1px solid ${statusStyle.color}`,
                            padding: '2px 7px',
                            borderRadius: 4,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          ● {statusStyle.label.toUpperCase()}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'var(--font-display)' }}>
                          SINCE {new Date(profile.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ marginTop: 8 }}>
                        {isOwnProfile ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                              className="retro-btn"
                              onClick={() => fileInputRef.current?.click()}
                              style={{
                                padding: '3px 9px',
                                fontSize: '0.68rem',
                                color: 'var(--accent-cyan)',
                                borderColor: 'rgba(0, 240, 255, 0.45)',
                                fontFamily: 'var(--font-display)',
                                borderRadius: 4,
                              }}
                            >
                              EDIT AVATAR
                            </button>
                            <button
                              className="retro-btn"
                              onClick={handleRemoveAvatar}
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.68rem',
                                color: '#ff0055',
                                borderColor: 'rgba(255, 0, 85, 0.45)',
                                fontFamily: 'var(--font-display)',
                                borderRadius: 4,
                              }}
                            >
                              RESET
                            </button>
                            {uploadError && (
                              <span style={{ color: '#ff0055', fontSize: '0.66rem', fontFamily: 'var(--font-mono)' }}>
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
                              padding: '4px 11px',
                              fontSize: '0.72rem',
                              color: 'var(--accent-cyan)',
                              borderColor: 'rgba(0, 240, 255, 0.45)',
                              fontFamily: 'var(--font-display)',
                              borderRadius: 4,
                            }}
                          >
                            ◄ RETURN TO MY PROFILE
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Col 2: Spacious Dedicated CURRENT ELO Citadel */}
                  <div
                    style={{
                      borderRadius: 10,
                      background: `radial-gradient(circle at center, ${rankTier.glow} 0%, rgba(8, 2, 26, 0.95) 85%)`,
                      border: `2px solid ${rankTier.color}`,
                      boxShadow: `0 0 24px ${rankTier.glow}, inset 0 0 16px rgba(0, 0, 0, 0.7)`,
                      padding: '14px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      position: 'relative',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: rankTier.color, fontFamily: 'var(--font-display)', fontWeight: 900, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span>⚡</span> CURRENT COMBAT ELO
                    </div>
                    <div
                      style={{
                        fontSize: '2.2rem',
                        fontWeight: 900,
                        color: '#ffffff',
                        fontFamily: 'var(--font-display)',
                        margin: '3px 0 6px',
                        textShadow: `0 0 18px ${rankTier.glow}, 0 0 35px ${rankTier.glow}`,
                        lineHeight: 1,
                        letterSpacing: '0.03em',
                      }}
                    >
                      ♛ {profile.rating}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <RankBadge tier={rankTier} fontSize="12px" padding="3.5px 12px" />
                    </div>
                  </div>

                  {/* Col 3: Spacious Dedicated ALL-TIME PEAK ELO Citadel */}
                  <div
                    style={{
                      borderRadius: 10,
                      background: `radial-gradient(circle at center, ${peakTier.glow} 0%, rgba(8, 2, 26, 0.95) 85%)`,
                      border: `2px solid ${peakTier.color}`,
                      boxShadow: `0 0 24px ${peakTier.glow}, inset 0 0 16px rgba(0, 0, 0, 0.7)`,
                      padding: '14px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      position: 'relative',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: peakTier.color, fontFamily: 'var(--font-display)', fontWeight: 900, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span>★</span> ALL-TIME PEAK RECORD
                    </div>
                    <div
                      style={{
                        fontSize: '2.2rem',
                        fontWeight: 900,
                        color: peakTier.color,
                        fontFamily: 'var(--font-display)',
                        margin: '3px 0 6px',
                        textShadow: `0 0 18px ${peakTier.glow}, 0 0 35px ${peakTier.glow}`,
                        lineHeight: 1,
                        letterSpacing: '0.03em',
                      }}
                    >
                      ♛ {peakRating}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <RankBadge tier={peakTier} fontSize="12px" padding="3.5px 12px" />
                    </div>
                  </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════
                    2. HORIZONTAL CAREER STATS SHOWCASE STRIP (4 Columns)
                   ═══════════════════════════════════════════════════════════════ */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 12,
                    flexShrink: 0,
                  }}
                >
                  {/* Wins */}
                  <div
                    style={{
                      background: 'rgba(12, 4, 30, 0.9)',
                      border: '1.5px solid rgba(0, 255, 136, 0.4)',
                      boxShadow: '0 0 14px rgba(0, 255, 136, 0.12)',
                      borderRadius: 7,
                      padding: '10px 14px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-display)', fontWeight: 900 }}>
                      VICTORIES
                    </div>
                    <div style={{ color: '#00ff88', fontSize: '1.6rem', fontWeight: 900, fontFamily: 'var(--font-display)', marginTop: 2, lineHeight: 1 }}>
                      {profile.wins}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'var(--font-display)', marginTop: 2 }}>
                      OF {totalGames} MATCHES
                    </div>
                  </div>

                  {/* Defeats */}
                  <div
                    style={{
                      background: 'rgba(12, 4, 30, 0.9)',
                      border: '1.5px solid rgba(255, 0, 127, 0.4)',
                      boxShadow: '0 0 14px rgba(255, 0, 127, 0.12)',
                      borderRadius: 7,
                      padding: '10px 14px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-display)', fontWeight: 900 }}>
                      DEFEATS
                    </div>
                    <div style={{ color: '#ff007f', fontSize: '1.6rem', fontWeight: 900, fontFamily: 'var(--font-display)', marginTop: 2, lineHeight: 1 }}>
                      {profile.losses}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'var(--font-display)', marginTop: 2 }}>
                      OF {totalGames} MATCHES
                    </div>
                  </div>

                  {/* Win Ratio */}
                  <div
                    style={{
                      background: 'rgba(12, 4, 30, 0.9)',
                      border: '1.5px solid rgba(0, 240, 255, 0.4)',
                      boxShadow: '0 0 14px rgba(0, 240, 255, 0.12)',
                      borderRadius: 7,
                      padding: '10px 14px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-display)', fontWeight: 900 }}>
                      WIN RATIO
                    </div>
                    <div style={{ color: 'var(--accent-cyan)', fontSize: '1.6rem', fontWeight: 900, fontFamily: 'var(--font-display)', marginTop: 2, lineHeight: 1 }}>
                      {winRate}%
                    </div>
                    <div style={{ width: '75%', height: 3.5, background: 'rgba(255,255,255,0.1)', margin: '5px auto 0', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${winRate}%`, height: '100%', background: 'var(--accent-cyan)', boxShadow: '0 0 6px var(--accent-cyan)' }} />
                    </div>
                  </div>

                  {/* Best Streak */}
                  <div
                    style={{
                      background: 'rgba(12, 4, 30, 0.9)',
                      border: '1.5px solid rgba(255, 230, 0, 0.4)',
                      boxShadow: '0 0 14px rgba(255, 230, 0, 0.12)',
                      borderRadius: 7,
                      padding: '10px 14px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-display)', fontWeight: 900 }}>
                      BEST STREAK
                    </div>
                    <div style={{ color: '#ffe600', fontSize: '1.6rem', fontWeight: 900, fontFamily: 'var(--font-display)', marginTop: 2, lineHeight: 1 }}>
                      {profile.bestWinStreak}
                    </div>
                    <div style={{ color: '#ffe600', fontSize: '0.65rem', fontFamily: 'var(--font-display)', marginTop: 2 }}>
                      CURRENT: <strong>{profile.winStreak}</strong>
                    </div>
                  </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════
                    3. STEAM 2-COLUMN SHOWCASE (Main Left Tabs + Sidebar Right)
                   ═══════════════════════════════════════════════════════════════ */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 2.2fr) minmax(310px, 1fr)',
                    gap: 14,
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  {/* ───────────────────────────────────────────────────────────
                      LEFT MAIN SHOWCASE (Tabbed Match History / Achievements)
                     ─────────────────────────────────────────────────────────── */}
                  <div
                    style={{
                      background: 'rgba(14, 5, 36, 0.92)',
                      border: '1.5px solid rgba(0, 240, 255, 0.28)',
                      borderRadius: 8,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 0,
                      height: '100%',
                    }}
                  >
                    {/* Tab Header Buttons */}
                    <div
                      style={{
                        padding: '8px 14px',
                        background: 'rgba(25, 8, 55, 0.95)',
                        borderBottom: '1px solid rgba(0, 240, 255, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          className="retro-btn"
                          onClick={() => {
                            retroAudio.playUiBeep(520, 0.04)
                            setMainTab('history')
                          }}
                          style={{
                            padding: '5px 14px',
                            fontSize: '0.76rem',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 900,
                            borderRadius: 4,
                            color: mainTab === 'history' ? '#ffffff' : 'var(--text-muted)',
                            background: mainTab === 'history' ? 'rgba(0, 240, 255, 0.25)' : 'transparent',
                            borderColor: mainTab === 'history' ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.15)',
                            boxShadow: mainTab === 'history' ? '0 0 10px rgba(0, 240, 255, 0.35)' : 'none',
                          }}
                        >
                          ⚔️ FLIGHT LOGS ({gamesData?.total ?? 0})
                        </button>
                        <button
                          className="retro-btn"
                          onClick={() => {
                            retroAudio.playUiBeep(520, 0.04)
                            setMainTab('achievements')
                          }}
                          style={{
                            padding: '5px 14px',
                            fontSize: '0.76rem',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 900,
                            borderRadius: 4,
                            color: mainTab === 'achievements' ? '#ffffff' : 'var(--text-muted)',
                            background: mainTab === 'achievements' ? 'rgba(255, 230, 0, 0.22)' : 'transparent',
                            borderColor: mainTab === 'achievements' ? '#ffe600' : 'rgba(255, 255, 255, 0.15)',
                            boxShadow: mainTab === 'achievements' ? '0 0 10px rgba(255, 230, 0, 0.35)' : 'none',
                          }}
                        >
                          🏆 ACHIEVEMENTS ({unlockedCount}/{totalAchievements})
                        </button>
                      </div>

                      <div style={{ fontSize: '0.72rem', color: mainTab === 'history' ? 'var(--accent-cyan)' : '#ffe600', fontFamily: 'var(--font-display)', fontWeight: 'bold' }}>
                        {mainTab === 'history'
                          ? `CYBER LUDO '84 TELEMETRY`
                          : `SYNCHRONIZED ${achievementPercent}%`}
                      </div>
                    </div>

                    {/* Tab Body (Internally Scrollable) */}
                    <div
                      style={{
                        padding: '14px 16px',
                        flex: 1,
                        overflowY: 'auto',
                        minHeight: 0,
                      }}
                    >
                      {mainTab === 'history' ? (
                        /* Match Activity Stream */
                        !gamesData || gamesData.games.length === 0 ? (
                          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem', fontFamily: 'var(--font-display)' }}>
                            NO COMBAT FLIGHT RECORDS FOUND IN PILOT ARCHIVE.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {gamesData.games.map((g) => {
                              const isWin = g.rank === 1
                              return (
                                <div
                                  key={g.gameId}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 14px',
                                    borderRadius: 6,
                                    background: isWin ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255, 0, 127, 0.06)',
                                    border: `1.5px solid ${isWin ? 'rgba(0, 255, 136, 0.38)' : 'rgba(255, 0, 127, 0.32)'}`,
                                    fontFamily: 'var(--font-display)',
                                    transition: 'all 0.18s ease',
                                  }}
                                >
                                  {/* Left: Result Tag & Info */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span
                                      style={{
                                        fontSize: '0.78rem',
                                        fontWeight: 900,
                                        padding: '3px 8px',
                                        borderRadius: 4,
                                        background: isWin ? 'rgba(0, 255, 136, 0.22)' : 'rgba(255, 0, 127, 0.22)',
                                        color: isWin ? '#00ff88' : '#ff007f',
                                        border: `1px solid ${isWin ? '#00ff88' : '#ff007f'}`,
                                        textShadow: isWin ? '0 0 8px #00ff88' : '0 0 8px #ff007f',
                                        minWidth: 90,
                                        textAlign: 'center',
                                      }}
                                    >
                                      {isWin ? '#1 VICTORY' : `RANK #${g.rank ?? '?'}`}
                                    </span>

                                    <div>
                                      <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#ffffff', letterSpacing: '0.03em' }}>
                                        {isWin ? 'MISSION ACCOMPLISHED' : 'TACTICAL DEFEAT'}
                                      </div>
                                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginTop: 2 }}>
                                        {g.participants.length} COMBATANTS • {new Date(g.startedAt).toLocaleDateString()} {new Date(g.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right: Scores & Status */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{ textAlign: 'right', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                      CAPTURED: <strong style={{ color: '#ffffff' }}>{g.piecesCaptured}</strong> • GOAL: <strong style={{ color: isWin ? '#00ff88' : '#ffffff' }}>{g.piecesInGoal}/4</strong>
                                    </div>
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                        background: isWin ? 'rgba(0, 255, 136, 0.22)' : 'rgba(255, 0, 127, 0.22)',
                                        color: isWin ? '#00ff88' : '#ff007f',
                                        fontWeight: 900,
                                        border: `1px solid ${isWin ? '#00ff88' : '#ff007f'}`,
                                      }}
                                    >
                                      {isWin ? 'WIN' : 'LOSS'}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      ) : (
                        /* Achievements Grid & Progress */
                        <div>
                          {/* Progress Bar */}
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ width: '100%', height: 7, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 4, overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${achievementPercent}%`,
                                  height: '100%',
                                  background: 'linear-gradient(90deg, var(--accent-cyan), #ffe600)',
                                  boxShadow: '0 0 12px rgba(0, 240, 255, 0.65)',
                                  transition: 'width 0.4s ease',
                                }}
                              />
                            </div>
                          </div>

                          {/* Grid */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                              gap: 10,
                            }}
                          >
                            {ACHIEVEMENTS_DEF.map((ach) => {
                              const isUnlocked = !!achievements[ach.key]
                              return (
                                <div
                                  key={ach.key}
                                  style={{
                                    padding: '10px 12px',
                                    borderRadius: 6,
                                    background: isUnlocked ? 'rgba(38, 16, 72, 0.88)' : 'rgba(10, 4, 25, 0.45)',
                                    border: isUnlocked ? '1.5px solid #ffe600' : '1px dashed rgba(255, 255, 255, 0.12)',
                                    boxShadow: isUnlocked ? '0 0 10px rgba(255, 230, 0, 0.18)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    opacity: isUnlocked ? 1 : 0.4,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: 6,
                                      background: isUnlocked ? 'rgba(255, 230, 0, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                                      border: `1.5px solid ${isUnlocked ? '#ffe600' : 'rgba(255,255,255,0.1)'}`,
                                      display: 'grid',
                                      placeItems: 'center',
                                      fontSize: '1.2rem',
                                      color: isUnlocked ? '#ffe600' : 'rgba(255, 255, 255, 0.4)',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {ach.icon}
                                  </div>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div
                                      style={{
                                        fontSize: '0.8rem',
                                        fontWeight: 900,
                                        fontFamily: 'var(--font-display)',
                                        color: isUnlocked ? '#ffffff' : 'var(--text-muted)',
                                        letterSpacing: '0.03em',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {ach.title}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: '0.66rem',
                                        fontFamily: 'var(--font-display)',
                                        color: isUnlocked ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.35)',
                                        marginTop: 2,
                                        lineHeight: 1.2,
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
                    </div>
                  </div>

                  {/* ───────────────────────────────────────────────────────────
                      RIGHT STEAM SIDEBAR (Allied Operatives + Apex Citadel)
                     ─────────────────────────────────────────────────────────── */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      minHeight: 0,
                      height: '100%',
                    }}
                  >
                    {/* Sidebar Box 1: Allied Operatives Showcase */}
                    <div
                      style={{
                        background: 'rgba(14, 5, 36, 0.92)',
                        border: '1.5px solid rgba(0, 240, 255, 0.28)',
                        borderRadius: 8,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        minHeight: 0,
                      }}
                    >
                      <div
                        style={{
                          padding: '10px 14px',
                          background: 'rgba(25, 8, 55, 0.95)',
                          borderBottom: '1px solid rgba(0, 240, 255, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ fontSize: '0.82rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#ffffff' }}>
                          ALLIED OPERATIVES ({friendsData?.length ?? 0})
                        </span>
                        <button
                          className="retro-btn"
                          onClick={() => navigate('/friends')}
                          style={{
                            padding: '2px 8px',
                            fontSize: '0.65rem',
                            fontFamily: 'var(--font-display)',
                            color: 'var(--accent-cyan)',
                            borderColor: 'rgba(0, 240, 255, 0.4)',
                            borderRadius: 3,
                          }}
                        >
                          VIEW ALL
                        </button>
                      </div>

                      <div
                        style={{
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          flex: 1,
                          overflowY: 'auto',
                          minHeight: 0,
                        }}
                      >
                        {!friendsData || friendsData.length === 0 ? (
                          <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.76rem', fontFamily: 'var(--font-display)' }}>
                            NO ALLIED OPERATIVES FOUND.
                          </div>
                        ) : (
                          friendsData.map((f) => {
                            const fTier = getRankTier(f.rating)
                            const fStatus = STATUS_STYLE[f.status] || STATUS_STYLE.offline
                            return (
                              <div
                                key={f.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 8px',
                                  borderRadius: 5,
                                  background: 'rgba(10, 3, 24, 0.7)',
                                  border: '1px solid rgba(0, 240, 255, 0.18)',
                                  cursor: 'pointer',
                                  transition: 'all 0.18s ease',
                                }}
                                onClick={() => {
                                  retroAudio.playUiBeep(640, 0.04)
                                  navigate(`/profile?u=${f.username}`)
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(0, 240, 255, 0.12)'
                                  e.currentTarget.style.borderColor = 'var(--accent-cyan)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(10, 3, 24, 0.7)'
                                  e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.18)'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                  <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <UserAvatar
                                      username={f.username}
                                      avatarStyle={f.avatarStyle}
                                      size={30}
                                      fallbackStyle={{
                                        width: 30,
                                        height: 30,
                                        borderRadius: 4,
                                        background: 'rgba(10, 2, 28, 0.9)',
                                        color: 'var(--accent-cyan)',
                                        display: 'grid',
                                        placeItems: 'center',
                                        fontWeight: 900,
                                        fontSize: '0.8rem',
                                      }}
                                    />
                                    <span
                                      style={{
                                        position: 'absolute',
                                        right: -1,
                                        bottom: -1,
                                        width: 7,
                                        height: 7,
                                        borderRadius: '50%',
                                        background: fStatus.color,
                                        border: '1.5px solid #0d0221',
                                        boxShadow: `0 0 6px ${fStatus.color}`,
                                      }}
                                    />
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontSize: '0.8rem',
                                        fontWeight: 900,
                                        color: '#ffffff',
                                        fontFamily: 'var(--font-display)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {f.username}
                                    </div>
                                    <div style={{ fontSize: '0.62rem', color: fStatus.color, fontFamily: 'var(--font-display)', fontWeight: 'bold' }}>
                                      ● {fStatus.label.toUpperCase()}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#ffffff', fontFamily: 'var(--font-display)' }}>
                                    ♛ {f.rating}
                                  </div>
                                  <div style={{ marginTop: 1 }}>
                                    <RankBadge tier={fTier} fontSize="8.5px" padding="1px 5px" />
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>

                    {/* Sidebar Box 2: Apex Combat Standing */}
                    <div
                      style={{
                        background: 'linear-gradient(180deg, rgba(26, 6, 48, 0.95), rgba(12, 2, 28, 0.98))',
                        border: `1.5px solid ${rankTier.color}`,
                        boxShadow: `0 0 16px ${rankTier.glow}`,
                        borderRadius: 8,
                        padding: '12px 16px',
                        textAlign: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', color: rankTier.color, fontFamily: 'var(--font-display)', fontWeight: 900, letterSpacing: '1px' }}>
                        APEX TIER RECOGNITION
                      </div>
                      <div style={{ margin: '6px 0' }}>
                        <RankBadge tier={rankTier} fontSize="12px" padding="3px 12px" />
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                        PEAK RATING RECORD: <strong style={{ color: peakTier.color }}>♛ {peakRating}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
