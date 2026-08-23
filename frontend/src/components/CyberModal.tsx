import React, { useEffect, useState, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { retroAudio } from '../utils/audio'

interface CyberButtonProps {
  label: string
  shortcut?: string | ReactNode
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  variant?: 'cyan' | 'pink' | 'yellow' | 'danger'
  disabled?: boolean
  style?: CSSProperties
  className?: string
  autoFocus?: boolean
  type?: 'button' | 'submit' | 'reset'
}

export function CyberButton({
  label,
  shortcut,
  onClick,
  variant = 'cyan',
  disabled = false,
  style,
  className = '',
  autoFocus = false,
  type = 'button',
}: CyberButtonProps) {
  const variantClass =
    variant === 'pink'
      ? 'cyber-btn-pink'
      : variant === 'yellow'
      ? 'cyber-btn-yellow'
      : variant === 'danger'
      ? 'cyber-btn-danger'
      : ''

  const letters = typeof label === 'string' ? label.split('') : []

  return (
    <button
      type={type}
      className={`cyber-btn ${variantClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      style={style}
    >
      <span className="backdrop">
        <span className="corner" />
      </span>
      {shortcut && <kbd>{shortcut}</kbd>}
      <span className="cyber-label">{label}</span>

      {/* Cyber Glitch Layer on Hover */}
      {letters.length > 0 && (
        <div className="glitch-btn-layer" aria-hidden="true">
          <span className="backdrop">
            <span className="corner" />
          </span>
          {shortcut && <kbd>{shortcut}</kbd>}
          <span className="letters">
            {letters.map((char, index) => (
              <span key={index}>{char === ' ' ? '\u00A0' : char}</span>
            ))}
          </span>
        </div>
      )}
    </button>
  )
}

interface CyberModalProps {
  isOpen: boolean
  title: string
  message: ReactNode
  subMessage?: string
  versionTag?: string
  onCancel: () => void
  onProceed: () => void
  cancelLabel?: string
  proceedLabel?: string
  cancelShortcut?: string
  proceedShortcut?: string
  isDanger?: boolean
}

export function CyberModal({
  isOpen,
  title,
  message,
  subMessage,
  versionTag = 'v001.e1349837856',
  onCancel,
  onProceed,
  cancelLabel = 'CANCEL',
  proceedLabel = 'PROCEED',
  cancelShortcut = 'ESC',
  proceedShortcut = '↵',
  isDanger = false,
}: CyberModalProps) {
  const [mounted, setMounted] = useState(isOpen)
  const [isOpenActive, setIsOpenActive] = useState(false)
  const [isGlitching, setIsGlitching] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const glitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      // Double rAF ensures DOM is painted before transition classes trigger
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsOpenActive(true)
          retroAudio.playCyberSlide()
        })
      })

      // Glitch timing choreography
      const kickOffGlitch = () => {
        setIsGlitching(true)
        setTimeout(() => setIsGlitching(false), 1600)
        const nextInterval = Math.random() * 8000 + 4000
        glitchTimerRef.current = setTimeout(kickOffGlitch, nextInterval)
      }

      glitchTimerRef.current = setTimeout(kickOffGlitch, 1500)
    } else {
      setIsOpenActive(false)
      if (glitchTimerRef.current) clearTimeout(glitchTimerRef.current)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setMounted(false)
      }, 350)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (glitchTimerRef.current) clearTimeout(glitchTimerRef.current)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpenActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleProceed()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpenActive])

  const handleCancel = () => {
    retroAudio.playCyberReject()
    setIsOpenActive(false)
    setTimeout(() => {
      onCancel()
    }, 280)
  }

  const handleProceed = () => {
    retroAudio.playCyberAccept()
    setIsOpenActive(false)
    setTimeout(() => {
      onProceed()
    }, 280)
  }

  if (!mounted) return null

  return (
    <div
      className={`cyber-modal-overlay ${isOpenActive ? 'active' : ''}`}
      onClick={handleCancel}
    >
      <div
        className={`cyber-modal-box ${isOpenActive ? 'is-open' : ''} ${isGlitching ? 'glitching' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <section className="modal__body">
          {/* Animated Sliding Backdrop Plate */}
          <div className="body__backdrop">
            <div className="backdrop-plate" />
          </div>

          <div className="body__content">
            <span className="version">{versionTag}</span>
            <h2>
              <span>{title}</span>
            </h2>
            <div className="body__text">
              {typeof message === 'string' ? <p>{message}</p> : message}
              {subMessage && <p>{subMessage}</p>}
            </div>

            {/* Glitch Keyframe Overlay */}
            <div className="modal__glitch" aria-hidden="true">
              <h2>
                <span>{title}</span>
              </h2>
              <div className="body__text">
                {typeof message === 'string' ? <p>{message}</p> : message}
                {subMessage && <p>{subMessage}</p>}
              </div>
            </div>

            <div className="modal__actions">
              <CyberButton
                label={cancelLabel}
                shortcut={cancelShortcut}
                onClick={handleCancel}
                variant="pink"
              />
              <CyberButton
                label={proceedLabel}
                shortcut={proceedShortcut}
                onClick={handleProceed}
                variant={isDanger ? 'danger' : 'cyan'}
                autoFocus
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
