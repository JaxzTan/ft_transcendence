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
  const initials = username ? username.slice(0, 2).toUpperCase() : '??'

  // Reset error state if username or cache buster changes
  useEffect(() => {
    setError(false)
  }, [username, cacheBuster])

  if (error || !username) {
    return (
      <div style={{ ...fallbackStyle, width: size, height: size, ...style, flex: 'none' }}>
        {initials}
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
