import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import type { Notification } from '../hooks/useNotifications'
import { navigate } from '../router'
import { useApp } from '../store'
import type { PlayerColor } from '../game/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function glyph(type: string): string {
  switch (type) {
    case 'friend_request': return '👤'
    case 'friend_accepted': return '🤝'
    case 'game_invite': return '🎲'
    case 'achievement': return '🏆'
    default: return '🔔'
  }
}

function label(n: Notification): string {
  switch (n.type) {
    case 'friend_request':
      return `${n.payload.fromUsername ?? 'Someone'} sent a friend request`
    case 'friend_accepted':
      return `${n.payload.fromUsername ?? 'Someone'} is now your friend`
    case 'game_invite':
      return `${n.payload.fromUsername ?? 'A friend'} invited you to play`
    case 'achievement':
      return 'Achievement unlocked!'
    default:
      return 'New notification'
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NotificationBell({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: Notification[]
  unreadCount: number
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { setActiveMatch } = useApp()

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

  const bellStyle: CSSProperties = {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 10,
    background: open ? '#2b2118' : 'transparent',
    border: `1px solid ${open ? '#4a3826' : 'transparent'}`,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    fontSize: 20,
    color: '#e8dcc6',
    transition: 'background 0.2s, border-color 0.2s',
  }

  const badgeStyle: CSSProperties = {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    background: '#e4574d',
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    display: 'grid',
    placeItems: 'center',
    padding: '0 5px',
    animation: 'bell-bounce 0.4s ease',
  }

  const dropdownStyle: CSSProperties = {
    position: 'absolute',
    top: 50,
    right: 0,
    width: 360,
    maxHeight: 420,
    overflowY: 'auto',
    borderRadius: 14,
    background: 'linear-gradient(180deg,#241b13,#1a130d)',
    border: '1px solid #3a2c1d',
    boxShadow: '0 24px 56px -24px rgba(0,0,0,.9)',
    zIndex: 100,
    // Animate in
    opacity: open ? 1 : 0,
    transform: open ? 'translateY(0)' : 'translateY(-8px)',
    pointerEvents: open ? 'auto' : 'none',
    transition: 'opacity 0.2s ease, transform 0.2s ease',
  }

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px 10px',
    borderBottom: '1px solid #2e2115',
  }

  const handleItemClick = (n: Notification) => {
    onMarkRead(n.id)

    if (n.type === 'game_invite') {
      const p = n.payload
      setActiveMatch({
        gameId: p.gameId as string,
        token: p.token as string,
        color: p.color as PlayerColor,
        inviteCode: p.inviteCode as string | undefined,
      })
      navigate(`/game?gameId=${p.gameId}`)
      setOpen(false)
    } else if (n.type === 'friend_request' || n.type === 'friend_accepted') {
      navigate('/friends')
      setOpen(false)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <div style={bellStyle} onClick={() => setOpen(!open)}>
        🔔
        {unreadCount > 0 && (
          <div key={unreadCount} style={badgeStyle}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </div>

      {/* Dropdown */}
      <div style={dropdownStyle}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#f0e2c4' }}>
            Notifications
          </span>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#c99b45', fontSize: 12, fontWeight: 700,
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6b6255', fontSize: 14 }}>
            No notifications yet
          </div>
        ) : (
          notifications.slice(0, 30).map((n) => (
            <div
              key={n.id}
              onClick={() => handleItemClick(n)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #2e2115',
                background: n.read ? 'transparent' : 'rgba(201,155,69,.06)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(201,155,69,.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(201,155,69,.06)')}
            >
              <span style={{ fontSize: 20, flex: 'none' }}>{glyph(n.type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: n.read ? 500 : 700,
                  color: n.read ? '#a99a83' : '#f0e2c4',
                  lineHeight: 1.35,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {label(n)}
                </div>
                <div style={{ fontSize: 11, color: '#6b6255', marginTop: 2 }}>
                  {timeAgo(n.createdAt)}
                </div>
              </div>
              {!n.read && (
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flex: 'none',
                  background: '#c99b45',
                }} />
              )}
            </div>
          ))
        )}
      </div>

      {/* Inject keyframes for badge bounce */}
      <style>{`
        @keyframes bell-bounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
