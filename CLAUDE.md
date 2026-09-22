# Hacettepe AI Client - Project Context

## Git Commits
Never add a "Co-Authored-By: Claude..." line or any other self-attribution to commit messages.

Work lands on `dev`, then a PR to `main` (the default branch). Never commit to `main` directly.
No CI: `.github` holds only the PR template, so a PR is not checked by anything automated.
Write PR bodies to `.github/PULL_REQUEST_TEMPLATE.md`'s sections.

## Project Overview
Single-page React chatbot application for Hacettepe University AI assistant.
Built with Vite + React 18 + TypeScript (strict) + Tailwind CSS v4 + shadcn/ui (Radix). Deployed to S3 + CloudFront by
`HacettepeAiFrontendStack` in `../hacettepe-ai-backend`, which uploads this repo's `dist/` and
fronts the backend Lambda on the same distribution.

## Architecture

### Component Tree
```
App.tsx                         # Root: global state, layout, the empty-chat greeting
├── LoadingScreen.tsx            # Shown while /config.json is loading
├── ConfigErrorScreen.tsx        # Shown if /config.json fails to load (manual retry)
├── Header.tsx                  # Wordmark; new chat, settings and info buttons
│   └── SettingsMenu.tsx        # Popover: theme (system/light/dark) and UI language
├── ChatConversations.tsx       # Scrollable message list container
│   └── ChatMessage.tsx         # Question pill or answer; streamed answers go through useSmoothedText
│       └── FeedbackModal.tsx   # 5-star feedback dialog (shown per AI message)
├── ChatInput.tsx               # The composer: input, send, API calls
├── InfoModal.tsx               # About dialog: project text, GitHub link, version
└── NewChatDialog.tsx           # Confirms clearing the chat and the session
```
`DeerMark.tsx` is the stroke-drawn deer used as avatar and logo. `src/components/ui/` holds
generated shadcn components; see the shadcn section below.

Hooks in `src/hooks/`:
- `useSmoothedText.ts` — reveals a streamed answer at a steady rate regardless of how unevenly
  the network delivers it. See the API Integration section.
- `useCyclingText.ts` — the typewriter loop behind the placeholder and `LoadingScreen.tsx`.
- `useSettings.ts` — theme and UI language: state, `localStorage`, the `.dark` class and
  `<html lang>`.

`src/statusText.ts` maps each backend status string (`app/agent/tool_specs.py`) to TR/EN text
and a lucide icon (`Search`, `Globe`, `BookOpen`). Messages store the raw string and are worded
at render time, so a language switch mid-answer re-words the line. An unmapped status shows
raw, with the deer. Add new backend statuses here.

## State Management
No external state library — all prop-drilled from `App.tsx` with `localStorage` persistence.

**App.tsx global state:**
- `chatHistory` — array of message objects (persisted to localStorage). Empty means the empty
  chat: greeting and composer centered. See Layout below.
- `sessionId` — lives here, not in `ChatInput`, because the header's new-chat button clears it
- `theme`, `language` — from `useSettings()`. `language` changes interface text only, never how
  the model answers (it answers in the language of the question).
- `config` — fetched once from `/config.json` via `loadConfig()` (`src/config.ts`); gates rendering behind `LoadingScreen`/`ConfigErrorScreen` until resolved
- `infoOpen`, `newChatOpen` — dialog state

**Settings storage.** `theme` (`system`/`light`/`dark`) and `ui-language` (`TR`/`EN`) in
`localStorage`. An inline script in `index.html` reads both before the bundle loads, so a dark
first paint never flashes white; it mirrors `useSettings.ts`, so change them together.
`useSettings` also deletes the old `language` key, left by the EN/TR toggle removed in 2.3.0.

**Layout.** The empty chat and the conversation are one tree. Two spacer divs around the
composer carry the flex growth on an empty chat and hand it to `ChatConversations` once there is
a message, which slides the composer from the middle to the bottom. `ChatInput` must never
remount: it holds the in-flight stream and the loading flag, and swapping between two layouts
on the first question would drop both.

