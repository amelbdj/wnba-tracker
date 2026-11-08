import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import ncaaVolleyball from './api/ncaa/volleyball.js'
import shareHandler from './api/share.js'

// Serves the Vercel functions in api/ under `npm run dev`, so local
// development runs the very same code (throttling, retries, caching headers,
// link-preview pages) as production instead of a lookalike.
const FUNCTIONS = {
  '/api/ncaa/volleyball': ncaaVolleyball,
  '/api/share': shareHandler,
  // loaded on first use: it pulls in the image renderer (satori + resvg)
  '/api/og': async (req, res) => (await import('./api/og.js')).default(req, res),
}

function localApi() {
  return {
    name: 'local-vercel-functions',
    configureServer(server) {
      for (const [route, handler] of Object.entries(FUNCTIONS)) {
        server.middlewares.use(route, async (req, res) => {
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
            send(body) {
              res.end(body)
            },
          })
          await handler(
            { method: req.method, headers: req.headers, query: Object.fromEntries(url.searchParams) },
            response,
          )
        })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    localApi(),
  ],
})
