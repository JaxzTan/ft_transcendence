import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RetroNavbar } from '../components/RetroNavbar'
import { UserAvatar } from '../components/UserAvatar'
import { navigate } from '../router'
import { useApp } from '../store'
import { retroAudio } from '../utils/audio'
import { getRankTier } from '../utils/ranks'
import { RankBadge } from '../components/RankBadge'
import '../styles/retrowave.css'

type LeaderboardEntry = {
  rank: number
  username: string
  rating: number
  gamesPlayed: number
  wins: number
  losses: number
  winRate: number
  avatarStyle?: any
}

type LeaderboardResponse = {
  entries: LeaderboardEntry[]
  total: number
  page: number
  limit: number
  myRank?: { rank: number; username: string; rating: number } | null
}

export function Leaderboard() {
  const { t } = useTranslation()
  const { user } = useApp()

  // ------------------------------------------------------------------------
  // CRT CONTROLS
  // ------------------------------------------------------------------------
  const [crtEnabled, setCrtEnabled] = useState(true)

  useEffect(() => {
    const savedTheme = localStorage.getItem('retro_theme') || 'synthwave'
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

  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/leaderboard?mode=global&limit=50', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<LeaderboardResponse>) : Promise.reject(r.status)))
      .then((body) => {
        if (!cancelled) setData(body)
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const top1 = data?.entries?.find((e) => e.rank === 1)
  const top2 = data?.entries?.find((e) => e.rank === 2)
  const top3 = data?.entries?.find((e) => e.rank === 3)

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

        {/* Global Floating Navigation Dock (Left Side, Centered along Y Axis) */}
        <RetroNavbar
          activeRoute="/leaderboard"
          crtEnabled={crtEnabled}
          toggleCrt={toggleCrt}
        />

        {/* Main Content Wrapper (Fixed full viewport, positioned beside the left dock) */}
        <div
          className="app-wrapper"
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >

          {/* Hero Title (Clean, original font & color, taller Y-axis) */}
          <header className="hero-section" style={{ padding: '16px 0 18px', marginBottom: 12, flexShrink: 0 }}>
            <h1 className="hero-title" style={{ fontSize: '1.45rem', margin: 0, letterSpacing: '1.5px' }}>
              {t('leaderboard.globalRankingHero')}
            </h1>
          </header>

          {/* Unified Leaderboard Window Container (Slightly shorter in Y-axis to balance page) */}
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
                <span>{t('leaderboard.leaderboardHeader', { count: data?.total ?? 0 })}</span>
              </div>
              <div className="window-controls" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="window-btn min" />
                <span className="window-btn max" />
              </div>
            </div>

            <div
              className="window-body"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: '12px 16px',
                flex: 1,
                overflow: 'hidden',
                minHeight: 0,
              }}
            >
              {/* Inside-Window Podium Showcase (Fixed above the scrollable table) */}
              {data && data.entries.length > 0 && (
                <div
                  className="retro-window"
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      data.entries.length === 1
                        ? 'minmax(280px, 460px)'
                        : data.entries.length === 2
                          ? 'repeat(auto-fit, minmax(280px, 420px))'
                          : 'repeat(auto-fit, minmax(280px, 1fr))',
                    justifyContent: 'center',
                    gap: 18,
                    alignItems: 'end',
                    padding: '18px 20px',
                    borderRadius: 10,
                    background: 'var(--bg-card)',
                    border: 'var(--card-border-style)',
                    boxShadow: 'var(--box-shadow)',
                    flexShrink: 0,
                  }}
                >
                  {/* Rank #2 Podium Card */}
                  {top2 && (() => {
                    const tier2 = getRankTier(top2.rating, 2)
                    return (
                      <div
                        style={{
                          background: 'var(--bg-secondary)',
                          border: 'var(--card-border-style)',
                          borderRadius: 8,
                          boxShadow: '0 0 18px rgba(0, 240, 255, 0.22)',
                          padding: '20px 22px',
                          cursor: 'pointer',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                        onClick={() => {
                          retroAudio.playUiBeep(600, 0.05)
                          navigate(`/profile?u=${top2.username}`)
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <span style={{ fontSize: '1.35rem', fontFamily: 'var(--font-display)', fontWeight: 900, color: 'var(--accent-cyan)' }}>#2</span>
                          <RankBadge tier={tier2} fontSize="12px" padding="4px 10px" />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <UserAvatar
                            username={top2.username}
                            size={52}
                            fallbackStyle={{
                              width: 52,
                              height: 52,
                              borderRadius: 8,
                              background: 'rgba(10, 2, 28, 0.9)',
                              color: 'var(--accent-cyan)',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 'bold',
                              fontSize: '1.05rem',
                            }}
                          />
                          <div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                              {top2.username}
                            </div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ffffff', fontFamily: 'var(--font-display)', letterSpacing: '0.04em', marginTop: 2 }}>
                              ♛ {top2.rating}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: 16,
                            paddingTop: 12,
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-display)',
                            letterSpacing: '0.03em',
                          }}
                        >
                          <span>{t('leaderboard.matchesLabel')} <strong style={{ color: '#ffffff' }}>{top2.gamesPlayed}</strong></span>
                          <span>{t('leaderboard.winRateLabel')} <strong style={{ color: '#ffffff' }}>{top2.winRate}%</strong></span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Rank #1 Apex Champion Citadel Card */}
                  {top1 && (() => {
                    const tier1 = getRankTier(top1.rating, 1)
                    return (
                      <div
                        className="apex-champion-floating-card"
                        style={{
                          background: 'linear-gradient(180deg, rgba(48, 12, 38, 0.95), rgba(20, 5, 28, 0.98))',
                          border: '2px solid #ff1744',
                          borderRadius: 8,
                          padding: '24px 26px',
                          cursor: 'pointer',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                        onClick={() => {
                          retroAudio.playUiBeep(750, 0.05)
                          navigate(`/profile?u=${top1.username}`)
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', fontWeight: 900, color: '#ffe600', textShadow: '0 0 10px rgba(255, 230, 0, 0.6)' }}>#1</span>
                            <span style={{ fontSize: '0.72rem', color: '#ffe600', fontFamily: 'var(--font-display)', fontWeight: 900, letterSpacing: '0.5px' }}>
                              {t('leaderboard.apexChampion')}
                            </span>
                          </div>
                          <RankBadge tier={tier1} fontSize="13px" padding="4px 12px" />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div
                            style={{
                              padding: 2.5,
                              borderRadius: 8,
                              background: 'linear-gradient(135deg, #ff1744, #ffe600)',
                              boxShadow: '0 0 16px rgba(255, 23, 68, 0.55)',
                            }}
                          >
                            <UserAvatar
                              username={top1.username}
                              size={62}
                              fallbackStyle={{
                                width: 62,
                                height: 62,
                                borderRadius: 6,
                                background: 'rgba(10, 2, 28, 0.95)',
                                color: '#ffe600',
                                display: 'grid',
                                placeItems: 'center',
                                fontWeight: 'bold',
                                fontSize: '1.4rem',
                              }}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#ffffff', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                              {top1.username}
                            </div>
                            <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#ffffff', fontFamily: 'var(--font-display)', letterSpacing: '0.04em', marginTop: 2 }}>
                              ♛ {top1.rating}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: 18,
                            paddingTop: 12,
                            borderTop: '1px solid rgba(255, 23, 68, 0.3)',
                            fontSize: '0.8rem',
                            color: '#ffcad4',
                            fontFamily: 'var(--font-display)',
                            letterSpacing: '0.03em',
                          }}
                        >
                          <span>{t('leaderboard.matchesLabel')} <strong style={{ color: '#ffffff', fontSize: '0.88rem' }}>{top1.gamesPlayed}</strong></span>
                          <span>{t('leaderboard.winRateLabel')} <strong style={{ color: '#00ff88', fontSize: '0.88rem' }}>{top1.winRate}%</strong></span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Rank #3 Podium Card */}
                  {top3 && (() => {
                    const tier3 = getRankTier(top3.rating, 3)
                    return (
                      <div
                        style={{
                          background: 'var(--bg-secondary)',
                          border: 'var(--card-border-style)',
                          borderRadius: 8,
                          boxShadow: '0 0 18px rgba(255, 0, 127, 0.22)',
                          padding: '20px 22px',
                          cursor: 'pointer',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                        onClick={() => {
                          retroAudio.playUiBeep(600, 0.05)
                          navigate(`/profile?u=${top3.username}`)
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <span style={{ fontSize: '1.35rem', fontFamily: 'var(--font-display)', fontWeight: 900, color: 'var(--accent-pink)' }}>#3</span>
                          <RankBadge tier={tier3} fontSize="12px" padding="4px 10px" />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <UserAvatar
                            username={top3.username}
                            size={52}
                            fallbackStyle={{
                              width: 52,
                              height: 52,
                              borderRadius: 8,
                              background: 'rgba(10, 2, 28, 0.9)',
                              color: 'var(--accent-pink)',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 'bold',
                              fontSize: '1.05rem',
                            }}
                          />
                          <div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                              {top3.username}
                            </div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ffffff', fontFamily: 'var(--font-display)', letterSpacing: '0.04em', marginTop: 2 }}>
                              ♛ {top3.rating}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: 16,
                            paddingTop: 12,
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-display)',
                            letterSpacing: '0.03em',
                          }}
                        >
                          <span>{t('leaderboard.matchesLabel')} <strong style={{ color: '#ffffff' }}>{top3.gamesPlayed}</strong></span>
                          <span>{t('leaderboard.winRateLabel')} <strong style={{ color: '#ffffff' }}>{top3.winRate}%</strong></span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Ladder Table Container (ONLY THIS SECTION SCROLLS) */}
              <div
                className="retro-window"
                style={{
                  border: 'var(--card-border-style)',
                  borderRadius: 6,
                  background: 'var(--bg-card)',
                  overflow: 'hidden',
                  boxShadow: 'var(--box-shadow)',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                }}
              >
                {/* Fixed Sticky Table Header */}
                <div
                  className="window-header"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '270px 1.4fr 170px 170px 150px',
                    gap: 20,
                    padding: '14px 28px',
                    fontSize: '0.82rem',
                    fontWeight: 900,
                    color: 'var(--text-main)',
                    fontFamily: 'var(--font-display)',
                    textTransform: 'uppercase',
                    letterSpacing: '1.2px',
                    flexShrink: 0,
                    zIndex: 3,
                  }}
                >
                  <div>{t('leaderboard.colRankTier')}</div>
                  <div>{t('leaderboard.colPlayer')}</div>
                  <div>{t('leaderboard.colRating')}</div>
                  <div>{t('leaderboard.colMatches')}</div>
                  <div style={{ textAlign: 'right' }}>{t('leaderboard.colWinRate')}</div>
                </div>

                {/* Scrollable Table Rows */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    minHeight: 0,
                  }}
                >
                  {loading ? (
                    <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--accent-yellow)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                      {t('leaderboard.accessingTelemetry')}
                    </div>
                  ) : !data || data.entries.length === 0 ? (
                    <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                      {t('leaderboard.noRecords')}
                    </div>
                  ) : (
                    data.entries.map((entry) => {
                      const isYou = entry.username === user?.username
                      const isRankOne = entry.rank === 1
                      const isTopThree = entry.rank <= 3
                      const tier = getRankTier(entry.rating, entry.rank)
                      const rankMedal = `#${entry.rank}`

                      return (
                        <div
                          key={entry.rank}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '270px 1.4fr 170px 170px 150px',
                            gap: 20,
                            padding: isRankOne ? '20px 28px' : isTopThree ? '16px 28px' : '14px 28px',
                            borderBottom: isRankOne
                              ? '2.5px solid rgba(255, 23, 68, 0.6)'
                              : '1px solid rgba(255, 255, 255, 0.08)',
                            alignItems: 'center',
                            background: isRankOne
                              ? isYou
                                ? 'linear-gradient(90deg, rgba(255, 0, 127, 0.3), rgba(255, 23, 68, 0.2))'
                                : 'linear-gradient(90deg, rgba(255, 23, 68, 0.18), rgba(255, 215, 0, 0.08))'
                              : isYou
                                ? 'rgba(255, 0, 127, 0.18)'
                                : 'transparent',
                            boxShadow: isRankOne
                              ? '0 0 22px rgba(255, 23, 68, 0.25)'
                              : isYou
                                ? 'inset 0 0 15px rgba(255, 0, 127, 0.15)'
                                : 'none',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            retroAudio.playUiBeep(640, 0.04)
                            navigate(`/profile?u=${entry.username}`)
                          }}
                          onMouseEnter={(e) => {
                            if (!isYou && !isRankOne) e.currentTarget.style.background = 'rgba(0, 240, 255, 0.1)'
                          }}
                          onMouseLeave={(e) => {
                            if (!isYou && !isRankOne) e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          {/* Rank Badge Column */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: isRankOne ? 14 : 12 }}>
                            <span
                              style={{
                                fontWeight: 900,
                                fontSize: isRankOne ? '1.8rem' : entry.rank <= 3 ? '1.35rem' : '1rem',
                                color: '#ffffff',
                                fontFamily: 'var(--font-display)',
                                letterSpacing: '0.03em',
                                minWidth: isRankOne ? 44 : 36,
                                textAlign: 'center',
                              }}
                            >
                              {rankMedal}
                            </span>
                            <RankBadge
                              tier={tier}
                              fontSize={isRankOne ? '13px' : '11.5px'}
                              padding={isRankOne ? '5px 12px' : '4px 10px'}
                            />
                          </div>

                          {/* Pilot Info */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: isRankOne ? 16 : 14 }}>
                            <UserAvatar
                              username={entry.username}
                              size={isRankOne ? 50 : isTopThree ? 40 : 36}
                              fallbackStyle={{
                                width: isRankOne ? 50 : isTopThree ? 40 : 36,
                                height: isRankOne ? 50 : isTopThree ? 40 : 36,
                                borderRadius: 6,
                                background: 'rgba(10, 2, 28, 0.9)',
                                color: 'var(--accent-cyan)',
                                display: 'grid',
                                placeItems: 'center',
                                fontWeight: 'bold',
                                fontSize: isRankOne ? '1.1rem' : '0.85rem',
                              }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: isRankOne ? 900 : 700,
                                  fontSize: isRankOne ? '1.15rem' : isTopThree ? '1.02rem' : '0.95rem',
                                  color: '#ffffff',
                                  fontFamily: 'var(--font-display)',
                                  letterSpacing: '0.04em',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {entry.username} {isYou && <span style={{ color: 'var(--accent-pink)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>{t('leaderboard.youBadge')}</span>}
                              </div>
                            </div>
                          </div>

                          {/* Rating */}
                          <div
                            style={{
                              fontWeight: 900,
                              fontSize: isRankOne ? '1.45rem' : isTopThree ? '1.2rem' : '1.05rem',
                              color: '#ffffff',
                              fontFamily: 'var(--font-display)',
                              letterSpacing: '0.04em',
                            }}
                          >
                            ♛ {entry.rating}
                          </div>

                          {/* Games Played */}
                          <div style={{ color: '#ffffff', fontSize: isRankOne ? '0.98rem' : '0.88rem', fontFamily: 'var(--font-display)', letterSpacing: '0.03em' }}>
                            {t('leaderboard.matchesCount', { count: entry.gamesPlayed })}
                          </div>

                          {/* Win Rate */}
                          <div
                            style={{
                              textAlign: 'right',
                              fontWeight: 900,
                              fontSize: isRankOne ? '1.15rem' : '0.98rem',
                              color: '#ffffff',
                              fontFamily: 'var(--font-display)',
                              letterSpacing: '0.03em',
                            }}
                          >
                            {entry.winRate}%
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
