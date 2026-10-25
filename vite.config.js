import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import ncaaVolleyball from './api/ncaa/volleyball.js'

// Serves the Vercel function api/ncaa/volleyball.js under `npm run dev`, so
// local development runs the very same code (throttling, retries, caching
// headers) as production instead of a lookalike proxy.
function ncaaApi() {
  return {
    name: 'ncaa-volleyball-api',
    configureServer(server) {
      server.middlewares.use('/api/ncaa/volleyball', async (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const response = Object.assign(res, {
          status(code) {
            res.statusCode = code
            return res
          },
          json(body) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(body))
          },
        })
        await ncaaVolleyball(
          { method: req.method, query: Object.fromEntries(url.searchParams) },
          response,
        )
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    ncaaApi(),
  ],
})
