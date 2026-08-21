import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { apiFetch } from '../api'

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'game_invite'
  | 'achievement'

export interface Notification {
  id: string
  type: NotificationType
  payload: Record<string, unknown>
  read: boolean
  createdAt: string
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const { user } = useApp()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [toasts, setToasts] = useState<Notification[]>([])
  const esRef = useRef<EventSource | null>(null)

  // ── Unread count (derived) ───────────────────────────────────────────────
  const unreadCount = notifications.filter((n) => !n.read).length

  // ── Fetch existing unread notifications on mount / login ─────────────────
  useEffect(() => {
    if (!user) {
      setNotifications([])
      setToasts([])
      return
    }

    let cancelled = false
    apiFetch('/api/notifications')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Notification[]) => {
        if (!cancelled) setNotifications(data)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [user])

  // ── SSE connection ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      esRef.current?.close()
      esRef.current = null
      return
    }

    let es: EventSource | null = null
    try {
      es = new EventSource('/api/notifications/stream')
      esRef.current = es

      es.onmessage = (event: MessageEvent) => {
        try {
          if (!event.data) return
          const notification: Notification = JSON.parse(event.data)
          if (notification && notification.id) {
            setNotifications((prev) => [notification, ...prev])
            setToasts((prev) => [notification, ...prev])
          }
        } catch {
          // ignore malformed data
        }
      }

      es.onerror = () => {
        // SSE reconnection handled automatically
      }
    } catch {
      // ignore EventSource failure
    }

    return () => {
      try {
        es?.close()
      } catch {}
      esRef.current = null
    }
  }, [user])

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Mark a single notification as read (removes from bell badge count). */
  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
    apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {})
  }, [])

  /** Mark all notifications as read. */
  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    apiFetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {})
  }, [])

  /** Dismiss a toast (remove from the transient toast queue). */
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((n) => n.id !== id))
  }, [])

  return {
    notifications,
    toasts,
    unreadCount,
    markRead,
    markAllRead,
    dismissToast,
  }
}
