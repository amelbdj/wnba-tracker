import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { NCAA_UPSTREAM, resolveVolleyballRequest } from './api/ncaa/_lib/volleyball.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      // Same endpoint the Vercel function serves in production
      // (api/ncaa/volleyball.js), so the app works under `npm run dev`.
      '/api/ncaa/volleyball': {
        target: NCAA_UPSTREAM,
        changeOrigin: true,
        rewrite: (path) => {
          const query = Object.fromEntries(new URL(path, 'http://localhost').searchParams)
          return resolveVolleyballRequest(query)?.path ?? '/__invalid__'
        },
      },
    },
  },
})
