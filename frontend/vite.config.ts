import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Inside compose the backend resolves as `backend`; running `npm run dev` on the
// host it's on the published port instead. The /api proxy mirrors the location
// block in nginx/conf/nginx.conf so both paths behave the same.
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
    },
    // Bind mounts on macOS don't deliver inotify events reliably, so file
    // changes only reach HMR via polling when containerised.
    watch: inContainer ? { usePolling: true, interval: 300 } : undefined,
  },
})
