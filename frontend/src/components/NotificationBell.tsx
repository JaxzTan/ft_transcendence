import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import type { Notification } from '../hooks/useNotifications'
import { navigate } from '../router'
import { useApp } from '../store'
import type { PlayerColor } from '../game/types'
import { retroAudio } from '../utils/audio'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNotificationTypeBadge(type: string): { tag: string; color: string } {
  switch (type) {
    case 'game_invite':
      return { tag: '[MATCH_INVITE]', color: 'var(--accent-cyan, #00f0ff)' }
    case 'friend_request':
      return { tag: '[FRIEND_REQ]', color: 'var(--accent-pink, #ff007f)' }
    case 'friend_accepted':
      return { tag: '[FRIEND_ACK]', color: 'var(--accent-yellow, #ffe600)' }
    case 'achievement':
      return { tag: '[ACHIEVEMENT]', color: '#00ff88' }
    default:
      return { tag: '[SYS_MSG]', color: 'var(--accent-cyan, #00f0ff)' }
  }
}

function renderNotificationBody(n: Notification) {
  let payload: Record<string, any> = {}
  try {
    payload = typeof n?.payload === 'string' ? JSON.parse(n.payload) : (n?.payload || {})
  } catch {
    payload = {}
  }
  const from = payload?.fromUsername ? String(payload.fromUsername) : null

  switch (n?.type) {
    case 'friend_request':
      return (
        <span>
          Pilot{' '}
          <span style={{ color: 'var(--accent-yellow, #ffe600)', fontWeight: 'bold' }}>
            @{from ?? 'UNKNOWN'}
          </span>{' '}
          sent a friend link request
        </span>
      )
    case 'friend_accepted':
      return (
        <span>
          Pilot{' '}
          <span style={{ color: 'var(--accent-yellow, #ffe600)', fontWeight: 'bold' }}>
            @{from ?? 'UNKNOWN'}
          </span>{' '}
          linked to your cyber network
        </span>
      )
    case 'game_invite':
      return (
        <span>
          Pilot{' '}
          <span style={{ color: 'var(--accent-yellow, #ffe600)', fontWeight: 'bold' }}>
            @{from ?? 'UNKNOWN'}
          </span>{' '}
          issued a match challenge
        </span>
      )
    case 'achievement':
      return <span>New achievement unlocked in system database!</span>
    default:
      return <span>New incoming telemetry transmission</span>
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'JUST NOW'
  if (mins < 60) return `${mins}M AGO`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}H AGO`
  return `${Math.floor(hrs / 24)}D AGO`
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NotificationBell({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  placement = 'bottom-right',
  fullWidth = false,
  containerStyle,
  buttonStyle,
}: {
  notifications: Notification[]
  unreadCount: number
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  placement?: 'bottom-right' | 'right'
  fullWidth?: boolean
  containerStyle?: CSSProperties
  buttonStyle?: CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { setActiveMatch } = useApp()

  const list = Array.isArray(notifications) ? notifications : []
  const count = typeof unreadCount === 'number' ? unreadCount : list.filter((n) => !n?.read).length

  // Close dropdown when clicking outside.
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggleOpen = () => {
    try {
      retroAudio.playUiBeep(open ? 480 : 720, 0.05)
    } catch {}
    setOpen(!open)
  }

  const handleItemClick = (n: Notification) => {
    if (onMarkRead && n?.id) {
      onMarkRead(n.id)
    }
    try {
      retroAudio.playUiBeep(640, 0.05)
    } catch {}

    let p: Record<string, any> = {}
    try {
      p = typeof n?.payload === 'string' ? JSON.parse(n.payload) : (n?.payload || {})
    } catch {
      p = {}
    }

    if (n?.type === 'game_invite') {
      setActiveMatch({
        gameId: p.gameId as string,
        token: p.token as string,
        color: p.color as PlayerColor,
        inviteCode: p.inviteCode as string | undefined,
        mode: 'pvp',
        playerCount: 4,
      })
      if (p.gameId) {
        navigate(`/game?gameId=${p.gameId}`)
      }
      setOpen(false)
    } else if (n?.type === 'friend_request' || n?.type === 'friend_accepted') {
      navigate('/friends')
      setOpen(false)
    }
  }

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    retroAudio.playUiBeep(380, 0.06)
    if (onMarkAllRead) {
      onMarkAllRead()
    }
  }

  const isRight = placement === 'right'

  const bellContainerStyle: CSSProperties = {
    position: 'relative',
    userSelect: 'none',
    display: fullWidth ? 'flex' : 'inline-flex',
    alignItems: 'center',
    width: fullWidth ? '100%' : 'auto',
    height: fullWidth ? 44 : 38,
    ...containerStyle,
  }

  const dropdownStyle: CSSProperties = isRight
    ? {
        position: 'absolute',
        left: 'calc(100% + 14px)',
        bottom: 0,
        top: 'auto',
        right: 'auto',
        width: 350,
        maxHeight: 460,
        background: 'linear-gradient(180deg, rgba(20, 6, 46, 0.96), rgba(10, 2, 28, 0.98))',
        border: '1.5px solid var(--accent-cyan, #00f0ff)',
        boxShadow: '0 0 25px rgba(0, 240, 255, 0.25), 0 20px 60px rgba(0, 0, 0, 0.95)',
        borderRadius: 14,
        zIndex: 10005,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backdropFilter: 'blur(32px) saturate(220%)',
        opacity: open ? 1 : 0,
        transform: open ? 'translateX(0)' : 'translateX(-8px)',
        pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
      }
    : {
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 380,
        maxHeight: 460,
        background: 'rgba(10, 4, 24, 0.96)',
        border: '1.5px solid var(--accent-cyan, #00f0ff)',
        boxShadow: '0 0 25px rgba(0, 240, 255, 0.25), 0 16px 40px rgba(0, 0, 0, 0.9)',
        borderRadius: 4,
        zIndex: 120,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
        opacity: open ? 1 : 0,
        transform: open ? 'translateY(0)' : 'translateY(-8px)',
        pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
      }

  return (
    <div ref={ref} style={bellContainerStyle}>
      {/* Old-School Tactical Receiver Button */}
      {fullWidth ? (
        <button
          className={`retro-btn theme-trigger-btn ${open ? 'active' : ''}`}
          onClick={toggleOpen}
          title="Comms Telemetry & Notifications"
          style={{
            width: '100%',
            height: 44,
            justifyContent: 'space-between',
            padding: '0 14px',
            fontSize: '0.94rem',
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            color: 'var(--text-main)',
            ...buttonStyle,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-display)', letterSpacing: '1px', fontWeight: 900, fontSize: '0.94rem' }}>
              NOTIFICATIONS
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 900,
                padding: '2px 7px',
                borderRadius: 4,
                background: count > 0 ? '#ff007f' : 'rgba(255, 255, 255, 0.1)',
                color: count > 0 ? '#ffffff' : 'var(--text-muted)',
                boxShadow: count > 0 ? '0 0 8px #ff007f' : 'none',
              }}
            >
              {count > 0 ? count : '0'}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
              {open ? '▼' : '►'}
            </span>
          </div>
        </button>
      ) : (
        <button
          className={`retro-btn theme-trigger-btn ${open ? 'active' : ''}`}
          onClick={toggleOpen}
          title="Notifications"
          style={{
            justifyContent: 'center',
            gap: 8,
            height: 38,
            width: 140,
            margin: 0,
            ...buttonStyle,
          }}
        >
          {/* Retro hardware strobe LED dot */}
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: count > 0 ? 'var(--accent-pink, #ff007f)' : '#33ff88',
              boxShadow: count > 0 ? '0 0 8px #ff007f' : '0 0 6px #33ff88',
              animation: count > 0 ? 'pulse 1.2s infinite' : 'none',
              flexShrink: 0,
              display: 'inline-block',
            }}
          />

          <span className="theme-btn-text" style={{ fontSize: '0.62rem' }}>
            NOTIFICATIONS{count > 0 ? ` [${count < 10 ? `0${count}` : count}]` : ''}
          </span>
        </button>
      )}

      {/* Retro Dropdown Window Frame */}
      <div style={dropdownStyle}>
        {/* Window Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'rgba(0, 240, 255, 0.12)',
            borderBottom: '1px solid rgba(0, 240, 255, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontFamily: 'var(--font-heading, monospace)',
                fontSize: '0.78rem',
                color: 'var(--accent-cyan, #00f0ff)',
                letterSpacing: 1,
                fontWeight: 'bold',
              }}
            >
              TRANSMISSION LOG // NOTIFICATIONS
            </span>
          </div>

          {count > 0 && (
            <button
              onClick={handleClearAll}
              style={{
                background: 'transparent',
                border: '1px dashed var(--accent-yellow, #ffe600)',
                color: 'var(--accent-yellow, #ffe600)',
                fontSize: '0.62rem',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 'bold',
                padding: '3px 8px',
                cursor: 'pointer',
                borderRadius: 2,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              [ACK ALL]
            </button>
          )}
        </div>

        {/* Transmission List Buffer */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: 380,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {list.length === 0 ? (
            <div
              style={{
                padding: '36px 16px',
                textAlign: 'center',
                color: 'var(--text-muted, #8a7a64)',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.78rem',
                letterSpacing: 0.5,
              }}
            >
              [NO TRANSMISSIONS LOGGED IN BUFFER]
            </div>
          ) : (
            list.slice(0, 30).map((n) => {
              const badge = getNotificationTypeBadge(n.type)
              return (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    background: n.read ? 'transparent' : 'rgba(0, 240, 255, 0.08)',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'rgba(0, 240, 255, 0.15)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(0, 240, 255, 0.08)')
                  }
                >
                  {/* Unread diamond indicator */}
                  <span
                    style={{
                      marginTop: 3,
                      fontSize: '0.65rem',
                      color: n.read ? 'transparent' : 'var(--accent-pink, #ff007f)',
                    }}
                  >
                    ◆
                  </span>

                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          color: badge.color,
                          fontFamily: 'var(--font-mono, monospace)',
                          fontWeight: 'bold',
                        }}
                      >
                        {badge.tag}
                      </span>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          color: 'var(--text-muted, #8a7a64)',
                          fontFamily: 'var(--font-mono, monospace)',
                        }}
                      >
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: n.read ? 'normal' : 'bold',
                        color: n.read ? 'var(--text-muted, #aaa)' : '#ffffff',
                        lineHeight: 1.35,
                        fontFamily: 'var(--font-mono, monospace)',
                      }}
                    >
                      {renderNotificationBody(n)}
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
