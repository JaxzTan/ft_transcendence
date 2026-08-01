import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { BOT_POOL } from './theme'
import { apiFetch } from './api'

export type AuthUser = { id: string; username: string }

/** Pulls a readable message out of nestjs error body  */
function apiError(body: unknown, fallback: string): string {
  const message = (body as { message?: string | string[] } | null)?.message
  if (Array.isArray(message)) return message.join('. ')
  return typeof message === 'string' ? message : fallback
}

export type Difficulty = 'easy' | 'medium' | 'hard'
export type Seat =
  | { type: 'you' }
  | { type: 'bot'; name: string; diff: Difficulty }
  | { type: 'empty' }

export type Mode = 2 | 4

export type Lang = 'en' | 'fr' | 'ms' | 'zh'

/** Languages offered in the account menu. */
export const LANGUAGES: Array<{ code: Lang; label: string; flag: string }> = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
]

const LANG_KEY = 'lr.lang'
const TWOFA_KEY = 'lr.twofa'

function storedLang(): Lang {
  const raw = localStorage.getItem(LANG_KEY)
  return LANGUAGES.some((l) => l.code === raw) ? (raw as Lang) : 'en'
}

/** Defaults for the settings toggles, keyed "<group>-<row>". */
export const SETTING_DEFAULTS: Record<string, boolean> = {
  '0-0': true, // Sound effects
  '0-1': true, // Music
  '1-0': true, // Auto-roll
  '1-1': false, // Fast animations
  '1-2': true, // Move hints
  '2-0': true, // Friend invites
  '2-1': false, // Weekly recap
}

