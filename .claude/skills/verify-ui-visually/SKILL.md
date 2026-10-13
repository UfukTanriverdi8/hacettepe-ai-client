---
name: verify-ui-visually
description: See a UI change working in a real browser. Builds the app to a scratch directory, serves it against a mock NDJSON /chat on a free port, and drives it with Playwright (clicks, touch, screenshots, comparison with the previous commit). Use for layout, animation, streaming, touch or any "does it work in the browser" claim, before saying a UI change works. Needs no AWS and no real backend.
---

Everything below lives in `.claude/skills/verify-ui-visually/scripts/`. Set `K` to that path. The lint, typecheck and `check:*` scripts say nothing about what renders, so run those separately.

## 1. Pick ports, leave the real backend alone

Mock on `:8010`, preview on `:4301` (a second build on `:4302`). Check first what holds a port: `ss -ltnp | grep ':8010 '`. `:8000` often belongs to a real backend or another project's service, so never use it or kill it. A `/chat` POST through the dev proxy lands on whatever listens there.

## 2. Build to a scratch directory

`dist/` is what `cdk deploy` uploads, so build elsewhere:

```bash
export VERIFY_REPO=$PWD VERIFY_OUT=<scratch>/dist VERIFY_PORT=4301 VERIFY_BACKEND=8010
npx vite build --config $K/preview.config.mjs
```

This skips `tsc`, so run `npm run typecheck` as well.

## 3. Start the mock and the preview

```bash
node $K/mock-chat.mjs --port 8010 --mode answer &    # answer | slow | error | fallback
npx vite preview --config $K/preview.config.mjs &    # same VERIFY_* variables
```

`preview` only proxies `/chat` because the config sets it again, so the same mock drives a full streamed answer. Use another mock mode to exercise the error and the "tool loop ran out" paths.

To prove streaming is unbuffered, run `slow` mode and read the stream with per-line timestamps. Do not put `head` in that pipe, it buffers its output:

```bash
start=$(date +%s.%N)
curl -sN -XPOST localhost:8010/chat -d '{"message":"x"}' | while read -r l; do
  printf '%5.2fs %s\n' "$(echo "$(date +%s.%N) - $start" | bc)" "${l:0:60}"; done
```

## 4. Drive it

```js
import { launch } from '<repo>/.claude/skills/verify-ui-visually/scripts/browser.mjs'
const browser = await launch()
```

`launch()` finds Playwright (npx cache) and the newest cached Chromium, so no paths are hard-coded. Notes from past runs:
- Wait about 600ms after focusing a button before a screenshot. `transition-all` fades the focus ring in.
- Touch: `browser.newContext({ hasTouch: true, isMobile: true })` and `locator.tap()`. A link opened from the sandbox ends on `chrome-error://`: the tab opened, the external host is unreachable.
- Animations: sample computed `opacity` and `transform` per frame from `requestAnimationFrame` in an `addInitScript`, and emulate `reducedMotion: 'reduce'` as well.
- Wait for the right thing. A feedback pill from an earlier answer already exists, so waiting on "the last pill" captures a later question too early.
- Language is `localStorage['ui-language']` (`TR` or `EN`), set in `addInitScript`.

## 5. Compare against the previous commit (visual parity)

```bash
git worktree add <scratch>/base HEAD~1 && (cd <scratch>/base && npm ci)
```

Build it with `VERIFY_REPO=<scratch>/base VERIFY_OUT=<scratch>/dist-base VERIFY_PORT=4302`, preview both on their own ports against the same mock, and screenshot the same states in each.

## 6. Clean up, and report what was exercised

```bash
sh $K/stop-port.sh 8010 4301 4302      # only ports this run started
git worktree remove --force <scratch>/base
```

Say what ran against the mock and what was not exercised: the real backend, the deployed site, other browsers. The mock sends a scripted stream, not the real pacing or the real sources.
