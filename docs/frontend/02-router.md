# Frontend — Router

## Table of Contents

- [Overview](#overview) — Custom window.location-based router using useSyncExternalStore
- [Files](#files) — Source file inventory
- [Key Types / Interfaces](#key-types--interfaces) — Route type and navigation function signatures
- [Core Logic / Flow](#core-logic--flow) — Mermaid sequence diagrams for navigation and popstate
- [Logic Paths Summary](#logic-paths-summary) — Decision trees for push/replace navigation
- [Dependencies](#dependencies) — Internal and external dependencies

---

## Overview

The router is a lightweight, hand-rolled client-side router built on `window.location` and React's `useSyncExternalStore`. It provides:

1. **Route reading** — `useRoute()` hook returns `{ path, query }` and re-renders on navigation or `popstate`.
2. **Navigation** — `navigate(to, { replace })` pushes or replaces the current URL, resets scroll to top, and notifies subscribers.
3. **No React Router** — intentionally minimal, avoids React Router bundle cost and lock-in.

---

## Files

| File | Role |
|------|------|
| `src/router.tsx` | Router implementation — `useRoute`, `navigate`, `Route` type |

---

## Key Types / Interfaces

### Route

```typescript
export type Route = {
  path: string;                // Normalized pathname (no trailing slashes, '/' for root)
  query: URLSearchParams;      // Parsed query string
}
```

### navigate

```typescript
export function navigate(to: string, opts?: { replace?: boolean }): void
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `to` | `string` | Target pathname (e.g. `/dashboard`) |
| `opts.replace` | `boolean` | If true, uses `replaceState` instead of `pushState` |

---

## Core Logic / Flow

### 1. Navigation

Sequence of steps when `navigate('/dashboard')` is called.
```mermaid
sequenceDiagram
    participant App as Component
    participant Nav as navigate()
    participant Browser as window.history
    participant Listeners as Set<cb>

    App->>Nav: navigate('/dashboard', { replace?: false })
    alt replace = true
        Nav->>Browser: history.replaceState(null, '', '/dashboard')
    else replace = false
        Nav->>Browser: history.pushState(null, '', '/dashboard')
    end
    Nav->>Browser: window.scrollTo(0, 0)
    Nav->>Listeners: emit() → forEach(cb => cb())
    Note over App,Listeners: All useRoute() subscribers re-render
    App->>App: Re-render with new path
```

### 2. Popstate (Back/Forward)

Sequence of steps when the user clicks the browser back/forward button.
```mermaid
sequenceDiagram
    participant User
    participant Browser as window
    participant Store as snapshot
    participant Listeners as Set<cb>

    User->>Browser: Click back button
    Browser->>Browser: popstate event
    Browser->>Store: emit()
    Store->>Store: read() → { path, query }
    Store->>Listeners: forEach(cb => cb())
    Note over User,Listeners: All useRoute() subscribers re-render with new path
```

---

## Logic Paths Summary

### navigate Path
```
navigate(to, { replace? })
  ├── replace = true → history.replaceState(null, '', to)
  └── replace = false → history.pushState(null, '', to)
  ├── window.scrollTo(0, 0)
  └── emit() → notify all subscribers
```

### useRoute Hook Path
```
useRoute()
  └── useSyncExternalStore(
       subscribe: (cb) => { listeners.add(cb); return () => listeners.delete(cb) }
       getSnapshot: () => snapshot
     )
  └── Returns { path, query }
```

---

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| `react` | `useSyncExternalStore` for reactive subscription to route changes |
| (none) | No external routing library; pure browser History API |