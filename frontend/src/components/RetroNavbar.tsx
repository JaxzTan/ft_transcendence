import React, { useEffect, useRef, useState } from 'react'
import { navigate, useRoute } from '../router'
import { retroAudio } from '../utils/audio'
import { NotificationBell } from './NotificationBell'
import type { InAppNotification } from '../hooks/useNotifications'

type ThemeType = 'synthwave' | 'win95' | 'terminal'

interface RetroNavbarProps {
  activeRoute?: string
  crtEnabled?: boolean
  toggleCrt?: () => void
  notifications?: InAppNotification[]
  unreadCount?: number
  onMarkRead?: (id: string) => void
  onMarkAllRead?: () => void
  style?: React.CSSProperties
}

const NAV_ITEMS = [
  { path: '/gamelobby', label: 'LOBBY', icon: '>_' },
  { path: '/game', label: 'GAME', icon: '{}' },
  { path: '/leaderboard', label: 'LADDER', icon: '♛' },
  { path: '/dashboard', label: 'DASHBOARD', icon: '▦' },
  { path: '/friends', label: 'FRIENDS', icon: '♟' },
  { path: '/profile', label: 'PROFILE', icon: '@/' },
]

export function RetroNavbar({
  activeRoute,
  crtEnabled,
  toggleCrt,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  style,
}: RetroNavbarProps) {
  const route = useRoute()
  const currentPath = activeRoute || route.path

  const [theme, setTheme] = useState<ThemeType>('synthwave')
  const [isThemePopoverOpen, setIsThemePopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const applyTheme = (newTheme: ThemeType) => {
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    document.body.setAttribute('data-theme', newTheme)
    localStorage.setItem('retro_theme', newTheme)
    retroAudio.playUiBeep(880, 0.05)
  }

  useEffect(() => {
    const savedTheme = (localStorage.getItem('retro_theme') as ThemeType) || 'synthwave'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)
    document.body.setAttribute('data-theme', savedTheme)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsThemePopoverOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <nav className="navbar" id="mainNav" style={{ marginBottom: 12, ...style }}>
      {/* Brand / Logo (Pressable to return Hub) */}
      <div className="brand" style={{ display: 'flex', alignItems: 'center' }}>
        <button
          className="brand-42-logo"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '2px 4px',
            transition: 'all 0.2s ease',
          }}
          onClick={() => {
            retroAudio.playUiBeep(440, 0.05)
            navigate('/home')
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)'
            e.currentTarget.style.filter = 'drop-shadow(0 0 10px var(--accent-cyan))'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.filter = 'none'
          }}
          title="42 Transcendence Hub (Home)"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            style={{
              fill: 'var(--accent-cyan)',
              filter: 'drop-shadow(0 0 8px var(--accent-cyan)) drop-shadow(0 0 14px var(--accent-pink))',
            }}
          >
            <path d="M19.581 16.851H24v-4.439ZM24 3.574h-4.419v4.42l-4.419 4.418v4.44h4.419v-4.44L24 7.993Zm-4.419 0h-4.419v4.42zm-6.324 8.838H4.419l8.838-8.838H8.838L0 12.412v3.595h8.838v4.419h4.419z" />
          </svg>
        </button>
      </div>

      {/* Constant Navigation Controls */}
      <div className="nav-controls" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            currentPath === item.path ||
            (item.path === '/gamelobby' && currentPath === '/ludolobby') ||
            (item.path === '/profile' && currentPath.startsWith('/profile'))

          return (
            <button
              key={item.path}
              className={`retro-btn theme-trigger-btn ${isActive ? 'active' : ''}`}
              style={{
                justifyContent: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: '0.75rem',
                background: isActive ? 'var(--accent-pink)' : undefined,
                color: isActive ? '#ffffff' : undefined,
                borderColor: isActive ? 'var(--accent-pink)' : undefined,
                boxShadow: isActive ? '0 0 12px rgba(255, 0, 127, 0.5)' : undefined,
                fontWeight: isActive ? 'bold' : undefined,
              }}
              onClick={() => {
                retroAudio.playUiBeep(isActive ? 480 : 600, 0.05)
                navigate(item.path)
              }}
            >
              <span className="theme-btn-icon">{item.icon}</span>
              <span className="theme-btn-text">{item.label}</span>
            </button>
          )
        })}

        {/* Theme Selector Popover Menu */}
        <div className="theme-popover-wrapper" ref={popoverRef}>
          <button
            className={`retro-btn theme-trigger-btn ${isThemePopoverOpen ? 'active' : ''}`}
            id="themeModalBtn"
            aria-label="Toggle Theme Menu"
            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
            onClick={(e) => {
              e.stopPropagation()
              const next = !isThemePopoverOpen
              setIsThemePopoverOpen(next)
              retroAudio.playUiBeep(next ? 960 : 480, 0.05)
            }}
          >
            <span className="theme-btn-icon">&lt;/&gt;</span>
            <span className="theme-btn-text">THEME</span>
            <span className="theme-chevron">▼</span>
          </button>

          <div
            className={`theme-popover-menu ${isThemePopoverOpen ? 'active' : ''}`}
            id="themePopoverMenu"
          >
            <fieldset id="color-scheme">
              <legend>THEME SELECTOR</legend>
              <label htmlFor="theme-synthwave">
                <input
                  type="radio"
                  id="theme-synthwave"
                  name="theme-radio"
                  value="synthwave"
                  checked={theme === 'synthwave'}
                  onChange={() => {
                    applyTheme('synthwave')
                    setIsThemePopoverOpen(false)
                  }}
                />
                <span>CYBERPUNK</span>
              </label>
              <label htmlFor="theme-win95">
                <input
                  type="radio"
                  id="theme-win95"
                  name="theme-radio"
                  value="win95"
                  checked={theme === 'win95'}
                  onChange={() => {
                    applyTheme('win95')
                    setIsThemePopoverOpen(false)
                  }}
                />
                <span>WIN95</span>
              </label>
              <label htmlFor="theme-terminal">
                <input
                  type="radio"
                  id="theme-terminal"
                  name="theme-radio"
                  value="terminal"
                  checked={theme === 'terminal'}
                  onChange={() => {
                    applyTheme('terminal')
                    setIsThemePopoverOpen(false)
                  }}
                />
                <span>TERMINAL</span>
              </label>
            </fieldset>
          </div>
        </div>

        {/* Notifications (if provided) */}
        {notifications !== undefined && (
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount ?? 0}
            onMarkRead={onMarkRead ?? (() => {})}
            onMarkAllRead={onMarkAllRead ?? (() => {})}
          />
        )}

        {/* CRT Scanlines Toggle (if provided) */}
        {toggleCrt && (
          <div className="control-group">
            <label className="retro-toggle" title="Toggle CRT Screen Scanlines">
              <span>CRT FX</span>
              <input
                type="checkbox"
                id="crtToggle"
                checked={crtEnabled ?? true}
                onChange={toggleCrt}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        )}
      </div>
    </nav>
  )
}
