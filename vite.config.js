import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single source of truth for the version: package.json. Substituted into the bundle at build
// time so a deployed build can identify itself, the way the backend's /healthz does -- without
// it the only handle on "which build is live" is the hashed asset filename.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// In production the SPA and the API share one CloudFront distribution, so /chat and /feedback
// are same-origin paths. This proxy reproduces that in dev against a local uvicorn, which keeps
// config.json identical everywhere and keeps CORS out of the picture entirely.
// Run alongside, in hacettepe-ai-backend: `ORIGIN_VERIFY_SECRET= uv run uvicorn app.main:app --reload`.
// The empty secret matters: .env sets the real one, and without CloudFront's header every /chat gets a 403.
const backend = 'http://localhost:8000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Textual replacement, so the value has to arrive as a JSON string literal.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    proxy: {
      '/chat': backend,
      '/healthz': backend,
      '/feedback': backend,
    },
  },
})
