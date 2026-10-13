// A scratch Vite config for building and previewing this app against the mock backend, so that
// `dist/` (which `cdk deploy` uploads) and the real backend's port are both left alone.
//
//     VERIFY_REPO=<checkout> VERIFY_OUT=<dir> VERIFY_PORT=4301 VERIFY_BACKEND=8010 \
//       npx vite build --config preview.config.mjs
//     (same variables) npx vite preview --config preview.config.mjs
//
// VERIFY_REPO is the checkout to build, which is a worktree when comparing against an older commit.
// `vite preview` does not inherit `server.proxy` unless it is set again here, so it is.

import { pathToFileURL } from 'node:url'
import path from 'node:path'

const repo = path.resolve(process.env.VERIFY_REPO ?? process.cwd())
const { default: base } = await import(pathToFileURL(path.join(repo, 'vite.config.js')).href)
const backend = `http://localhost:${process.env.VERIFY_BACKEND ?? 8010}`

export default {
    ...base,
    root: repo,
    build: { outDir: path.resolve(process.env.VERIFY_OUT ?? path.join(repo, 'node_modules/.verify-dist')), emptyOutDir: true },
    preview: {
        port: Number(process.env.VERIFY_PORT ?? 4301),
        strictPort: true,
        proxy: { '/chat': backend, '/healthz': backend, '/feedback': backend },
    },
}
