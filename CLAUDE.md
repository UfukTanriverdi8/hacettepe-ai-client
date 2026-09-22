# Hacettepe AI Client - Project Context

## Git Commits
Never add a "Co-Authored-By: Claude..." line or any other self-attribution to commit messages.

Work lands on `dev`, then a PR to `main` (the default branch). Never commit to `main` directly.
No CI — there is no `.github` directory, so a PR is not checked by anything automated.

## Project Overview
Single-page React chatbot application for Hacettepe University AI assistant.
Built with Vite + React 18 + Tailwind CSS. Deployed to S3 + CloudFront by
`HacettepeAiFrontendStack` in `../hacettepe-ai-backend`, which uploads this repo's `dist/` and
fronts the backend Lambda on the same distribution.

## Architecture

### Component Tree
```
App.jsx                         # Root: global state, layout
├── LoadingScreen.jsx            # Shown while /config.json is loading
├── ConfigErrorScreen.jsx        # Shown if /config.json fails to load (manual retry)
├── Header.jsx                  # Branding, language toggle
├── ChatConversations.jsx       # Scrollable message list container
│   └── ChatMessage.jsx         # Message bubble; picks one of three text-reveal mechanisms
│       └── FeedbackModal.jsx   # 5-star feedback modal (shown per AI message)
├── ChatInput.jsx               # Input field, send/clear, API calls
├── Footer.jsx                  # Social links, info button
└── InfoModal.jsx               # Project info popup
```

`Chatbot.jsx` is a legacy/unused component.

Hooks in `src/hooks/`:
- `useSmoothedText.js` — reveals a streamed answer at a steady rate regardless of how unevenly
  the network delivers it. See the API Integration section.
- `useCyclingText.js` — the typewriter loop behind the placeholder and `LoadingScreen.jsx`.

## State Management
No external state library — all prop-drilled from `App.jsx` with `localStorage` persistence.

**App.jsx global state:**
- `chatHistory` — array of message objects (persisted to localStorage)
- `language` — `'EN' | 'TR'` (persisted)
- `config` — fetched once from `/config.json` via `loadConfig()` (`src/config.js`); gates rendering behind `LoadingScreen`/`ConfigErrorScreen` until resolved
- `openModal` — boolean

**Message object shape:**
```js
{
  sender: 'Human' | 'AI',
  message: string,
  isPlaceholder?: boolean,   // true until the first `token` event, and true again after a
                             // `discard` retracts the tokens that already arrived
  skipTypewriter?: boolean,  // set on everything except the greeting; ChatMessage reads it as
                             // "do not run the fixed-rate typewriter"
  id?: number,               // used to patch the placeholder as stream events arrive
  status?: string,           // localized status text, shown while isPlaceholder is true
  timestamp?: string,        // DynamoDB sort key from the `done` event — gates the feedback button
  question?: string,         // the user's original question
  session_id?: string,       // from the `session` event — the feedback DynamoDB partition key
}
```

## API Integration (ChatInput.jsx)

One backend: the FastAPI service in `../hacettepe-ai-backend`, fronted by the same CloudFront
distribution that serves this SPA. `/chat` and `/feedback` are therefore **same-origin paths**,
not absolute URLs — no CORS preflight anywhere. Paths come from `/config.json` as `chatUrl` and
`feedbackUrl`, passed to `ChatInput.jsx` and (via `ChatConversations` → `ChatMessage`) to
`FeedbackModal.jsx`.

### Chat — `POST {chatUrl}`

Request: `{ message, session_id? }`. `session_id` is omitted on the first question of a
conversation; the server mints one and returns it in the stream's first event.

Response: **NDJSON**, one JSON object per line, `Content-Type: application/x-ndjson`. Read with
`response.body.getReader()`, not `response.json()`.

| `type` | Payload | Client action |
|---|---|---|
| `session` | `session_id` | store in state + `localStorage`; sent first, before any model work |
| `status` | `message` (English) | localize via `STATUS_TEXT`, show in place of the cycling placeholder |
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

**Session management:** `session_id` lives in `localStorage` under `session_id`. Cleared on
language switch and on "Clear chat". History is replayed server-side from DynamoDB, so the
client sends only the new question — follow-up questions work without sending prior turns.

**Constraints:** Max 30 messages (15 exchanges), below the server's 25-exchange replay window.

## Feedback System (FeedbackModal.jsx)

- Triggered by "💬 Geri bildirimde bulun" button shown on AI messages after typing completes
- Button has a wiggle animation (`feedback-emoji-wiggle` CSS class) on appearance
- Requires `timestamp` to be present on the message
- Hidden after submission (`feedbackSubmitted` state in ChatMessage)
- Modal contains:
  - 5-star rating with half-star support (0.5 increments via left/right half-hover)
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
- Tailwind CSS v3 with custom colors in `tailwind.config.js`:
  - `primary`: `#050609` (near-black bg)
  - `secondary`: `#b72e2e` (brand red)
  - `secondary-red`: `#b5172f` (hover state red)
  - `tertiary`: `#EDF2F4` (light gray text)
  - `black`: `#1c1c1c` (card/input bg)
  - `white-text`: `#ffffff`
