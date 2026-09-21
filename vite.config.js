import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In production the SPA and the API share one CloudFront distribution, so /chat and /feedback
// are same-origin paths. This proxy reproduces that in dev against a local uvicorn, which keeps
// config.json identical everywhere and keeps CORS out of the picture entirely.
// Run alongside: `uv run uvicorn app.main:app --reload` in hacettepe-ai-backend.
const backend = 'http://localhost:8000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/chat': backend,
      '/healthz': backend,
      '/feedback': backend,
    },
  },
})
