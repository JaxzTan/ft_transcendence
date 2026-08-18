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
  // Opens an EventSource to /api/notifications/stream when the user is logged
  // in. The backend holds this HTTP connection open and pushes JSON events
  // whenever a notification is published for this user.
  //
  // EventSource handles reconnection automatically (the browser retries on
  // network failures with exponential backoff). We close it on logout or
  // unmount.
  useEffect(() => {
    if (!user) {
      // Close any lingering connection on logout.
      esRef.current?.close()
      esRef.current = null
      return
    }

    const es = new EventSource('/api/notifications/stream', {
      // EventSource doesn't support custom headers, but our JWT is in an
      // httpOnly cookie so the browser sends it automatically.
    })
    esRef.current = es

    es.onmessage = (event: MessageEvent) => {
      try {
        const notification: Notification = JSON.parse(event.data)

        // Add to the persistent list (bell dropdown).
        setNotifications((prev) => [notification, ...prev])

        // Add to the transient toast queue (auto-dismissed after 8s).
        setToasts((prev) => [notification, ...prev])
      } catch {
        console.error('Failed to parse SSE notification:', event.data)
      }
    }

    es.onerror = () => {
      // EventSource auto-reconnects — nothing to do here.
      // Logging is optional; commented out to avoid noise.
      // console.warn('SSE connection error, will auto-reconnect')
    }

    return () => {
      es.close()
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
