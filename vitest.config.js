import { defineConfig } from 'vitest/config'

// Unit tests cover the plain-JS logic (utils, services, the API function) —
// no DOM and no React rendering, so they run in Node and take a second or two.
export default defineConfig({
  test: {
    include: ['src/**/*.test.js', 'api/**/*.test.js'],
    environment: 'node',
  },
})
