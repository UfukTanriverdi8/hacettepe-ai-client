// Launches Chromium through Playwright wherever this machine keeps them, so a driving script
// does not hard-code paths.
//
//     import { launch } from '<this file>'
//     const browser = await launch()
//
// Playwright is not a dependency of this repo. It comes from the npx cache (any
// ~/.npm/_npx/*/node_modules/playwright, populated by a previous `npx playwright ...`), or from
// the repo's own node_modules if it was installed there. The cached playwright can want a newer
// browser build than the one downloaded, so the newest Chromium under ~/.cache/ms-playwright is
// passed explicitly as `executablePath`.

import { createRequire } from 'node:module'
import { existsSync, readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const home = os.homedir()

const newestFirst = (dirs) => dirs.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

const playwrightRoots = () => {
    const npx = path.join(home, '.npm', '_npx')
    const cached = existsSync(npx) ? readdirSync(npx).map((dir) => path.join(npx, dir, 'node_modules')) : []
    return [path.join(process.cwd(), 'node_modules'), ...cached].filter((dir) => existsSync(path.join(dir, 'playwright')))
}

const chromiumPath = () => {
    const cache = path.join(home, '.cache', 'ms-playwright')
    if (!existsSync(cache)) return undefined
    for (const dir of newestFirst(readdirSync(cache).filter((name) => /^chromium-\d+$/.test(name)))) {
        const exe = path.join(cache, dir, 'chrome-linux64', 'chrome')
        if (existsSync(exe)) return exe
    }
    return undefined
}

export async function launch(options = {}) {
    const [root] = playwrightRoots()
    if (!root) throw new Error('Playwright not found. Run `npx playwright --version` once to cache it.')
    const { chromium } = createRequire(path.join(root, 'noop.js'))('playwright')
    return chromium.launch({ executablePath: chromiumPath(), ...options })
}
