import { useState, useEffect } from 'react'

type UserAvatarProps = {
  username: string
  size: number
  fallbackStyle: any
  style?: any
  cacheBuster?: number
}

export function UserAvatar({ username, size, fallbackStyle, style, cacheBuster }: UserAvatarProps) {
  const [error, setError] = useState(false)

  // Reset error state if username or cache buster changes
  useEffect(() => {
    setError(false)
  }, [username, cacheBuster])

  if (error || !username) {
    return (
      <div style={{ ...fallbackStyle, width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', ...style, flex: 'none' }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size * 0.55} // Scale icon relative to avatar size
          height={size * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: fallbackStyle.color || '#a6accd', opacity: 0.85 }}
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    )
  }

  const src = `/api/user/${username}/avatar${cacheBuster ? `?t=${cacheBuster}` : ''}`

  return (
    <img
      src={src}
      onError={() => setError(true)}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        display: 'block',
        flex: 'none',
        ...style
      }}
      alt={`${username}'s avatar`}
    />
  )
}
