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
import { AppProvider } from './store'

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

function Screen() {
  const { path } = useRoute()
  const known = path in SHELL_ROUTES || path in FULL_ROUTES

  useEffect(() => {
    if (!known) navigate('/login', { replace: true })
  }, [known])

  if (path in SHELL_ROUTES) return <Shell>{SHELL_ROUTES[path]()}</Shell>
  if (path in FULL_ROUTES) return <>{FULL_ROUTES[path]()}</>
  return null
}

export default function App() {
  return (
    <AppProvider>
      <Screen />
    </AppProvider>
  )
}
