import { SETTING_GROUPS } from '../data'
import { navigate } from '../router'
import { useApp } from '../store'
import { card, sectionLabel } from '../theme'

export function Settings() {
  const { settingOn, toggleSetting } = useApp()

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {SETTING_GROUPS.map((g, gi) => (
        <div key={g.title} style={{ ...card, padding: '8px 22px' }}>
          <div style={{ ...sectionLabel, padding: '16px 0 6px' }}>{g.title}</div>
          {g.rows.map((row, ri) => {
            const key = `${gi}-${ri}`
            const on = settingOn(key)
            return (
              <div
                key={row.label}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid #2a2015' }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14.5px', color: '#f0e2c4' }}>{row.label}</div>
                  <div style={{ color: '#a99a83', fontSize: '12.5px' }}>{row.desc}</div>
                </div>
                <div
                  onClick={() => toggleSetting(key)}
                  style={{
                    cursor: 'pointer',
                    minWidth: 58,
                    textAlign: 'center',
                    padding: '7px 0',
                    borderRadius: 999,
                    fontWeight: 800,
                    fontSize: '12.5px',
                    color: on ? '#0d1b12' : '#a99a83',
                    background: on ? 'linear-gradient(180deg,#5fd08a,#2c8a53)' : '#20180f',
                    border: '1px solid ' + (on ? '#2c8a53' : '#4a3826'),
                  }}
                >
                  {on ? 'On' : 'Off'}
                </div>
              </div>
            )
          })}
        </div>
      ))}
      <button
        onClick={() => navigate('/login')}
        style={{
          alignSelf: 'flex-start',
          border: '1px solid #6a2a24',
          borderRadius: 11,
          padding: '12px 22px',
          font: "700 14px 'Hanken Grotesk'",
          color: '#e8918a',
          cursor: 'pointer',
          background: 'rgba(120,40,34,.14)',
        }}
      >
        Sign out
      </button>
    </div>
  )
}
