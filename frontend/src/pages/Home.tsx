import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { navigate } from '../router'
import { useApp } from '../store'
import { avatarDim, btnGold, btnOutline, card } from '../theme'

type LadderEntry = { username: string; rating: number }

export function Home() {
  const { t } = useTranslation()
  const { user } = useApp()
  const [ladder, setLadder] = useState<LadderEntry[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/leaderboard?mode=global&limit=4', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ entries: LadderEntry[] }>) : Promise.reject(r.status)))
      .then((body) => {
        if (!cancelled) setLadder(body.entries)
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) setLadder([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="home-page" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        className="home-hero"
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 24,
          padding: '36px 40px',
          border: '1px solid rgba(167,139,250,0.3)',
          background: 'radial-gradient(120% 140% at 10% 0%, rgba(167,139,250,0.2) 0%, rgba(244,114,182,0.22) 45%, rgba(20,14,35,0.95) 100%)',
          boxShadow: '0 24px 60px -15px rgba(167,139,250,0.18), 0 0 30px rgba(244,114,182,0.12)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(167, 139, 250, 0.15) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            opacity: 0.6,
          }}
        />
        <div style={{ position: 'relative', maxWidth: 580, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, letterSpacing: '.2em', textTransform: 'uppercase', color: '#a78bfa', fontWeight: 800, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
            {t('home.greeting', { name: user?.username ?? t('common.you') })}
          </div>
          <div className="home-hero-title" style={{ fontFamily: "'Space Grotesk', 'Outfit', sans-serif", fontWeight: 900, fontSize: 40, lineHeight: 1.08, color: '#f8f0ff', letterSpacing: -0.5 }}>
            {t('home.readyToRoll')}
          </div>
          <div style={{ color: '#d4c8e8', fontSize: '15.5px', lineHeight: 1.5, maxWidth: 480 }}>
            {t('home.heroDesc')}
          </div>
          <div className="home-hero-actions" style={{ display: 'flex', gap: 14, marginTop: 6 }}>
            <button onClick={() => navigate('/lobby')} style={{ ...btnGold, padding: '13px 26px' }}>
              {t('home.createTable')}
            </button>
            <button
              onClick={() => navigate('/game')}
              style={{
                ...btnOutline,
                padding: '13px 26px',
              }}
            >
              {t('home.resumeGame')}
            </button>
          </div>
        </div>
      </div>

      <div className="home-ladder" style={{ ...card, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="home-ladder-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: '#f8f0ff', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{t('home.topLadder')}</div>
          <a onClick={() => navigate('/leaderboard')} style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: '#a78bfa' }}>
            {t('home.viewAll')} →
          </a>
        </div>
        {ladder === null ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#b8a9d4', fontSize: '14px' }}>
            {t('common.loading')}
          </div>
        ) : ladder.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#b8a9d4', fontSize: '14px' }}>
            {t('leaderboard.noRankedPlayers')}
          </div>
        ) : (
          ladder.map((l, i) => (
            <div
              key={l.username}
              className="home-ladder-row"
              style={{ display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '11px 8px' }}
            >
              <div style={{ width: 26, textAlign: 'center', fontWeight: 900, color: i === 0 ? '#ffd66b' : i === 1 ? '#b8a9d4' : i === 2 ? '#ff6b8a' : '#b8a9d4', fontSize: 14, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
                {i + 1}
              </div>
              <div style={avatarDim(34)}>{l.username.slice(0, 2).toUpperCase()}</div>
              <div style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: '#f8f0ff', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{l.username}</div>
              <div style={{ color: '#ffd66b', fontWeight: 800, fontSize: 14.5, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>♛ {l.rating}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
