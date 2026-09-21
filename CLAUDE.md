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
│   └── ChatMessage.jsx         # Individual message bubble + typewriter effect
│       └── FeedbackModal.jsx   # 5-star feedback modal (shown per AI message)
├── ChatInput.jsx               # Input field, send/clear, API calls
├── Footer.jsx                  # Social links, info button
└── InfoModal.jsx               # Project info popup
```

`Chatbot.jsx` is a legacy/unused component.

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
  isPlaceholder?: boolean,   // true until the first `token` event arrives
  skipTypewriter?: boolean,  // skip animation for history messages and streamed responses
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
| `done` | `timestamp?` | store as the feedback key; absent when the server's write failed |
| `error` | `message` | show it in place of the placeholder; do not throw |

Two framing details in the reader are load-bearing. `buffer = lines.pop()` holds back the
trailing fragment, because chunk boundaries land wherever TCP puts them rather than on newlines.
`decoder.decode(value, { stream: true })` does the same for an incomplete UTF-8 sequence, which
Turkish text hits routinely.

`token` appends rather than assigns. The backend currently emits the whole answer as one event
(`app/agent/loop.py`), so the two look identical today — appending makes the eventual
`converse_stream` switch a backend-only change.

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

`npm run lint` **fails at baseline** — 39 problems on a clean tree, almost all `react/prop-types`
plus a few unused imports. Compare counts before and after a change rather than expecting zero.

Full-stack dev needs the backend running alongside:
```bash
cd ../hacettepe-ai-backend && uv run uvicorn app.main:app --reload
```
`ORIGIN_VERIFY_SECRET` unset locally makes the origin check a no-op, so no header is needed.
Vite's proxy does not buffer, so streaming is visible in dev.

## Testing
No test runner (no `test` script, no vitest/jest). What worked for the NDJSON migration:
- Pure logic → a standalone `node script.mjs`; the stream reader was proven against 1-byte
  chunks, which splits every line and every multi-byte UTF-8 character.
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

## Claude Code Hooks (`.claude/settings.json`)
- Any Edit/Write to `.jsx`/`.js` auto-runs `eslint --fix` afterward — no need to manually re-lint a file you just edited.
- Edits to `.env`/`.env.*` are blocked by a PreToolUse hook — ask the user to change it. The file is vestigial: nothing in `src/` reads `VITE_*`, and the hook's own message ("holds live backend URLs") is out of date.

## Notable Conventions
- All components are functional with hooks
- Semicolons are mostly omitted; `ChatInput.jsx` and `ChatConversations.jsx` are mixed.
  Match the file you are editing — ESLint enforces neither.
- Typewriter animation:
  - **Placeholder**: cycles through `LOADING_MESSAGES` (Turkish strings) at 45ms/char, 220ms for dots, 700ms pause between messages
    — logic lives in `src/hooks/useCyclingText.js` (reusable; also used by `LoadingScreen.jsx`).
    Covers roughly the first 3.5s, until the first `status` event replaces it with what the
    server is actually doing
  - **Real AI responses**: instant display (`skipTypewriter: true` set by `ChatInput`)
  - **Greeting / initial messages** (no `skipTypewriter`): 25ms/char one-shot typewriter
  - **History on load**: instant display (`skipTypewriter: true` set by `App.jsx`)
- `GiDeerHead` icon (react-icons/gi) used as AI avatar; `FaStar`/`FaStarHalfStroke` for feedback rating
- `dangerouslySetInnerHTML` used only in `InfoModal.jsx` for controlled bilingual HTML content
- No routing — single view SPA
- Language switch clears chat history and `session_id` (with confirmation dialog if history exists)
