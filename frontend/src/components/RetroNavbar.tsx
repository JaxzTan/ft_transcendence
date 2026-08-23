import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { navigate, useRoute } from '../router'
import { useApp } from '../store'
import { retroAudio } from '../utils/audio'
import { UserAvatar } from './UserAvatar'
import { NotificationBell } from './NotificationBell'
import { useNotifications, type Notification } from '../hooks/useNotifications'

type ThemeType = 'synthwave' | 'win95' | 'terminal'

interface RetroNavbarProps {
  activeRoute?: string
  crtEnabled?: boolean
  toggleCrt?: () => void
  notifications?: Notification[]
  unreadCount?: number
  onMarkRead?: (id: string) => void
  onMarkAllRead?: () => void
  style?: React.CSSProperties
}

export function RetroNavbar({
  activeRoute,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  style,
}: RetroNavbarProps) {
  const { t } = useTranslation()
  const route = useRoute()
  const { user, logout, lang, setLang, twoFactor, toggleTwoFactor, avatarBuster } = useApp()
  const currentPath = activeRoute || route.path

  const navItems = [
    { path: '/home', label: t('nav.home').toUpperCase(), icon: '⌂' },
    { path: '/leaderboard', label: t('nav.leaderboard').toUpperCase(), icon: '♛' },
    { path: '/profile', label: t('nav.profile').toUpperCase(), icon: '@/' },
    { path: '/friends', label: t('nav.friends').toUpperCase(), icon: '♟' },
    { path: '/gamelobby', label: t('nav.lobby').toUpperCase(), icon: '>_' },
    { path: '/game', label: 'ARENA', icon: '{}', disabled: true },
  ]

  // Global live notifications fallback so the notification bell works across all pages
  const fallbackNotifs = useNotifications()
  const activeNotifications = notifications ?? fallbackNotifs.notifications
  const activeUnreadCount = unreadCount ?? fallbackNotifs.unreadCount
  const activeMarkRead = onMarkRead ?? fallbackNotifs.markRead
  const activeMarkAllRead = onMarkAllRead ?? fallbackNotifs.markAllRead

  const [theme, setTheme] = useState<ThemeType>('synthwave')
  const [isThemePopoverOpen, setIsThemePopoverOpen] = useState(false)
  const [isAccountPopoverOpen, setIsAccountPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const accountPopoverRef = useRef<HTMLDivElement>(null)

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
      if (accountPopoverRef.current && !accountPopoverRef.current.contains(e.target as Node)) {
        setIsAccountPopoverOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const username = user?.username || 'PILOT'

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
        height: 'calc(100vh - 48px)',
        maxHeight: '94vh',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        padding: '22px 16px 18px',
        background: 'linear-gradient(180deg, rgba(20, 6, 46, 0.86), rgba(10, 2, 28, 0.94))',
        backdropFilter: 'blur(32px) saturate(220%)',
        WebkitBackdropFilter: 'blur(32px) saturate(220%)',
        border: '1px solid rgba(0, 240, 255, 0.35)',
        borderRadius: 22,
        boxShadow:
          '0 28px 70px rgba(0, 0, 0, 0.8), 0 0 32px rgba(0, 240, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.15), inset 0 0 20px rgba(255, 0, 127, 0.08)',
        boxSizing: 'border-box',
        overflow: 'visible',
        ...style,
      }}
    >
      {/* Top Section: User Profile Pill with Account Menu Popover */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          paddingBottom: 14,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* User Profile Pill Button -> Opens Account & Settings Popover Menu */}
        <div className="theme-popover-wrapper" ref={accountPopoverRef} style={{ width: '100%', position: 'relative' }}>
          <button
            type="button"
            className={`retro-btn theme-trigger-btn ${isAccountPopoverOpen ? 'active' : ''}`}
            id="userAccountBtn"
            aria-label="Account Settings, Language and 2FA"
            style={{
              width: '100%',
              height: 48,
              padding: '0 12px',
              borderRadius: 12,
              background: isAccountPopoverOpen ? 'rgba(255, 0, 127, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              border: isAccountPopoverOpen ? '1.5px solid #ff007f' : '1px solid rgba(0, 240, 255, 0.3)',
              boxShadow: isAccountPopoverOpen ? '0 0 16px rgba(255, 0, 127, 0.4)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              cursor: 'pointer',
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
              color: '#ffffff',
            }}
            onClick={(e) => {
              e.stopPropagation()
              setIsThemePopoverOpen(false)
              const next = !isAccountPopoverOpen
              setIsAccountPopoverOpen(next)
              retroAudio.playUiBeep(next ? 880 : 440, 0.05)
            }}
            onMouseEnter={(e) => {
              if (!isAccountPopoverOpen) {
                e.currentTarget.style.borderColor = 'var(--accent-cyan)'
                e.currentTarget.style.boxShadow = '0 0 14px rgba(0, 240, 255, 0.35)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isAccountPopoverOpen) {
                e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.3)'
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
            title="Account Settings, Language & 2FA"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', flex: 1 }}>
              <UserAvatar
                username={username}
                size={30}
                cacheBuster={avatarBuster}
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
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.94rem',
                  fontWeight: 900,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'left',
                }}
              >
                {username}
              </span>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                color: 'var(--accent-cyan)',
                fontWeight: 'bold',
                transform: isAccountPopoverOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease',
                flexShrink: 0,
              }}
            >
              ▼
            </span>
          </button>

          {/* Account & Settings Popover Menu */}
          <div
            className={`theme-popover-menu ${isAccountPopoverOpen ? 'active' : ''}`}
            id="accountPopoverMenu"
            style={{
              left: 'calc(100% + 14px)',
              right: 'auto',
              top: 0,
              bottom: 'auto',
              width: 275,
              padding: '16px 16px',
              borderRadius: 14,
              background: 'linear-gradient(180deg, rgba(20, 6, 46, 0.96), rgba(10, 2, 28, 0.98))',
              backdropFilter: 'blur(32px) saturate(220%)',
              border: '1.5px solid rgba(0, 240, 255, 0.45)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.95), 0 0 25px rgba(0, 240, 255, 0.25)',
              display: isAccountPopoverOpen ? 'flex' : 'none',
              flexDirection: 'column',
              gap: 12,
              zIndex: 10005,
            }}
          >
            {/* 1. Language Selection (Cyber Segmented Tabs) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.76rem', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                  🌐 LANGUAGE // LANGUE
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 6,
                  background: 'rgba(0, 0, 0, 0.45)',
                  padding: 4,
                  borderRadius: 8,
                  border: '1px solid rgba(0, 240, 255, 0.2)',
                }}
              >
                {[
                  { code: 'en' as const, label: 'EN', full: 'ENGLISH' },
                  { code: 'ms' as const, label: 'MS', full: 'MELAYU' },
                  { code: 'fr' as const, label: 'FR', full: 'FRANÇAIS' },
                ].map((item) => {
                  const isSelected = (lang || 'en') === item.code
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        setLang(item.code)
                        retroAudio.playUiBeep(880, 0.05)
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '7px 4px',
                        borderRadius: 6,
                        border: isSelected ? '1.5px solid var(--accent-cyan)' : '1px solid transparent',
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.25), rgba(255, 0, 127, 0.2))'
                          : 'transparent',
                        color: isSelected ? '#ffffff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 0 10px rgba(0, 240, 255, 0.35)' : 'none',
                        transition: 'all 0.18s ease',
                        outline: 'none',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '0.88rem' }}>
                        {item.label}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', opacity: 0.85, marginTop: 2 }}>
                        {item.full}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. 2FA Security Toggle Option */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 8,
                background: twoFactor ? 'rgba(0, 255, 136, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                border: twoFactor ? '1px solid #00ff88' : '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: twoFactor ? '0 0 10px rgba(0, 255, 136, 0.2)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
              onClick={() => {
                toggleTwoFactor()
                retroAudio.playUiBeep(twoFactor ? 440 : 880, 0.06)
              }}
              title="Toggle Two-Factor Authentication"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem' }}>🛡️</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.84rem', fontWeight: 900, color: '#ffffff' }}>
                  2FA AUTH
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 900,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: twoFactor ? '#00ff88' : 'rgba(255, 255, 255, 0.12)',
                  color: twoFactor ? '#0b021a' : 'var(--text-muted)',
                  border: twoFactor ? '1px solid #00ff88' : '1px solid rgba(255, 255, 255, 0.18)',
                }}
              >
                {twoFactor ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>

            {/* 3. Logout / Disconnect Button */}
            <button
              className="retro-btn"
              onClick={async () => {
                setIsAccountPopoverOpen(false)
                retroAudio.playUiBeep(330, 0.08)
                await logout()
                navigate('/login')
              }}
              style={{
                width: '100%',
                padding: '10px 0',
                fontSize: '0.84rem',
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                background: 'linear-gradient(90deg, rgba(255, 0, 85, 0.25), rgba(255, 0, 127, 0.35))',
                border: '1.5px solid #ff0055',
                color: '#ffffff',
                boxShadow: '0 0 12px rgba(255, 0, 85, 0.3)',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.18s ease',
              }}
            >
              <span>⏻</span>
              <span>DISCONNECT // LOGOUT</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Slider Window (Middle of Y-Axis) */}
      <div
        className="nav-slider-viewport"
        style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
          padding: '8px 0',
        }}
      >
        {/* Sliding Nav Items Track */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            transform: `translateY(${-((navItems.findIndex((it) => {
              if (it.path === '/home') return currentPath === '/home' || currentPath === '/'
              if (it.path === '/gamelobby') return currentPath === '/gamelobby' || currentPath === '/ludolobby'
              if (it.path === '/profile') return currentPath.startsWith('/profile')
              return currentPath === it.path
            }) >= 0 ? navItems.findIndex((it) => {
              if (it.path === '/home') return currentPath === '/home' || currentPath === '/'
              if (it.path === '/gamelobby') return currentPath === '/gamelobby' || currentPath === '/ludolobby'
              if (it.path === '/profile') return currentPath.startsWith('/profile')
              return currentPath === it.path
            }) : 0) - 2.5) * 38}px)`,
            transition: 'transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2)',
            zIndex: 2,
          }}
        >
          {navItems.map((item, idx) => {
            const activeIdx = navItems.findIndex((it) => {
              if (it.path === '/home') return currentPath === '/home' || currentPath === '/'
              if (it.path === '/gamelobby') return currentPath === '/gamelobby' || currentPath === '/ludolobby'
              if (it.path === '/profile') return currentPath.startsWith('/profile')
              return currentPath === it.path
            })
            const safeActiveIdx = activeIdx >= 0 ? activeIdx : 0
            const isDisabled = !!item.disabled
            const isActive = idx === safeActiveIdx
            const dist = Math.abs(idx - safeActiveIdx)
            const itemOpacity = isDisabled ? 0.25 : isActive ? 1.0 : Math.max(0.35, 0.75 - dist * 0.14)
            const itemScale = isActive ? 1.02 : Math.max(0.93, 1.0 - dist * 0.02)

            return (
              <button
                key={item.path}
                disabled={isDisabled}
                className={`retro-btn theme-trigger-btn ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                style={{
                  width: '100%',
                  height: 52,
                  justifyContent: 'flex-start',
                  gap: 12,
                  padding: '0 14px',
                  fontSize: '1.02rem',
                  borderRadius: 12,
                  background: isDisabled
                    ? 'rgba(255, 255, 255, 0.015)'
                    : isActive
                      ? 'linear-gradient(90deg, rgba(255, 0, 127, 0.95), rgba(157, 0, 255, 0.95))'
                      : 'rgba(20, 8, 44, 0.85)',
                  color: isDisabled
                    ? 'rgba(255, 255, 255, 0.3)'
                    : isActive
                      ? '#ffffff'
                      : 'var(--text-main)',
                  border: isDisabled
                    ? '1px dashed rgba(255, 255, 255, 0.12)'
                    : isActive
                      ? '1.5px solid #ff007f'
                      : '1px solid rgba(0, 240, 255, 0.25)',
                  boxShadow: isActive
                    ? '0 0 20px rgba(255, 0, 127, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                    : 'none',
                  fontWeight: 900,
                  letterSpacing: '1px',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: itemOpacity,
                  transform: `scale(${itemScale})`,
                  transition: 'all 0.35s ease',
                }}
                title={isDisabled ? `${item.label} (Enter match via Game Lobby)` : item.label}
                onClick={() => {
                  if (isDisabled) {
                    retroAudio.playUiBeep(220, 0.06)
                    return
                  }
                  retroAudio.playUiBeep(isActive ? 480 : 640, 0.05)
                  navigate(item.path)
                }}
                onMouseEnter={(e) => {
                  if (!isActive && !isDisabled) {
                    e.currentTarget.style.background = 'rgba(0, 240, 255, 0.18)'
                    e.currentTarget.style.borderColor = 'var(--accent-cyan)'
                    e.currentTarget.style.color = '#ffffff'
                    e.currentTarget.style.opacity = '1'
                    e.currentTarget.style.boxShadow = '0 0 14px rgba(0, 240, 255, 0.35)'
                    e.currentTarget.style.transform = 'translateX(4px)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive && !isDisabled) {
                    e.currentTarget.style.background = 'rgba(20, 8, 44, 0.85)'
                    e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.25)'
                    e.currentTarget.style.color = 'var(--text-main)'
                    e.currentTarget.style.opacity = String(itemOpacity)
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.transform = `scale(${itemScale})`
                  }
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 7,
                    background: isDisabled
                      ? 'rgba(255, 255, 255, 0.03)'
                      : isActive
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(0, 240, 255, 0.08)',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.2rem',
                    color: isDisabled
                      ? 'rgba(255, 255, 255, 0.3)'
                      : isActive
                        ? '#ffffff'
                        : 'var(--accent-cyan)',
                    flexShrink: 0,
                    filter: isActive ? 'drop-shadow(0 0 6px #ffffff)' : 'none',
                  }}
                >
                  {item.icon}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.02rem',
                    letterSpacing: '1px',
                    fontWeight: 900,
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
                      fontSize: '1rem',
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
      </div>

      {/* Bottom Controls: Theme Selector + Notifications */}
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
        {/* Theme Selector Popover */}
        <div className="theme-popover-wrapper" ref={popoverRef} style={{ width: '100%', position: 'relative' }}>
          <button
            className={`retro-btn theme-trigger-btn ${isThemePopoverOpen ? 'active' : ''}`}
            id="themeModalBtn"
            aria-label="Toggle Theme Menu"
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
            }}
            onClick={(e) => {
              e.stopPropagation()
              setIsAccountPopoverOpen(false)
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
              <span style={{ color: 'var(--accent-yellow)', fontFamily: 'var(--font-mono)', fontSize: '1.05rem', fontWeight: 'bold' }}>
                &lt;/&gt;
              </span>
              <span style={{ fontFamily: 'var(--font-display)', letterSpacing: '1px', fontWeight: 900, fontSize: '0.94rem' }}>
                THEME
              </span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
              {isThemePopoverOpen ? '▼' : '▲'}
            </span>
          </button>

          {/* Upward Opening Theme Popover Menu */}
          <div
            className={`theme-popover-menu open-up ${isThemePopoverOpen ? 'active' : ''}`}
            id="themePopoverMenu"
            style={{
              bottom: 'calc(100% + 8px)',
              top: 'auto',
              left: 0,
              right: 0,
              width: '100%',
              padding: '14px 16px',
              borderRadius: 14,
              boxSizing: 'border-box',
              zIndex: 10005,
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

        {/* Notifications Bell -> Accessible across ALL pages */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <NotificationBell
            notifications={activeNotifications}
            unreadCount={activeUnreadCount}
            onMarkRead={activeMarkRead}
            onMarkAllRead={activeMarkAllRead}
            placement="right"
            fullWidth
          />
        </div>
      </div>
    </nav>
  )
}
