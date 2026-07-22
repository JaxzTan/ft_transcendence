import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Shell } from './components/Shell'
import { Dashboard } from './pages/Dashboard'
import { Friends } from './pages/Friends'
import { Game } from './pages/Game'
import { Home } from './pages/Home'
import { Leaderboard } from './pages/Leaderboard'
import { Lobby } from './pages/Lobby'
import { Login } from './pages/Login'
import { Results } from './pages/Results'
import { Settings } from './pages/Settings'
import { Signup } from './pages/Signup'
import { navigate, useRoute } from './router'
import { AppProvider, useApp } from './store'

/** Screens that render inside the app shell (rail + header). */
const SHELL_ROUTES: Record<string, () => ReactNode> = {
  '/home': () => <Home />,
  '/dashboard': () => <Dashboard />,
  '/leaderboard': () => <Leaderboard />,
  '/friends': () => <Friends />,
  '/settings': () => <Settings />,
}

/** Full-bleed screens (no shell). */
const FULL_ROUTES: Record<string, () => ReactNode> = {
  '/login': () => <Login />,
  '/signup': () => <Signup />,
  '/lobby': () => <Lobby />,
  '/game': () => <Game />,
  '/results': () => <Results />,
}

/** Public routes, can be reached wihout a session */
const PUBLIC_ROUTES = new Set(['/login', '/signup'])

function Screen() {
  const { path } = useRoute()
  const { user, authReady } = useApp()
  const known = path in SHELL_ROUTES || path in FULL_ROUTES
  const isPublic = PUBLIC_ROUTES.has(path)

  useEffect(() => {
    // Wait for the /me session check. Else, a refresh while logged in
    // would bounce to /login before the cookie has been verified
    if (!authReady) return
    if (!known) navigate(user ? '/home' : '/login', { replace: true })
    else if (!user && !isPublic) navigate('/login', { replace: true })
    else if (user && isPublic) navigate('/home', { replace: true })
  }, [authReady, known, user, isPublic])

  if (!authReady) return null
  if (!known || (!user && !isPublic) || (user && isPublic)) return null

  if (path in SHELL_ROUTES) return <Shell>{SHELL_ROUTES[path]()}</Shell>
  return <>{FULL_ROUTES[path]()}</>
}

export default function App() {
  return (
    <AppProvider>
      <Screen />
    </AppProvider>
  )
}
