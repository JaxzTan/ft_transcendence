import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Notification } from '../hooks/useNotifications'
import { btnGold, btnOutline } from '../theme'
import { useApp } from '../store'
import { navigate } from '../router'
import type { PlayerColor } from '../game/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Human-readable title for each notification type. */
function title(n: Notification): string {
  switch (n.type) {
    case 'friend_request':
      return `${n.payload.fromUsername ?? 'Someone'} sent you a friend request`
    case 'friend_accepted':
      return `${n.payload.fromUsername ?? 'Someone'} accepted your friend request`
    case 'game_invite':
      return `${n.payload.fromUsername ?? 'A friend'} invited you to a game`
    case 'achievement':
      return `Achievement unlocked!`
    default:
      return 'New notification'
  }
}



// ─── Single Toast ────────────────────────────────────────────────────────────

function Toast({
  notification,
  onDismiss,
  index,
}: {
  notification: Notification
  onDismiss: (id: string) => void
  index: number
}) {
  const { setActiveMatch } = useApp()
  const [visible, setVisible] = useState(false)

  // Slide in on mount.
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30)
    return () => clearTimeout(t)
  }, [])

  // Auto-dismiss after 8 seconds.
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(notification.id), 350) // wait for slide-out
    }, 8000)
    return () => clearTimeout(t)
  }, [notification.id, onDismiss])

  const dismiss = () => {
    setVisible(false)
    setTimeout(() => onDismiss(notification.id), 350)
  }

  // Accept a game invite — same logic as the old Shell.tsx invite handler.
  const acceptInvite = () => {
    const p = notification.payload
    setActiveMatch({
      gameId: p.gameId as string,
      token: p.token as string,
      color: p.color as PlayerColor,
      inviteCode: p.inviteCode as string | undefined,
      mode: 'pvp',
      playerCount: 4,
    })
    onDismiss(notification.id)
    navigate(`/game?gameId=${p.gameId}`)
  }

  const toastStyle: CSSProperties = {
    position: 'fixed',
    right: 24,
    bottom: 24 + index * 110, // stack toasts vertically
    zIndex: 60,
    width: 340,
    padding: 18,
    borderRadius: 16,
    background: 'linear-gradient(180deg,#241b13,#1a130d)',
    border: '1px solid #c99b45',
    boxShadow: '0 20px 44px -20px rgba(0,0,0,.85)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    // Slide-in animation
    transform: visible ? 'translateX(0)' : 'translateX(120%)',
    opacity: visible ? 1 : 0,
    transition: 'transform 0.35s cubic-bezier(.22,1,.36,1), opacity 0.35s ease',
  }

  return (
    <div style={toastStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: '#f0e2c4', lineHeight: 1.4 }}>
          {title(notification)}
        </div>
        <button
          onClick={dismiss}
          style={{
            background: 'none', border: 'none', color: '#8a7a64', cursor: 'pointer',
            fontSize: 18, padding: 0, lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Action buttons for game invites */}
      {notification.type === 'game_invite' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={acceptInvite} style={{ ...btnGold, flex: 1, padding: '10px 14px', fontSize: 13 }}>
            Accept
          </button>
          <button onClick={dismiss} style={{ ...btnOutline, flex: 1, padding: '10px 14px', fontSize: 13 }}>
            Decline
          </button>
        </div>
      )}

      {/* Action buttons for friend requests */}
      {notification.type === 'friend_request' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { navigate('/friends'); dismiss() }}
            style={{ ...btnGold, flex: 1, padding: '10px 14px', fontSize: 13 }}
          >
            View
          </button>
          <button onClick={dismiss} style={{ ...btnOutline, flex: 1, padding: '10px 14px', fontSize: 13 }}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Toast Container ─────────────────────────────────────────────────────────

export function NotificationToasts({
  toasts,
  onDismiss,
}: {
  toasts: Notification[]
  onDismiss: (id: string) => void
}) {
  // Show at most 3 toasts at once — oldest ones get pushed off.
  const visible = toasts.slice(0, 3)

  return (
    <>
      {visible.map((n, i) => (
        <Toast key={n.id} notification={n} onDismiss={onDismiss} index={i} />
      ))}
    </>
  )
}