- Custom CSS in `index.css`: `.scrollable`, `.scroll-container`, `.custom-toast`, `.feedback-emoji-wiggle`
- `feedback-emoji-wiggle`: one-shot damped rotation (8° → 6° → 3°) on feedback button appearance, respects `prefers-reduced-motion`
- Responsive breakpoints: `sm:`, `md:` via Tailwind

## Key Libraries
| Library | Purpose |
|---|---|
| `react-markdown` + `remark-gfm` | Render AI responses as Markdown |
| `typewriter-effect` | Animated title in Header |
| `react-icons` | UI icons (FaUser, FaStar, FaStarHalfStroke, GiDeerHead, etc.) |
| `react-toastify` | Toast notifications |
| Vite | Build tool + dev server |

## Runtime Config (`/config.json`)
API paths come from `public/config.json` (dev) or a CDK-deployed `config.json` (CloudFront),
fetched via `src/config.js`'s `loadConfig()` — **not** Vite env vars (removed; `.env`'s
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
npm run build    # production build
npm run preview  # preview production build
npm run lint     # ESLint
```

`npm run lint` **fails at baseline** — 38 problems on a clean tree, almost all `react/prop-types`
plus a few unused imports. Compare counts before and after a change rather than expecting zero.

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
  `advance()` over simulated chunky arrivals. It exists because the reveal math fails quietly:
  a step that never quite reaches the goal drops the last characters of every answer, which is
  easy to miss by eye.
- The NDJSON stream reader was proven the same way, against 1-byte chunks — which splits every
  line and every multi-byte UTF-8 character.
- Wire behavior → a mock NDJSON server on `:8000` + `curl -sN | while read` with per-line
  timestamps. Exercises the dev proxy and proves streaming is unbuffered, with no AWS.

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
time via Vite `define` as `__APP_VERSION__`, and rendered in `InfoModal.jsx`. Bump it *before*
building, or two different builds report the same version. The hashed asset filename in
`index.html` is the fallback identifier and is always exact.

## Claude Code Hooks (`.claude/settings.json`)
- Any Edit/Write to `.jsx`/`.js` auto-runs `eslint --fix` afterward — no need to manually re-lint a file you just edited.
- Edits to `.env`/`.env.*` are blocked by a PreToolUse hook — ask the user to change it. The file is vestigial: nothing in `src/` reads `VITE_*`, and the hook's own message ("holds live backend URLs") is out of date.

## Notable Conventions
- All components are functional with hooks
- Semicolons are mostly omitted; `ChatInput.jsx` and `ChatConversations.jsx` are mixed.
  Match the file you are editing — ESLint enforces neither.
- Three ways text reaches the screen, deliberately three different mechanisms:
  - **Greeting / initial messages** (no `skipTypewriter`): 25ms/char one-shot typewriter, in
    `ChatMessage.jsx` itself. It is the one message whose full text exists when it mounts, which
    is why a fixed rate suits it and why it is the only case still handled there.
  - **Streamed answers**: `src/hooks/useSmoothedText.js`, revealing toward whatever the server
    has sent so far. Do **not** try to serve this with the greeting's typewriter — that effect
    restarts from character zero whenever `message` changes, so across a few hundred token
    events it would stutter from the start forever instead of advancing.
  - **History, human turns, error messages**: instant. `useSmoothedText` distinguishes these
    from a streamed answer by whether the text was already there when the component mounted, so
    no flag is threaded through `ChatInput` or persisted to `localStorage` for it.
- **Placeholder**: `LOADING_MESSAGES` cycled by `src/hooks/useCyclingText.js` (reusable; also
  used by `LoadingScreen.jsx`) at 45ms/char, 220ms for dots, 700ms between messages. It holds
  only `'🤔 Düşünüyor...'`, because it runs on a timer with no connection to the backend and can
  only honestly claim the question was sent. It previously also cycled
  `'🦌 Hacettepe kaynakları taranıyor...'` and `'🧑‍🍳 Cevap üretiliyor...'`, which named states the
  server reports for real — so it regularly announced "generating the answer" while the model
  was still searching. Covers roughly the first 5s, until the first `status` event takes over.
- `GiDeerHead` icon (react-icons/gi) used as AI avatar; `FaStar`/`FaStarHalfStroke` for feedback rating
- `dangerouslySetInnerHTML` used only in `InfoModal.jsx` for controlled bilingual HTML content
- No routing — single view SPA
- Language switch clears chat history and `session_id` (with confirmation dialog if history exists)
