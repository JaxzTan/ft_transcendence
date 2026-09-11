import { useSyncExternalStore } from 'react';

/*
Avatar cache-buster store. SSE avatar_changed events record a new version for
that username; <UserAvatar> reads it via useAvatarVersion and puts it in the
photo URL so every open client refetches without a reload.

Versions are timestamps, not a counter. The photo URL lands in a 24h browser
cache (user.controller.ts sets Cache-Control: max-age=86400), and this Map is
in-memory, so a counter restarting at 0 on every page load would reuse ?t=0,
?t=1, ... and the browser would answer those from cache with the PREVIOUS
photo. Timestamps never repeat, so a changed photo always gets a fresh URL.
*/
const versions = new Map<string, number>();
const listeners = new Set<() => void>();

const SESSION_START = Date.now();

const emit = () => {
  for (const listener of listeners) listener();
};

export function bumpAvatarVersion(username: string): void {
  if (!username) return;
  versions.set(username, Date.now());
  emit();
}

export function hasAvatarChanged(username: string): boolean {
  return versions.has(username);
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
    () => versions.get(username) ?? SESSION_START,
    () => versions.get(username) ?? SESSION_START,
  );
}
