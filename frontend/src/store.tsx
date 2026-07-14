import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { BOT_POOL } from './theme'

export type Difficulty = 'easy' | 'medium' | 'hard'
export type Seat =
  | { type: 'you' }
  | { type: 'bot'; name: string; diff: Difficulty }
  | { type: 'empty' }

export type Mode = 2 | 4

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
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
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
  const rollingRef = useRef(false)

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
      mode, seats, dice, rolling, turn, settings,
      setMode, addBot, removeBot, setDiff, startGame, roll, endTurn, settingOn, toggleSetting,
    }),
    [mode, seats, dice, rolling, turn, settings, addBot, removeBot, setDiff, startGame, roll, endTurn, settingOn, toggleSetting],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
