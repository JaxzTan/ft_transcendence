import { useRef } from 'react';
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
  const liveVersion = useAvatarVersion(username);
  const imgRef = useRef<HTMLImageElement | null>(null);

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
  const usePhoto = hasAvatarPhoto === true || liveVersion > 0;
  const fallbackSrc = dicebearAvatar(username, avatarStyle);
  const src = usePhoto ? `/api/user/${username}/avatar?t=${version}` : fallbackSrc;

  return (
    <img
      key={liveVersion}
      ref={imgRef}
      src={src}
      onError={() => {
        if (imgRef.current) imgRef.current.src = fallbackSrc;
      }}
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
