import { useSyncExternalStore } from 'react';

// Avatar cache-buster store. SSE avatar_changed events bump a per-user version;
// <UserAvatar> reads it via useAvatarVersion and puts it in the photo URL so
// every open client refetches the new photo without a reload.
const versions = new Map<string, number>();
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

export function bumpAvatarVersion(username: string): void {
  if (!username) return;
  versions.set(username, (versions.get(username) ?? 0) + 1);
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAvatarVersion(username: string): number {
  return useSyncExternalStore(
    subscribe,
    () => versions.get(username) ?? 0,
    () => versions.get(username) ?? 0,
  );
}
