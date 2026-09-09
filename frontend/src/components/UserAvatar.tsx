import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { dicebearAvatar } from '../dicebear';
import { useAvatarVersion } from '../avatarCache';

type UserAvatarProps = {
  username: string;
  size: number;
  fallbackStyle?: CSSProperties;
  avatarStyle?: string | null;
  style?: CSSProperties;
  cacheBuster?: number;
  hasAvatarPhoto?: boolean;
};

export function UserAvatar({
  username,
  size,
  fallbackStyle,
  avatarStyle,
  style,
  cacheBuster,
  hasAvatarPhoto,
}: UserAvatarProps) {
  // Each avatar photo gets up to 2 load attempts; after 2 failures (e.g. a
  // malformed file) we keep the dicebear fallback until the user or photo
  // changes. SSE avatar_changed events refresh photos via a new versioned URL.
  const [error, setError] = useState(false);
  const photoErrorsRef = useRef(0);
  const [stuckOnFallback, setStuckOnFallback] = useState(false);
  const liveVersion = useAvatarVersion(username);

  useEffect(() => {
    setError(false);
  }, [username, cacheBuster, liveVersion]);

  useEffect(() => {
    photoErrorsRef.current = 0;
    setStuckOnFallback(false);
  }, [username, cacheBuster, liveVersion]);

  if (!username) {
    return (
      <div
        style={{
          ...fallbackStyle,
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
          flex: 'none',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size * 0.55}
          height={size * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: fallbackStyle?.color ?? '#a99a83', opacity: 0.8 }}
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    );
  }

  const version = cacheBuster ?? liveVersion;
  const showFallback = hasAvatarPhoto === false || error || stuckOnFallback;
  const src = showFallback
    ? dicebearAvatar(username, avatarStyle)
    : `/api/user/${username}/avatar?t=${version}`;

  const handlePhotoError = () => {
    photoErrorsRef.current += 1;
    setError(true);
    if (photoErrorsRef.current >= 2) setStuckOnFallback(true);
  };

  return (
    <img
      key={liveVersion}
      src={src}
      onError={showFallback ? undefined : handlePhotoError}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        display: 'block',
        flex: 'none',
        ...style,
      }}
      alt={`${username}'s avatar`}
    />
  );
}