type AppState = {
  user: AuthUser | null
  authReady: boolean
  /** Factor one. `identifier` is a username or email. Success = { pendingToken } (code emailed); failure = { error }. */
  login: (identifier: string, password: string) => Promise<{ error?: string; pendingToken?: string }>
  /** Success = null (verification email sent — no session yet); failure = message. */
  register: (username: string, password: string, email: string) => Promise<string | null>
  /** Factor two. Success = null (session cookie set, user in store); failure = message. */
  verify2fa: (pendingToken: string, code: string) => Promise<string | null>
  /** Emails a reset link. Always resolves null (generic response — no account enumeration). */
  forgotPassword: (email: string) => Promise<string | null>
  /** Redeems a reset token and sets a new password. Success = null; failure = message. */
  resetPassword: (token: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
  mode: Mode
  seats: Seat[]
  dice: number
  rolling: boolean
  turn: number
  settings: Record<string, boolean>
  setMode: (m: Mode) => void
  addBot: (i: number) => void
  removeBot: (i: number) => void
  setDiff: (i: number, diff: Difficulty) => void
  /** Fills remaining empty seats with Easy bots. Returns false when no bot is seated yet. */
  startGame: () => boolean
  roll: () => void
  endTurn: () => void
  settingOn: (key: string) => boolean
  toggleSetting: (key: string) => void
  lang: Lang
  setLang: (l: Lang) => void
  twoFactor: boolean
  toggleTwoFactor: () => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    // apiFetch: if the access token has expired but the refresh token is still
    // good, this silently refreshes and we stay logged in across reloads.
    apiFetch('/api/auth/me')
      .then(async (res) => setUser(res.ok ? (await res.json()).user : null))
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true))
  }, [])

  // Login — factor one. Password OK means a code was emailed; the session
  // itself only exists after verify2fa succeeds.
  const login = useCallback(
    async (identifier: string, password: string): Promise<{ error?: string; pendingToken?: string }> => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      }).catch(() => null)
      if (!res) return { error: 'Could not reach the server' }
      if (!res.ok) return { error: apiError(await res.json().catch(() => null), 'Login failed') }
      const data = await res.json()
      // 2FA off: the backend already set the session cookies, so there's no
      // code step — record the user and let the caller route straight home.
      if (!data.twoFactorRequired) {
        setUser(data.user)
        return {}
      }
      // 2FA on: a code was emailed; the session only exists after verify2fa.
      return { pendingToken: data.pendingToken }
    },
    [],
  )

  // Register — no session on signup; the account activates via the emailed
  // verification link, then the user logs in normally.
  const register = useCallback(
    async (username: string, password: string, email: string): Promise<string | null> => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email }),
      }).catch(() => null)
      if (!res) return 'Could not reach the server'
      if (!res.ok) return apiError(await res.json().catch(() => null), 'Sign up failed')
      return null
    },
    [],
  )

  // Factor two — a correct emailed code buys the actual session cookie.
  const verify2fa = useCallback(
    async (pendingToken: string, code: string): Promise<string | null> => {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, code }),
      }).catch(() => null)
      if (!res) return 'Could not reach the server'
      if (!res.ok) return apiError(await res.json().catch(() => null), 'Code rejected')
      setUser((await res.json()).user)
      return null
    },
    [],
  )

  // Forgot password — asks the backend to email a reset link. The response is
  // deliberately generic, so this always resolves null (never reveals whether
  // the address exists). A network failure still surfaces as a message.
  const forgotPassword = useCallback(async (email: string): Promise<string | null> => {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => null)
    if (!res) return 'Could not reach the server'
    if (!res.ok) return apiError(await res.json().catch(() => null), 'Something went wrong')
    return null
  }, [])

  // Reset password — redeems the emailed token and sets the new password.
  const resetPassword = useCallback(async (token: string, password: string): Promise<string | null> => {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    }).catch(() => null)
    if (!res) return 'Could not reach the server'
    if (!res.ok) return apiError(await res.json().catch(() => null), 'Could not reset password')
    return null
  }, [])

  // Logout
  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    setUser(null)
  }, [])

  const [mode, setMode] = useState<Mode>(4)
  const [seats, setSeats] = useState<Seat[]>([
    { type: 'you' },
    { type: 'bot', name: 'Rook', diff: 'hard' },
    { type: 'bot', name: 'Bishop', diff: 'medium' },
    { type: 'empty' },
  ])
  const [dice, setDice] = useState(4)
  const [rolling, setRolling] = useState(false)
  const [turn, setTurn] = useState(0)
  const [settings, setSettings] = useState<Record<string, boolean>>({})
  const [lang, setLangState] = useState<Lang>(storedLang)
  const [twoFactor, setTwoFactor] = useState(() => localStorage.getItem(TWOFA_KEY) === '1')
  const rollingRef = useRef(false)

  // Persist account prefs; swap these for PATCH /api/user/me once the backend lands.
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem(LANG_KEY, l)
    document.documentElement.lang = l
  }, [])

  const toggleTwoFactor = useCallback(() => {
    setTwoFactor((prev) => {
      localStorage.setItem(TWOFA_KEY, prev ? '0' : '1')
      return !prev
    })
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const addBot = useCallback((i: number) => {
    setSeats((prev) => {
      const used = prev.filter((s) => s.type === 'bot').map((s) => s.name)
      const name = BOT_POOL.find((n) => !used.includes(n)) || 'Bot'
      const next = prev.slice()
      next[i] = { type: 'bot', name, diff: 'medium' }
      return next
    })
  }, [])

  const removeBot = useCallback((i: number) => {
    setSeats((prev) => {
      const next = prev.slice()
      next[i] = { type: 'empty' }
      return next
    })
  }, [])

  const setDiff = useCallback((i: number, diff: Difficulty) => {
    setSeats((prev) => {
      const seat = prev[i]
      if (seat.type !== 'bot') return prev
      const next = prev.slice()
      next[i] = { ...seat, diff }
      return next
    })
  }, [])

  const startGame = useCallback((): boolean => {
    const bots = seats.slice(0, mode).filter((s) => s.type === 'bot').length
    if (bots < 1) return false
    const used = seats.filter((s) => s.type === 'bot').map((s) => s.name)
    const pool = BOT_POOL.filter((n) => !used.includes(n))
    setSeats((prev) =>
      prev.map((s, i): Seat => {
        if (i < mode && s.type === 'empty') return { type: 'bot', name: pool.shift() || 'Bot', diff: 'easy' }
        return s
      }),
    )
    setTurn(0)
    return true
  }, [seats, mode])

  const roll = useCallback(() => {
    if (rollingRef.current) return
    rollingRef.current = true
    setRolling(true)
    setTimeout(() => {
      setDice(1 + Math.floor(Math.random() * 6))
      setRolling(false)
      rollingRef.current = false
    }, 650)
  }, [])

  const endTurn = useCallback(() => {
    setTurn((t) => (t + 1) % mode)
  }, [mode])

  const settingOn = useCallback(
    (key: string) => (key in settings ? settings[key] : SETTING_DEFAULTS[key] ?? false),
    [settings],
  )

  const toggleSetting = useCallback(
    (key: string) => setSettings((prev) => ({ ...prev, [key]: !(key in prev ? prev[key] : SETTING_DEFAULTS[key] ?? false) })),
    [],
  )

  const value = useMemo(
    () => ({
      user, authReady, login, register, verify2fa, forgotPassword, resetPassword, logout,
      mode, seats, dice, rolling, turn, settings,
      setMode, addBot, removeBot, setDiff, startGame, roll, endTurn, settingOn, toggleSetting,
      lang, setLang, twoFactor, toggleTwoFactor,
    }),
    [user, authReady, login, register, verify2fa, forgotPassword, resetPassword, logout, mode, seats, dice, rolling, turn, settings, addBot, removeBot, setDiff, startGame, roll, endTurn, settingOn, toggleSetting, lang, setLang, twoFactor, toggleTwoFactor],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
