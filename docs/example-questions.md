# Example questions

The chips on the empty screen. Read this before adding or changing a question in `src/exampleQuestions.ts`.

## How it works

`src/exampleQuestions.ts` holds one pool of 10 questions per language. `App.tsx` draws `EXAMPLE_COUNT` (3) from each pool once per page load, so switching the UI language shows that language's set without reshuffling. The check `npm run check:example-questions` covers the draw and fails on any entry containing "Placeholder" or "Yer tutucu". It cannot say whether a question gets a good answer. Only sending it to `/chat` shows that.

English is written for international students and Turkish for Turkish students, so the lists are not translations of each other.

A chip fills the input through `ChatInput`'s `setValueAndFocus` and does not send. Once there is a chat, the chips are `disabled`, because the collapsed empty state keeps its buttons in the tab order otherwise. `inert` is no option on React 18, which does not write a boolean `inert` to the DOM.

## Before adding a question

Send it to the deployed site's `/chat`. POST `{"message": ...}` with no `session_id`, and read the NDJSON. Each call runs Bedrock and writes an exchange to DynamoDB, so send them one at a time with a pause between.

What to look for: an answer in the question's language, with sources. Run it more than once, because the same question can succeed on one run and fail on the next.

To see what the knowledge base covers, read `../hacettepe-scraper/docs/subdomain-status.md` and the live manifest, `s3://hacettepe-bucket/manifest/departments.json` (`aws s3 cp` reads it). Questions about a department that is not ingested yet will come back thin.

## What to avoid

Time-bound wording ("this term", a year) answers unreliably. On 2026-10-13:
- "When does the academic year start and end?" returned a stale 2024-2025 calendar in every run.
- "Bu dönemin akademik takvimi nedir?" answered in 2 of 5 runs and gave up in the other 3.

When the agent loop uses up its tool iterations it gives up with "I don't have information on that." (backend issue #45). The client shows that text in the UI language, see the API Integration section of `CLAUDE.md`.

## What was tested

The pools as first written, on 2026-10-13: every question answered with sources in the question's language. Questions edited after that were not re-tested.
