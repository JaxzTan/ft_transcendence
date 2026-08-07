import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { navigate } from '../router'
import { useApp } from '../store'
import { avatarDim, btnGold, card } from '../theme'

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
    <div className="home-page" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <div
        className="home-hero"
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 20,
          border: '1px solid #2e4a38',
          background: 'radial-gradient(120% 140% at 12% 0%,#22432f,#12261a 70%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'repeating-linear-gradient(45deg,rgba(0,0,0,.10) 0 3px,transparent 3px 11px)',
            opacity: 0.5,
          }}
        />
        <div style={{ position: 'relative', maxWidth: 560 }}>
          <div style={{ fontSize: 13, letterSpacing: '.2em', textTransform: 'uppercase', color: '#7fae91', fontWeight: 700 }}>
            {t('home.greeting', { name: user?.username ?? t('common.you') })}
          </div>
          <div className="home-hero-title" style={{ fontFamily: "'Cinzel',serif", fontSize: 34, lineHeight: 1.05, color: '#f4e9cf' }}>
            {t('home.readyToRoll')}
          </div>
          <div style={{ color: '#c9bda3', fontSize: '15.5px', lineHeight: 1.5, maxWidth: 460 }}>
            {t('home.heroDesc')}
          </div>
          <div className="home-hero-actions" style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => navigate('/lobby')} style={{ ...btnGold, padding: '13px 22px' }}>
              {t('home.createTable')}
            </button>
            <button
              onClick={() => navigate('/game')}
              style={{
                border: '1px solid #4a5f4a',
                borderRadius: 12,
                padding: '13px 22px',
                font: "700 15px 'Hanken Grotesk'",
                color: '#e8f0e0',
                cursor: 'pointer',
                background: 'rgba(255,255,255,.04)',
              }}
            >
              {t('home.resumeGame')}
            </button>
          </div>
        </div>
      </div>

      <div className="home-ladder" style={{ ...card }}>
        <div className="home-ladder-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#f0e2c4' }}>{t('home.topLadder')}</div>
          <a onClick={() => navigate('/leaderboard')} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            {t('home.viewAll')}
          </a>
        </div>
        {ladder === null ? (
          <div style={{ padding: '16px 0', textAlign: 'center', color: '#a99a83', fontSize: '13.5px' }}>
            {t('common.loading')}
          </div>
        ) : ladder.length === 0 ? (
          <div style={{ padding: '16px 0', textAlign: 'center', color: '#a99a83', fontSize: '13.5px' }}>
            {t('leaderboard.noRankedPlayers')}
          </div>
        ) : (
          ladder.map((l, i) => (
            <div
              key={l.username}
              className="home-ladder-row"
              style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #2a2015' }}
            >
              <div style={{ width: 22, textAlign: 'center', fontWeight: 800, color: '#a99a83', fontSize: 14 }}>{i + 1}</div>
              <div style={avatarDim(32)}>{l.username.slice(0, 2).toUpperCase()}</div>
              <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{l.username}</div>
              <div style={{ color: '#f0c24e', fontWeight: 800, fontSize: 14 }}>♛ {l.rating}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
