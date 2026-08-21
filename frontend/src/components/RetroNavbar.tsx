import React, { useEffect, useRef, useState } from 'react'
import { navigate, useRoute } from '../router'
import { useApp } from '../store'
import { retroAudio } from '../utils/audio'
import { UserAvatar } from './UserAvatar'
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
  { path: '/leaderboard', label: 'LEADERBOARD', icon: '♛' },
  { path: '/profile', label: 'PROFILE', icon: '@/' },
  { path: '/dashboard', label: 'DASHBOARD', icon: '▦' },
  { path: '/gamelobby', label: 'LOBBY', icon: '>_' },
  { path: '/game', label: 'ARENA', icon: '{}' },
  { path: '/friends', label: 'FRIENDS', icon: '♟' },
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
  const { user } = useApp()
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
    <nav
      className="navbar retro-floating-dock"
      id="mainNav"
      style={{
        position: 'fixed',
        left: 28,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 270,
        minWidth: 270,
        maxWidth: 270,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '18px 16px 16px',
        background: 'linear-gradient(180deg, rgba(20, 6, 46, 0.82), rgba(10, 2, 28, 0.90))',
        backdropFilter: 'blur(32px) saturate(220%)',
        WebkitBackdropFilter: 'blur(32px) saturate(220%)',
        border: '1px solid rgba(0, 240, 255, 0.35)',
        borderRadius: 22,
        boxShadow:
          '0 28px 70px rgba(0, 0, 0, 0.8), 0 0 32px rgba(0, 240, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.15), inset 0 0 20px rgba(255, 0, 127, 0.08)',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Top Section: Glowing 42 Emblem & User Profile Pill */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          paddingBottom: 12,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* 42 Logo Button Capsule */}
        <button
          className="brand-42-logo"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(255, 0, 127, 0.22), rgba(0, 240, 255, 0.18))',
            border: '1px solid rgba(0, 240, 255, 0.45)',
            borderRadius: 14,
            outline: 'none',
            padding: '12px 0',
            width: '100%',
            boxShadow:
              '0 0 20px rgba(0, 240, 255, 0.25), inset 0 0 12px rgba(255, 0, 127, 0.15)',
            transition: 'all 0.22s ease',
          }}
          onClick={() => {
            retroAudio.playUiBeep(440, 0.05)
            navigate('/home')
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)'
            e.currentTarget.style.borderColor = 'var(--accent-cyan)'
            e.currentTarget.style.boxShadow =
              '0 0 28px rgba(0, 240, 255, 0.6), inset 0 0 16px rgba(255, 0, 127, 0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.45)'
            e.currentTarget.style.boxShadow =
              '0 0 20px rgba(0, 240, 255, 0.25), inset 0 0 12px rgba(255, 0, 127, 0.15)'
          }}
          title="Return to Mainframe (Home)"
        >
          <svg
            width="54"
            height="30"
            viewBox="0 0 54 30"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              fill: 'var(--accent-cyan)',
              filter: 'drop-shadow(0 0 10px rgba(0, 240, 255, 0.8))',
            }}
          >
            <path d="M19.581 16.851H24v-4.439ZM24 3.574h-4.419v4.42l-4.419 4.418v4.44h4.419v-4.44L24 7.993Zm-4.419 0h-4.419v4.42zm-6.324 8.838H4.419l8.838-8.838H8.838L0 12.412v3.595h8.838v4.419h4.419z" />
          </svg>
        </button>

        {/* User Profile Pill */}
        {user && (
          <div
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
            }}
            onClick={() => {
              retroAudio.playUiBeep(520, 0.05)
              navigate(`/profile?u=${user.username}`)
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 0, 127, 0.14)'
              e.currentTarget.style.borderColor = 'rgba(255, 0, 127, 0.45)'
              e.currentTarget.style.boxShadow = '0 0 14px rgba(255, 0, 127, 0.25)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
              e.currentTarget.style.boxShadow = 'none'
            }}
            title="View Profile"
          >
            <UserAvatar
              username={user.username}
              size={30}
              fallbackStyle={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: 'rgba(25, 10, 56, 0.95)',
                color: 'var(--accent-pink)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 'bold',
                fontSize: '0.8rem',
              }}
            />
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.84rem',
                fontWeight: 'bold',
                color: '#ffffff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
              }}
            >
              {user.username}
            </div>
            <span
              style={{
                color: '#00ff88',
                fontSize: '0.6rem',
                filter: 'drop-shadow(0 0 5px #00ff88)',
              }}
            >
              ●
            </span>
          </div>
        )}
      </div>

      {/* Navigation Buttons (Taller Y-Axis & Sized-Up Typography) */}
      <div
        className="nav-controls"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          width: '100%',
        }}
      >
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
                width: '100%',
                height: 52,
                justifyContent: 'flex-start',
                gap: 12,
                padding: '0 14px',
                fontSize: '0.94rem',
                borderRadius: 12,
                background: isActive
                  ? 'linear-gradient(90deg, rgba(255, 0, 127, 0.95), rgba(157, 0, 255, 0.95))'
                  : 'rgba(255, 255, 255, 0.03)',
                color: isActive ? '#ffffff' : 'var(--text-main)',
                border: isActive
                  ? '1.5px solid #ff007f'
                  : '1px solid rgba(255, 255, 255, 0.07)',
                boxShadow: isActive
                  ? '0 0 20px rgba(255, 0, 127, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                  : 'none',
                fontWeight: isActive ? 900 : 'bold',
                letterSpacing: '1px',
                transition: 'all 0.18s ease',
              }}
              onClick={() => {
                retroAudio.playUiBeep(isActive ? 480 : 640, 0.05)
                navigate(item.path)
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(0, 240, 255, 0.14)'
                  e.currentTarget.style.borderColor = 'var(--accent-cyan)'
                  e.currentTarget.style.color = '#ffffff'
                  e.currentTarget.style.transform = 'translateX(4px)'
                  e.currentTarget.style.boxShadow = '0 0 14px rgba(0, 240, 255, 0.35)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)'
                  e.currentTarget.style.color = 'var(--text-main)'
                  e.currentTarget.style.transform = 'translateX(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 7,
                  background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 240, 255, 0.08)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.12rem',
                  color: isActive ? '#ffffff' : 'var(--accent-cyan)',
                  flexShrink: 0,
                  filter: isActive ? 'drop-shadow(0 0 6px #ffffff)' : 'none',
                }}
              >
                {item.icon}
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.92rem',
                  letterSpacing: '1px',
                  fontWeight: isActive ? 900 : 'bold',
                  flex: 1,
                  textAlign: 'left',
                }}
              >
                {item.label}
              </span>
              {isActive && (
                <span
                  style={{
                    color: '#ffffff',
                    fontSize: '0.92rem',
                    fontWeight: 900,
                    textShadow: '0 0 6px #ffffff',
                  }}
                >
                  ►
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Bottom Controls: Original Theme Selector + Notifications + CRT Toggle */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          paddingTop: 10,
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Original Theme Selector Popover Wrapper */}
        <div className="theme-popover-wrapper" ref={popoverRef} style={{ width: '100%', position: 'relative' }}>
          <button
            className={`retro-btn theme-trigger-btn ${isThemePopoverOpen ? 'active' : ''}`}
            id="themeModalBtn"
            aria-label="Toggle Theme Menu"
            style={{
              width: '100%',
              height: 46,
              justifyContent: 'space-between',
              padding: '0 14px',
              fontSize: '0.86rem',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              color: 'var(--text-main)',
            }}
            onClick={(e) => {
              e.stopPropagation()
              const next = !isThemePopoverOpen
              setIsThemePopoverOpen(next)
              retroAudio.playUiBeep(next ? 960 : 480, 0.05)
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-cyan)'
              e.currentTarget.style.boxShadow = '0 0 14px rgba(0, 240, 255, 0.35)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.3)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--accent-yellow)', fontFamily: 'var(--font-mono)', fontSize: '0.96rem', fontWeight: 'bold' }}>
                &lt;/&gt;
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '1px', fontWeight: 'bold', fontSize: '0.88rem' }}>
                THEME
              </span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
              ▼
            </span>
          </button>

          {/* Enlarged Theme Popover Menu (Opens Downwards) */}
          <div
            className={`theme-popover-menu ${isThemePopoverOpen ? 'active' : ''}`}
            id="themePopoverMenu"
            style={{
              left: 'calc(100% + 14px)',
              right: 'auto',
              top: 0,
              bottom: 'auto',
              width: 275,
              padding: '14px 16px',
              borderRadius: 14,
            }}
          >
            <fieldset
              id="color-scheme"
              style={{
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <legend style={{ fontSize: '0.82rem', padding: '0 8px', fontWeight: 'bold' }}>
                THEME SELECTOR
              </legend>
              <label
                htmlFor="theme-synthwave"
                style={{
                  fontSize: '0.88rem',
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  borderRadius: 6,
                }}
              >
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
                  style={{ width: 17, height: 17, cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 'bold' }}>CYBERPUNK</span>
              </label>
              <label
                htmlFor="theme-win95"
                style={{
                  fontSize: '0.88rem',
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  borderRadius: 6,
                }}
              >
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
                  style={{ width: 17, height: 17, cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 'bold' }}>WIN95</span>
              </label>
              <label
                htmlFor="theme-terminal"
                style={{
                  fontSize: '0.88rem',
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  borderRadius: 6,
                }}
              >
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
                  style={{ width: 17, height: 17, cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 'bold' }}>TERMINAL</span>
              </label>
            </fieldset>
          </div>
        </div>

        {/* Utilities: Notifications & CRT Toggle */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          {notifications !== undefined && (
            <div style={{ flex: '0 0 auto' }}>
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount ?? 0}
                onMarkRead={onMarkRead ?? (() => {})}
                onMarkAllRead={onMarkAllRead ?? (() => {})}
              />
            </div>
          )}

          {toggleCrt && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxSizing: 'border-box',
              }}
            >
              <span
                style={{
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.8px',
                  fontWeight: 'bold',
                }}
              >
                CRT FX
              </span>
              <label className="retro-toggle" title="Toggle CRT Screen Scanlines" style={{ margin: 0, transform: 'scale(0.85)' }}>
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
      </div>
    </nav>
  )
}
