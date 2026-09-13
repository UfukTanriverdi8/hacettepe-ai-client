# Hacettepe AI Client - Project Context

## Git Commits
Never add a "Co-Authored-By: Claude..." line or any other self-attribution to commit messages.

## Project Overview
Single-page React chatbot application for Hacettepe University AI assistant.
Built with Vite + React 18 + Tailwind CSS. Deployed on Digital Ocean.

## Architecture

### Component Tree
```
App.jsx                         # Root: global state, layout
├── LoadingScreen.jsx            # Shown while /config.json is loading
├── ConfigErrorScreen.jsx        # Shown if /config.json fails to load (manual retry)
├── Header.jsx                  # Branding, backend toggle, language toggle
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
- `activeBackend` — `'single_agent' | 'multi_agent'` (runtime toggle, NOT persisted — resets to `config.activeBackend` on reload)
- `openModal` — boolean

**Message object shape:**
```js
{
  sender: 'Human' | 'AI',
  message: string,
  isPlaceholder?: boolean,   // true while API is loading
  skipTypewriter?: boolean,  // skip animation for history messages and real API responses
  id?: number,               // used to replace placeholder with real response
  timestamp?: string,        // ISO string — present on all AI responses, used to gate feedback button
  question?: string,         // the user's original question — stored for feedback POST body
  session_id?: string,       // from API response — stored for feedback DynamoDB key
  apiUrl?: string,           // URL used for this response — feedback POSTs back to the same endpoint
}
```

## API Integration (ChatInput.jsx)

Backend is selected at **runtime** via `activeBackend` state (toggled in Header). Both backends share the same DynamoDB table and session. Both URLs come from `/config.json` (fetched by `App.jsx`), not env vars — passed down as `singleAgentApiUrl`/`multiAgentApiUrl` props to `ChatInput.jsx`.

### Single-agent backend (`activeBackend === 'single_agent'`)
- URL source: `config.singleAgentApiUrl` (from `/config.json`)
- Backend: AWS API Gateway HTTP API → Lambda
- Chat request: `POST` to the full URL in `VITE_SINGLE_AGENT_API_URL` (path, e.g. `/primitive`, is baked into the env var, not appended in code) `{ action: 'chat', prompt, session_id? }`
- Chat response: `{ response, session_id, timestamp }` (direct JSON)
- No API key required

### Multi-agent backend (`activeBackend === 'multi_agent'`)
- URL source: `config.multiAgentApiUrl` (from `/config.json`)
- Backend: AWS Lambda Function URL (multi-agent orchestrator)
- Chat request: `POST` to the full URL in `VITE_MULTI_AGENT_API_URL` (path is baked into the env var, not appended in code) `{ action: 'chat', prompt, session_id? }`
- Chat response: `{ statusCode, body: "<json string>" }` — must `JSON.parse(data.body)` to get `{ response, session_id, timestamp }`
- No API key required

**API call flow:**
1. Add human message to history
2. Add placeholder message with unique ID (cycling animated loading messages)
3. Fetch from active backend URL
4. Replace placeholder with real response (`skipTypewriter: true` — instant display)
5. Store `timestamp`, `question`, `session_id`, and `apiUrl` on the AI message

**Session management:** `session_id` stored in `localStorage` as `session_id`. Cleared on language switch and on "Clear chat". Both backends share the same DynamoDB so switching backends mid-conversation is seamless.

**Constraints:** Max 30 messages.

## Feedback System (FeedbackModal.jsx)

- Triggered by "💬 Geri bildirimde bulun" button shown on AI messages after typing completes
- Button has a wiggle animation (`feedback-emoji-wiggle` CSS class) on appearance
- Requires `timestamp` to be present on the message
- Hidden after submission (`feedbackSubmitted` state in ChatMessage)
- Modal contains:
  - 5-star rating with half-star support (0.5 increments via left/right half-hover)
  - Optional comment textarea
  - Bilingual TR/EN labels
- POSTs to the `apiUrl` stored on the message (same endpoint that generated the response)
- Request body: `{ action: 'feedback', session_id, timestamp, feedback_value: 'Positive'|'Negative', rating: 0-10, feedback_reason? }`
  - `feedback_value`: `'Positive'` if stars ≥ 3, else `'Negative'`
  - `rating`: stars × 2 (0–5 star scale → 0–10 integer)

## Backend Toggle (Header.jsx)

- Top-left of header: a fixed 48×48px box with red border
- Single agent: one 🤖 centered in the box
- Multi agent: three 🤖 arranged in a triangle (top-center, bottom-left, bottom-right)
- Animation: GPU-only — only `transform` and `opacity` animate (no layout reflow). Robots are always at `top: 50%; left: 50%`; movement encoded as `translate()` offsets; size change via `scale(0.65)`.
- `willChange: 'transform, opacity'` set on each robot span
- Label below the box shows current mode, changes on toggle

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
Backend URLs and the initial `activeBackend` come from `public/config.json` (dev/DO build) or
a CDK-deployed `config.json` (CloudFront), fetched via `src/config.js`'s `loadConfig()` —
**not** Vite env vars (removed; `.env`'s `VITE_*` keys are no longer read anywhere).
```
{ "singleAgentApiUrl": "...", "multiAgentApiUrl": "...", "activeBackend": "single_agent" }
```
`config.example.json` at repo root is a placeholder reference. No API keys — both backends
are public endpoints protected only by AWS rate limiting.

## Dev Commands
```bash
npm run dev      # start dev server
npm run build    # production build
npm run preview  # preview production build
npm run lint     # ESLint
```

## Claude Code Hooks (`.claude/settings.json`)
- Any Edit/Write to `.jsx`/`.js` auto-runs `eslint --fix` afterward — no need to manually re-lint a file you just edited.
- Edits to `.env`/`.env.*` are blocked outright by a PreToolUse hook (holds live backend URLs) — ask the user to change env vars themselves.

## Notable Conventions
- All components are functional with hooks
- Typewriter animation:
  - **Placeholder**: cycles through `LOADING_MESSAGES` (Turkish strings) at 45ms/char, 220ms for dots, 700ms pause between messages
    — logic lives in `src/hooks/useCyclingText.js` (reusable; also used by `LoadingScreen.jsx`)
  - **Real AI responses**: instant display (`skipTypewriter: true` set by `ChatInput`)
  - **Greeting / initial messages** (no `skipTypewriter`): 25ms/char one-shot typewriter
  - **History on load**: instant display (`skipTypewriter: true` set by `App.jsx`)
- Feedback button shown on AI messages after typing completes, only when `timestamp` is present
- `GiDeerHead` icon (react-icons/gi) used as AI avatar; `FaStar`/`FaStarHalfStroke` for feedback rating
- `dangerouslySetInnerHTML` used only in `InfoModal.jsx` for controlled bilingual HTML content
- No routing — single view SPA
- Language switch clears chat history and `session_id` (with confirmation dialog if history exists)
