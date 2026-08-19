import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Shell } from './components/Shell'
import { Dashboard } from './pages/Dashboard'
import { Friends } from './pages/Friends'
import { Game } from './pages/Game'
import { Home } from './pages/Home'
import { Leaderboard } from './pages/Leaderboard'
import { Lobby } from './pages/Lobby'
import { LudoLobby } from './pages/LudoLobby'
import { Login } from './pages/Login'
import { Results } from './pages/Results'
import { Signup } from './pages/Signup'
import { Profile } from './pages/Profile'
import { TwoFactor } from './pages/TwoFactor'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
// MultiplayerLobby is intentionally UNWIRED (file kept for reference):
// all multiplayer create/join/quick routes through /lobby (LudoLobby) now.
import { navigate, useRoute } from './router'
import { AppProvider, useApp } from './store'

/** Screens that render inside the app shell (rail + header). */
const SHELL_ROUTES: Record<string, () => ReactNode> = {
  '/dashboard': () => <Dashboard />,
  '/leaderboard': () => <Leaderboard />,
  '/friends': () => <Friends />,
  '/profile': () => <Profile />,
}

/** Full-bleed screens (no shell). */
const FULL_ROUTES: Record<string, () => ReactNode> = {
  '/home': () => <Home />,
  '/login': () => <Login />,
  '/signup': () => <Signup />,
  '/2fa': () => <TwoFactor />,
  '/forgot-password': () => <ForgotPassword />,
  '/reset-password': () => <ResetPassword />,
  '/lobby': () => <LudoLobby />,
  '/lobby/table': () => <Lobby />,
  '/game': () => <Game />,
  '/results': () => <Results />,
}

/** Public routes, can be reached wihout a session */
const PUBLIC_ROUTES = new Set(['/login', '/signup', '/2fa', '/forgot-password', '/reset-password'])

function Screen() {
  const { path, query } = useRoute()
  const { user, authReady } = useApp()
  const known = path in SHELL_ROUTES || path in FULL_ROUTES
  const isPublic = PUBLIC_ROUTES.has(path)
  // Account-action arrivals via link/redirect: a result notice (verified /
  // reset / error) or a one-time token (a reset or 2FA link). These belong to a
  // *specific account action*, not the logged-in session, so a logged-in user
  // must still see them instead of being bounced to /home — e.g. verifying (or
  // resetting) account B while account A happens to be logged in in this browser.
  const hasNotice = !!(
    query.get('verified') ||
    query.get('reset') ||
    query.get('error') ||
    query.get('token')
  )

  useEffect(() => {
    // Wait for the /me session check. Else, a refresh while logged in
    // would bounce to /login before the cookie has been verified
    if (!authReady) return
    if (!known) navigate(user ? '/home' : '/login', { replace: true })
    else if (!user && !isPublic) navigate('/login', { replace: true })
    else if (user && isPublic && !hasNotice) navigate('/home', { replace: true })
  }, [authReady, known, user, isPublic, hasNotice])

  if (!authReady) return null
  if (!known || (!user && !isPublic) || (user && isPublic && !hasNotice)) return null

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
