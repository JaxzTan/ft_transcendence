import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Inside compose the backend/engine resolve as `backend`/`ludo-engine`; running
// `npm run dev` on the host they're on their published ports instead. Both
// proxies mirror the location blocks in nginx/conf/app.inc so all three paths
// (nginx, this dev server, and — for the engine — direct docker DNS) behave
// the same and the browser never needs to know the engine's real address.
const inContainer = process.env.VITE_IN_CONTAINER === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 8080,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.VITE_ENGINE_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
    // Bind mounts on macOS don't deliver inotify events reliably, so file
    // changes only reach HMR via polling when containerised.
    watch: inContainer ? { usePolling: true, interval: 300 } : undefined,
  },
})