**Shared types live in `src/types.ts`**: `Message` (one chat-history entry, with each optional
field's meaning commented), `StreamEvent` (the NDJSON event union below), `AppConfig` and
`Language`. That file is the source of truth for these shapes; this document does not repeat
them.

## API Integration (ChatInput.tsx)

One backend: the FastAPI service in `../hacettepe-ai-backend`, fronted by the same CloudFront
distribution that serves this SPA. `/chat` and `/feedback` are therefore **same-origin paths**,
not absolute URLs — no CORS preflight anywhere. Paths come from `/config.json` as `chatUrl` and
`feedbackUrl`, passed to `ChatInput.tsx` and (via `ChatConversations` → `ChatMessage`) to
`FeedbackModal.tsx`.

### Chat — `POST {chatUrl}`

Request: `{ message, session_id? }`. `session_id` is omitted on the first question of a
conversation; the server mints one and returns it in the stream's first event.

Response: **NDJSON**, one JSON object per line, `Content-Type: application/x-ndjson`. Read with
`response.body.getReader()`, not `response.json()`.

| `type` | Payload | Client action |
|---|---|---|
| `session` | `session_id` | store in state + `localStorage`; sent first, before any model work |
| `status` | `message` (English) | store raw; `ChatMessage` shows it via `describeStatus` (`src/statusText.ts`): localized text, plus that step's icon in place of the deer |
| `token` | `text` | **append** to the accumulated answer, clear `isPlaceholder` |
| `discard` | — | drop every token so far; back to `isPlaceholder` with the last status |
| `done` | `timestamp?` | store as the feedback key; absent when the server's write failed |
| `error` | `message` | show it in place of the placeholder; do not throw |

Two framing details in the reader are load-bearing. `buffer = lines.pop()` holds back the
trailing fragment, because chunk boundaries land wherever TCP puts them rather than on newlines.
`decoder.decode(value, { stream: true })` does the same for an incomplete UTF-8 sequence, which
Turkish text hits routinely.

`token` appends rather than assigns: the backend emits one event per text delta, a few hundred
per answer (`app/agent/loop.py`).

Those events still do not reach the browser perfectly evenly, and `useSmoothedText` absorbs the
unevenness by keeping the text the server has sent apart from the text on screen and closing
the gap on a 33ms timer. It fixes jitter, not absence. While the backend's guardrail ran in
`streamProcessingMode: "sync"` a 2001-character answer arrived in three bursts with a 6.18s
silence in the middle, and no reveal rate can spread three characters across six seconds — the
smoother looked broken and the guardrail was the cause. Backend 0.6.0 moved to `async`: ~38
arrival points about 0.3s apart for a 2028-character answer, which is the input this hook was
designed for.

`CATCH_UP_DIVISOR = 10` suits that pace. At ~60 characters every 0.3s the displayed text
settles about 60 characters behind, a third of a second, and the reveal stays continuous.

`discard` exists because the model sometimes narrates before calling a tool, and those words
are streamed before anything reveals a tool call is coming (`app/streaming.py` in the backend
spells out why they cannot be withheld). The client drops them and returns to the status line.
`lastStatus` is kept in `sendPrompt`'s closure for exactly this: the `token` handler nulls
`status`, so without it the bubble would fall back to the cycling placeholder for the moment
before the next status event lands.

**Call flow:**
1. Add human message to history
2. Add placeholder message with a unique ID (cycling animated loading messages)
3. `fetch` the stream, then patch that one placeholder repeatedly as events arrive
4. On `error`, or on any thrown failure, replace the placeholder with a visible message —
   never leave it cycling

**Session management:** `session_id` lives in `localStorage` under `session_id`. Cleared by
"New chat" (header, after `NewChatDialog` confirms). History is replayed server-side from DynamoDB, so the client sends only the new
question — follow-up questions work without sending prior turns.

**Constraints:** Max 30 messages (15 exchanges), below the server's 25-exchange replay window.

## Feedback System (FeedbackModal.tsx)

- Triggered by the "Geri bildirimde bulun" pill (lucide `MessageSquare` icon) shown on AI messages after the reveal completes
- Button has a wiggle animation (`feedback-icon-wiggle` CSS class) on appearance
- Requires `timestamp` to be present on the message
- Hidden after submission (`feedbackSubmitted` state in ChatMessage)
- Modal contains:
  - 5-star rating with half-star support (0.5 increments via left/right half-hover). The row
    is a `role="slider"`: arrow keys step by 0.5, Home/End jump to 0 and 5
  - Optional comment textarea
  - Bilingual TR/EN labels
- `POST {feedbackUrl}` — the fixed path from `/config.json`, not a per-message URL
- Request body: `{ session_id, timestamp, feedback_value: 'Positive'|'Negative', rating: 0-10, feedback_reason? }`
  - `feedback_value`: `'Positive'` if stars ≥ 3, else `'Negative'`
  - `rating`: stars × 2 (0–5 star scale → 0–10 integer)
- A non-2xx response raises an error toast. The endpoint answers **404** when
  `(session_id, timestamp)` matches no stored exchange — aged out under the 180-day TTL, or
  never written. Thanking the user for a rating that went nowhere is the failure to avoid here.

## Styling
- Tailwind CSS v4, configured CSS-first: no `tailwind.config.js`; the theme lives in
  `src/index.css`. It builds through `@tailwindcss/postcss`. v4 needs Safari 16.4+,
  Chrome 111+, Firefox 128+; older browsers get broken styles, not degraded ones.
- Colors are roles, shadcn-named, each defined twice in `index.css`: under `:root` (light) and
  `.dark`. Components use the role (`bg-background`, `text-muted-foreground`, `bg-primary`),
  never a hex value. `--color-*: initial` in `@theme inline` removes Tailwind's palette, so
  `bg-gray-800` and the like compile to nothing.
  - `primary` is Hacettepe red: `#b72e2e` light, `#d8494a` dark (lifted for contrast)
  - `secondary` is the question pill, `muted` the composer and hover fills, `popover` anything
    raised (menus, dialogs), `star` the rating
- Dark mode is the `.dark` class on `<html>` (`@custom-variant dark`), never
  `prefers-color-scheme` directly, so the user's explicit choice wins over the OS.
- Font: IBM Plex Sans 400/500/600 from `@fontsource`, imported in `main.tsx`. It cannot be
  `@import`-ed from `index.css`: Tailwind's PostCSS plugin inlines the file but leaves its
  relative `url()`s pointing at font files Vite never copies, and the font silently falls back.
- `.markdown` in `index.css` styles answers (lists, links, tables, code). The typography plugin
  is not installed; Tailwind's preflight otherwise strips list bullets.
- Scrollbar: global in `@layer base`, thin, thumb `--scrollbar`, no track.
- `feedback-icon-wiggle`: one-shot damped rotation (8° → 6° → 3°) on feedback button
  appearance. `animate-breathe` pulses the deer while an answer is pending. Both respect
  `prefers-reduced-motion`.

## shadcn/ui
`components.json` + `src/components/ui/`. Add a component with `npx shadcn@latest add <name>`;
the files are ours to edit. Style `radix-nova`, primitives from the `radix-ui` package, icons
from `lucide-react`, class merging from `cn` (shadcn's own package).

shadcn now generates for React 19, where `ref` is an ordinary prop. On React 18 a plain function
component drops it, so a generated component used as a Radix `asChild` trigger never passes
its DOM node up, and the popover or tooltip it opens stays unpositioned at
`translate(0, -200%)`, off-screen. A wrapper that Radix clones a ref onto fails the same way,
with a dev-only "Function components cannot be given refs" warning: `DialogOverlay` inside the
portal, or `PopoverTrigger` nested in `TooltipTrigger asChild`. Wrapped in `React.forwardRef`
so far: `Button`, `PopoverTrigger`, `TooltipTrigger`, `DialogTrigger`, `DialogClose`,
`DialogOverlay`. Do the same to any new wrapper in one of those positions, re-apply after
`shadcn add --overwrite`, and check the dev server's console, since production builds are
silent about it.

`react-refresh/only-export-components` is off for `src/components/ui/**`, which exports
variant helpers beside components the way upstream does.

## Key Libraries
| Library | Purpose |
|---|---|
| `react-markdown` + `remark-gfm` | Render AI responses as Markdown |
| `radix-ui` (via shadcn) | Dialog, Popover, ToggleGroup, Tooltip: focus, Esc, ARIA |
| `lucide-react` | Interface icons |
| `react-icons` | Only what lucide lacks: `FaStar`/`FaStarHalfStroke`, `FaGithub` |
| `react-toastify` | Toast notifications |
| Vite | Build tool + dev server |

## Runtime Config (`/config.json`)
API paths come from `public/config.json` (dev) or a CDK-deployed `config.json` (CloudFront),
fetched via `src/config.ts`'s `loadConfig()` — **not** Vite env vars (removed; `.env`'s
`VITE_*` keys are no longer read anywhere).
```
{ "chatUrl": "/chat", "feedbackUrl": "/feedback" }
```
Three copies of this file exist, and **one lives in the other repo**:

| File | Repo |
|---|---|
| `public/config.json` | client (dev) |
| `config.example.json` | client (reference) |
| `infra/frontend/config/config.json` | **backend** — this is the one deployed users receive |

The backend copy is uploaded by `HacettepeAiFrontendStack` from a directory outside the Vite
build, so changing it needs a re-upload but no frontend rebuild. Miss it and the deployed SPA
posts to `undefined`.

No API keys. The endpoints are public, protected by WAF rate limiting and an origin-verify
header that CloudFront adds.

## Dev Commands
```bash
npm run dev      # start dev server (proxies /chat, /healthz, /feedback to localhost:8000)
npm run build    # type-check (tsc), then production build; a type error fails it
npm run typecheck # tsc alone
npm run preview  # preview production build
npm run lint     # ESLint
```

`npm run lint` passes with zero problems; treat any new one as a regression. `react/prop-types`
is off in `eslint.config.js`, since TypeScript checks props. The `typescript-eslint` presets come
last in that file and apply to `src` only: placed first, the base `no-undef` and
`no-unused-vars` rules override them and misfire on type-only code.

`vite.config.js`, `eslint.config.js` and the scripts stay plain JavaScript; `tsconfig.json`
includes only `src`.

`npm install` warns that esbuild's postinstall is not approved. Harmless: the build works without
it. Leave it unapproved unless a build actually fails on esbuild.

Full-stack dev needs the backend running alongside:
```bash
cd ../hacettepe-ai-backend && uv run uvicorn app.main:app --reload
```
`ORIGIN_VERIFY_SECRET` unset locally makes the origin check a no-op, so no header is needed.
Vite's proxy does not buffer, so streaming is visible in dev.

## Testing
No test runner (no vitest/jest). Pure logic is checked by standalone Node scripts instead,
which is enough because the pieces worth checking have no DOM in them:
- `npm run check:smoothing` → `scripts/check-smoothing.mjs`, driving `useSmoothedText`'s
  `advance()` over simulated chunky arrivals. It imports `useSmoothedText.ts` directly, relying
  on Node's built-in type stripping (Node 22.18+), which is why `tsconfig.json` sets
  `erasableSyntaxOnly`: an `enum` in that file would break the script, not the build. It exists
  because the reveal math fails quietly: a step that never quite reaches the goal drops the last
  characters of every answer, which is easy to miss by eye.
- The NDJSON stream reader was proven the same way, against 1-byte chunks — which splits every
  line and every multi-byte UTF-8 character.
- Wire behavior → a mock NDJSON server on `:8000` + `curl -sN | while read` with per-line
  timestamps. Exercises the dev proxy and proves streaming is unbuffered, with no AWS.
- Visual parity → `git worktree add` the previous commit, `npm ci && npm run build` there, serve
  both builds with `vite preview` on two ports, and screenshot them with Playwright. `preview`
  inherits `server.proxy`, so the same `:8000` mock drives a full streamed answer in both.
  Wait ~600ms after focusing a button: `transition-all` fades the focus ring in.

## Deploy
Runs from `../hacettepe-ai-backend/infra`, which reads this repo's `dist/` — `npm run build` first.
```bash
cd ../hacettepe-ai-backend/infra && set -a && . ../.env && set +a && . .venv/bin/activate
npx --yes aws-cdk@2 deploy HacettepeAiFrontendStack
```
Both the `.env` source and the venv activation must be in the same shell as `npx`. `cdk.json`
runs bare `python app.py`, which exists only inside `.venv`; and synth builds *both* stacks,
so `ORIGIN_VERIFY_SECRET` and `BUDGET_ALERT_EMAIL` are required even for a frontend-only deploy.

`cdk deploy` bundles the **working tree**, not a git ref — what is deployed and what is
committed can diverge silently.

**Identifying a live build.** `package.json`'s version is substituted into the bundle at build
time via Vite `define` as `__APP_VERSION__`, and rendered in `InfoModal.tsx`. Bump it *before*
building, or two different builds report the same version. The hashed asset filename in
`index.html` is the fallback identifier and is always exact.

**Releases.** Bump the version in its own `chore:` commit on `dev` before opening the PR. Tags
(`vX.Y.Z`) go on the merge commit GitHub creates on `main`, which `dev` never contains, so
`git describe` on `dev` finds no tag. Read the current version from `package.json` or
`git tag --sort=-creatordate`. After the merge, merge `main` back into `dev` and push, or the
next PR is refused as "Head branch is out of date".

## Claude Code Hooks (`.claude/settings.json`)
- Any Edit/Write to `.ts`/`.tsx`/`.js`/`.jsx` auto-runs `eslint --fix` afterward — no need to manually re-lint a file you just edited.
- Edits to `.env`/`.env.*` are blocked by a PreToolUse hook — ask the user to change it. The file is vestigial: nothing in `src/` reads `VITE_*`, and the hook's own message ("holds live backend URLs") is out of date.

## Notable Conventions
- All components are functional with hooks
- Semicolons are mostly omitted; `ChatInput.tsx` and `ChatConversations.tsx` are mixed.
  Match the file you are editing — ESLint enforces neither.
- Two ways text reaches the screen:
  - **Streamed answers**: `src/hooks/useSmoothedText.ts`, revealing toward whatever the server
    has sent so far.
  - **History, human turns, error messages**: instant. `useSmoothedText` distinguishes these
    from a streamed answer by whether the text was already there when the component mounted, so
    no flag is threaded through `ChatInput` or persisted to `localStorage` for it.
  The greeting is not a chat message: it is static text in `App.tsx`'s empty state. (Until 3.0.0
  it was the first message and had its own 25ms/char typewriter, with a `skipTypewriter` flag
  on every other message; old `localStorage` histories may still carry that field. It is
  ignored.)
- **Placeholder**: `LOADING_MESSAGES` cycled by `src/hooks/useCyclingText.ts` (reusable; also
  used by `LoadingScreen.tsx`) at 45ms/char, 220ms for dots, 700ms between messages. One array
  per language, at module level: the hook restarts whenever the array's identity changes. It
  holds only `'Düşünüyor...'`, because it runs on a timer with no connection to the backend and can
  only honestly claim the question was sent. It previously also cycled
  `'🦌 Hacettepe kaynakları taranıyor...'` and `'🧑‍🍳 Cevap üretiliyor...'`, which named states the
  server reports for real — so it regularly announced "generating the answer" while the model
  was still searching. Covers roughly the first 5s, until the first `status` event takes over.
- No `dangerouslySetInnerHTML` anywhere; `InfoModal.tsx` keeps its text as paragraph arrays
- No routing — single view SPA
- The shell is zsh: an unquoted `$files` is one argument, not a list, and `$PIPESTATUS` does not
  exist. Loop explicitly or pass paths to `git restore --source=HEAD -- <paths>`; never pair
  a deleting step with a restoring step that relies on word-splitting.
