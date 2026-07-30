# Frontend — Auth Pages (Login & Signup)

## Table of Contents

- [Overview](#overview) — Login and signup forms with OAuth integration
- [Files](#files) — Source file inventory
- [Key Types / Interfaces](#key-types--interfaces) — Form state and validation shapes
- [Core Logic / Flow](#core-logic--flow) — Mermaid sequence diagrams for login and signup flows
- [Logic Paths Summary](#logic-paths-summary) — Decision trees for form submission
- [Dependencies](#dependencies) — Internal and external dependencies

---

## Overview

The auth pages provide the entry point to the application. They include:

1. **Login** — username/password form with "Remember me" checkbox, OAuth buttons, and validation.
2. **Signup** — username, email, password, and confirm password fields with match validation.

Both pages use the `AuthLayout` wrapper and share the same visual style (gold theme, OAuth provider buttons).

---

## Files

| File | Role |
|------|------|
| `src/pages/Login.tsx` | Login form — username, password, OAuth buttons |
| `src/pages/Signup.tsx` | Signup form — username, email, password, confirm password |
| `src/components/AuthLayout.tsx` | Layout wrapper — logo, tagline, centered card |
| `src/components/OAuthButtons.tsx` | 42, GitHub, Google provider buttons |

---

## Key Types / Interfaces

### Login Form State

```typescript
const [username, setUsername] = useState('')
const [password, setPassword] = useState('')
const [error, setError] = useState<string | null>(null)
const [submitting, setSubmitting] = useState(false)
```

### Signup Form State

```typescript
const [username, setUsername] = useState('')
const [email, setEmail] = useState('')
const [password, setPassword] = useState('')
const [confirm, setConfirm] = useState('')
const [error, setError] = useState<string | null>(null)
const [submitting, setSubmitting] = useState(false)
```

### Validation Rules

| Field | Rule |
|-------|------|
| Username | Required, 3-20 chars, alphanumeric + underscore only |
| Email | Optional, valid email format |
| Password | Required, 8-72 chars, at least one letter and one number |
| Confirm | Must match password |

---

## Core Logic / Flow

### 1. Login Flow

Sequence of steps when a user logs in.
```mermaid
sequenceDiagram
    participant User
    participant Login as Login.tsx
    participant Store as useApp().login
    participant API as Backend /api/auth/login
    participant Router as navigate

    User->>Login: Enter username + password
    User->>Login: Click "Enter the parlor"
    Login->>Login: setSubmitting(true), setError(null)
    Login->>Store: login(username, password)
    Store->>API: POST /api/auth/login { username, password }
    alt 200 OK
        API-->>Store: { user: { id, username } }
        Store->>Store: setUser(user)
        Store-->>Login: null (success)
        Login->>Router: navigate('/home')
    else 401 / error
        API-->>Store: error body
        Store-->>Login: error message
        Login->>Login: setError(message)
    end
    Login->>Login: setSubmitting(false)
```

### 2. Signup Flow

Sequence of steps when a user creates an account.
```mermaid
sequenceDiagram
    participant User
    participant Signup as Signup.tsx
    participant Store as useApp().register
    participant API as Backend /api/auth/register
    participant Router as navigate

    User->>Signup: Enter username, email, password, confirm
    User->>Signup: Click "Join the table"
    Signup->>Signup: Validate password === confirm
    alt Passwords don't match
        Signup->>Signup: setError('Passwords do not match')
    else Match
        Signup->>Signup: setSubmitting(true), setError(null)
        Signup->>Store: register(username, password, email)
        Store->>API: POST /api/auth/register { username, password, email? }
        alt 200 OK
            API-->>Store: { user: { id, username } }
            Store->>Store: setUser(user)
            Store-->>Signup: null (success)
            Signup->>Router: navigate('/home')
        else 409 / error
            API-->>Store: error body
            Store-->>Signup: error message
            Signup->>Signup: setError(message)
        end
        Signup->>Signup: setSubmitting(false)
    end
```

### 3. OAuth Flow

Sequence of steps when a user clicks an OAuth button.
```mermaid
sequenceDiagram
    participant User
    participant OAuth as OAuthButtons
    participant Browser
    participant Backend as Backend OAuth endpoint
    participant Provider as OAuth Provider

    User->>OAuth: Click "Continue with Google/GitHub/42"
    OAuth->>Browser: window.location.href = '/api/auth/{provider}'
    Browser->>Backend: GET /api/auth/{provider}
    Backend->>Provider: Redirect to OAuth consent
    Provider-->>Backend: Callback with auth code
    Backend->>Backend: Exchange code for token, create/find user, set JWT cookie
    Backend-->>Browser: 302 redirect to FRONTEND_URL
    Browser->>Browser: Load /home (cookie auto-sent)
```

---

## Logic Paths Summary

### Login Path
```
onSubmit(e)
  ├── e.preventDefault()
  ├── If submitting → return
  ├── login(username, password)
  │   ├── POST /api/auth/login
  │   │   ├── 200 → setUser(user), navigate('/home')
  │   │   └── error → setError(message)
  └── setSubmitting(false)
```

### Signup Path
```
onSubmit(e)
  ├── e.preventDefault()
  ├── If submitting → return
  ├── If password !== confirm → setError('Passwords do not match')
  ├── register(username, password, email)
  │   ├── POST /api/auth/register
  │   │   ├── 200 → setUser(user), navigate('/home')
  │   │   └── error → setError(message)
  └── setSubmitting(false)
```

### OAuth Path
```
onClick provider button
  └── window.location.href = '/api/auth/{provider}'
       └── Full OAuth redirect loop handled by backend
```

---

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| `store.tsx` | `useApp()` for login/register actions |
| `router.tsx` | `navigate` for post-auth redirect |
| `theme.ts` | `btnGold`, `goldText`, `input`, `label` styles |
| `AuthLayout.tsx` | Centered card layout wrapper |
| `OAuthButtons.tsx` | Provider button row |