import React from 'react'
import type { RankTier } from '../utils/ranks'

interface RankBadgeProps {
  tier: RankTier
  fontSize?: string | number
  padding?: string
  style?: React.CSSProperties
  className?: string
  showCrosshairs?: boolean
  showParticles?: boolean
}

export function RankBadge({
  tier,
  fontSize,
  padding,
  style,
  className = '',
  showCrosshairs = true,
  showParticles = true,
}: RankBadgeProps) {
  const isMamee = tier.key === 'mamee'
  const isMilo = tier.key === 'milo'
  const isHoney = tier.key === 'honey'
  const isSuper = tier.key === 'super'
  const isChoki = tier.key === 'choki'

  const tierClass = isMamee
    ? 'badge-mamee-monster'
    : isMilo
      ? 'badge-tier-milo'
      : isHoney
        ? 'badge-tier-honey'
        : isSuper
          ? 'badge-tier-super'
          : isChoki
            ? 'badge-tier-choki'
            : ''

  const crosshairColor = isMamee
    ? '#ffe600'
    : isMilo
      ? '#ff00ff'
      : isHoney
        ? '#ffd700'
        : isSuper
          ? '#00f0ff'
          : '#d7a15c'

  return (
    <span
      className={`${tierClass} ${className}`}
      style={{
        position: 'relative',
        fontSize: fontSize ?? (isMamee ? '12px' : '11.5px'),
        padding: padding ?? (isMamee ? '5px 16px' : '4px 14px'),
        fontFamily: 'var(--font-display)',
        fontWeight: 900,
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        lineHeight: 1,
        borderRadius: isMamee ? 6 : 4,
        userSelect: 'none',
        cursor: 'default',
        boxSizing: 'border-box',
        ...style,
      }}
      title={`Rank Tier: ${tier.name}`}
    >
      {/* Floating Animated Ember Particles (MAMEE MONSTER ONLY) */}
      {isMamee && showParticles && (
        <>
          <span
            className="mamee-ember-particle"
            style={{
              width: 3,
              height: 3,
              left: '12%',
              top: '2px',
              animationDelay: '0s',
              ['--spark-dur' as string]: '2.2s',
              ['--spark-drift' as string]: '-6px',
            }}
          />
          <span
            className="mamee-ember-particle"
            style={{
              width: 2.5,
              height: 2.5,
              left: '32%',
              top: '0px',
              animationDelay: '0.5s',
              ['--spark-dur' as string]: '1.9s',
              ['--spark-drift' as string]: '4px',
            }}
          />
          <span
            className="mamee-ember-particle"
            style={{
              width: 3.5,
              height: 3.5,
              left: '52%',
              top: '1px',
              animationDelay: '1.1s',
              ['--spark-dur' as string]: '2.4s',
              ['--spark-drift' as string]: '-4px',
            }}
          />
          <span
            className="mamee-ember-particle"
            style={{
              width: 2,
              height: 2,
              left: '72%',
              top: '0px',
              animationDelay: '0.8s',
              ['--spark-dur' as string]: '1.8s',
              ['--spark-drift' as string]: '5px',
            }}
          />
          <span
            className="mamee-ember-particle"
            style={{
              width: 3,
              height: 3,
              left: '88%',
              top: '2px',
              animationDelay: '1.4s',
              ['--spark-dur' as string]: '2.1s',
              ['--spark-drift' as string]: '-5px',
            }}
          />
        </>
      )}

      {/* Floating Animated Plasma Particles (MILO DINOSAUR ONLY) */}
      {isMilo && showParticles && (
        <>
          <span
            className="milo-plasma-particle"
            style={{
              width: 3,
              height: 3,
              left: '14%',
              top: '2px',
              animationDelay: '0s',
              ['--spark-dur' as string]: '2.3s',
              ['--spark-drift' as string]: '-5px',
            }}
          />
          <span
            className="milo-plasma-particle"
            style={{
              width: 2.5,
              height: 2.5,
              left: '35%',
              top: '1px',
              animationDelay: '0.6s',
              ['--spark-dur' as string]: '2.0s',
              ['--spark-drift' as string]: '4px',
            }}
          />
          <span
            className="milo-plasma-particle"
            style={{
              width: 3.5,
              height: 3.5,
              left: '54%',
              top: '0px',
              animationDelay: '1.2s',
              ['--spark-dur' as string]: '2.5s',
              ['--spark-drift' as string]: '-4px',
            }}
          />
          <span
            className="milo-plasma-particle"
            style={{
              width: 2,
              height: 2,
              left: '74%',
              top: '1px',
              animationDelay: '0.4s',
              ['--spark-dur' as string]: '1.9s',
              ['--spark-drift' as string]: '5px',
            }}
          />
          <span
            className="milo-plasma-particle"
            style={{
              width: 3,
              height: 3,
              left: '90%',
              top: '2px',
              animationDelay: '1.5s',
              ['--spark-dur' as string]: '2.2s',
              ['--spark-drift' as string]: '-6px',
            }}
          />
        </>
      )}

      {/* Absolute Symmetrical 4-Corner HUD Crosshairs */}
      {showCrosshairs && (
        <>
          <span
            style={{
              position: 'absolute',
              top: 1,
              left: 3,
              fontSize: '0.62rem',
              lineHeight: 1,
              fontFamily: 'var(--font-mono)',
              color: crosshairColor,
              opacity: 0.85,
              pointerEvents: 'none',
            }}
          >
            ⌜
          </span>
          <span
            style={{
              position: 'absolute',
              top: 1,
              right: 3,
              fontSize: '0.62rem',
              lineHeight: 1,
              fontFamily: 'var(--font-mono)',
              color: crosshairColor,
              opacity: 0.85,
              pointerEvents: 'none',
            }}
          >
            ⌝
          </span>
          <span
            style={{
              position: 'absolute',
              bottom: 1,
              left: 3,
              fontSize: '0.62rem',
              lineHeight: 1,
              fontFamily: 'var(--font-mono)',
              color: crosshairColor,
              opacity: 0.85,
              pointerEvents: 'none',
            }}
          >
            ⌞
          </span>
          <span
            style={{
              position: 'absolute',
              bottom: 1,
              right: 3,
              fontSize: '0.62rem',
              lineHeight: 1,
              fontFamily: 'var(--font-mono)',
              color: crosshairColor,
              opacity: 0.85,
              pointerEvents: 'none',
            }}
          >
            ⌟
          </span>
        </>
      )}

      {/* Dead-Centered Text */}
      <span
        style={{
          display: 'inline-block',
          textAlign: 'center',
          width: '100%',
          zIndex: 2,
        }}
      >
        {tier.name}
      </span>
    </span>
  )
}
