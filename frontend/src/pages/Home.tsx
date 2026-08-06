import { useTranslation } from 'react-i18next'
import { LEADERS, MODE_CARDS } from '../data'
import { navigate } from '../router'
import { useApp } from '../store'
import { avatarDim, btnGold, card } from '../theme'

/** Maps each MODE_CARDS entry (matched by its English title) to its locale keys. */
const MODE_CARD_KEYS: Record<string, { title: string; desc: string }> = {
  'Vs Bots': { title: 'home.vsBotsTitle', desc: 'home.vsBotsDesc' },
  'Multiplayer': { title: 'home.multiplayerTitle', desc: 'home.multiplayerDesc' },
  'Hotseat': { title: 'home.hotseatTitle', desc: 'home.hotseatDesc' },
  'Private Table': { title: 'home.privateTableTitle', desc: 'home.privateTableDesc' },
}

export function Home() {
  const { t } = useTranslation()
  const { user, setPlayerCount } = useApp()

  const goLobby = (m: typeof MODE_CARDS[number]) => {
    setPlayerCount(m.playerCount as 2 | 3 | 4)
    if (m.title === 'Multiplayer') {
      navigate('/multiplayer-lobby')
      return
    }
    navigate(`/lobby?mode=${m.playerCount}&bots=${m.allowAddPlayers ? '1' : '0'}`)
  }

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {MODE_CARDS.map((m) => {
          const keys = MODE_CARD_KEYS[m.title]
          return (
            <div
              key={m.title}
              className="mode-card"
              onClick={() => goLobby(m)}
              style={{
                cursor: 'pointer',
                borderRadius: 16,
                background: 'linear-gradient(180deg,#241b13,#1a130d)',
                border: '1px solid #3a2c1d',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.045),0 20px 44px -24px rgba(0,0,0,.85)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform .12s,border-color .12s',
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 22,
                  color: m.hue,
                  background: 'rgba(255,255,255,.04)',
                  border: `1px solid ${m.hue}44`,
                }}
              >
                {m.glyph}
              </div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#f0e2c4' }}>{keys ? t(keys.title) : m.title}</div>
              <div style={{ color: '#a99a83', fontSize: 13, lineHeight: 1.4 }}>{keys ? t(keys.desc) : m.desc}</div>
            </div>
          )
        })}
      </div>

      <div className="home-ladder" style={{ ...card }}>
        <div className="home-ladder-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#f0e2c4' }}>{t('home.topLadder')}</div>
          <a onClick={() => navigate('/leaderboard')} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            {t('home.viewAll')}
          </a>
        </div>
        {LEADERS.slice(0, 4).map((l, i) => (
          <div
            key={l.name}
            className="home-ladder-row"
            style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #2a2015' }}
          >
            <div style={{ width: 22, textAlign: 'center', fontWeight: 800, color: '#a99a83', fontSize: 14 }}>{i + 1}</div>
            <div style={avatarDim(32)}>{l.name.slice(0, 2).toUpperCase()}</div>
            <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{l.name}</div>
            <div style={{ color: '#f0c24e', fontWeight: 800, fontSize: 14 }}>♛ {l.rating}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
