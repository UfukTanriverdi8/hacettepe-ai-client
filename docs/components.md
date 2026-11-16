# Component notes

Detail behind two sections of `CLAUDE.md`. Read this before changing `FeedbackModal.tsx` or anything in `src/components/ui/`.

## Feedback modal (`FeedbackModal.tsx`)

- Triggered by the "Geri bildirimde bulun" pill (lucide `MessageSquare` icon) shown on AI messages after the reveal completes.
- The button has a wiggle animation (`feedback-icon-wiggle` CSS class) on appearance.
- It requires `timestamp` to be present on the message.
- It is hidden once the answer's feedback is done: rated (200), or gone from the table (404). `src/feedbackDone.ts` records `"<session_id>|<timestamp>"` under the `feedback-done` key in `localStorage`, newest last, capped at 300. `ChatMessage` seeds its `feedbackDone` state from that record, so a rated answer stays rated after a reload, and a second rating can no longer silently overwrite the first (the backend's `record_feedback` is a plain `SET`). "New chat" leaves the record alone: keys from different sessions cannot collide. Storage that throws or holds corrupt data reads as empty, and the answer stays done for that page only.
- The modal contains:
  - A 5-star rating with half-star support (0.5 increments via left/right half-hover). The row is a `role="slider"`: arrow keys step by 0.5, Home and End jump to 0 and 5.
  - An optional comment textarea.
  - Bilingual TR/EN labels.
- `POST {feedbackUrl}` uses the fixed path from `/config.json`, not a per-message URL.
- Request body: `{ session_id, timestamp, feedback_value: 'Positive'|'Negative', rating: 0-10, feedback_reason? }`
  - `feedback_value` is `'Positive'` if stars are 3 or more, else `'Negative'`.
  - `rating` is stars × 2 (the 0 to 5 star scale becomes a 0 to 10 integer).
- `FeedbackModal` reports through two callbacks: `onClose` for any dismissal and `onDone` for 200 or 404.
- A failed submit (5xx, network) keeps the dialog open with the stars and comment as entered and shows an inline `role="alert"` line under the comment box instead of a toast. Editing the input or submitting again clears it.
- The endpoint answers **404** when `(session_id, timestamp)` matches no stored exchange, either because it aged out under the 180-day TTL or was never written. A retry cannot fix that, so the dialog says the answer is no longer stored, disables Submit, and records the answer as done. Thanking the user for a rating that went nowhere is the failure to avoid here.
- Stars and comment survive Cancel or Esc within a page: `FeedbackModal` stays mounted while the answer has a `timestamp`, and Radix only unmounts the dialog content. A reload clears an unsent comment.

## shadcn on React 18: `ref` on generated components

shadcn now generates for React 19, where `ref` is an ordinary prop. On React 18 a plain function component drops it. A generated component used as a Radix `asChild` trigger then never passes its DOM node up, and the popover or tooltip it opens stays unpositioned at `translate(0, -200%)`, off-screen.

A wrapper that Radix clones a ref onto fails the same way, with a dev-only "Function components cannot be given refs" warning. Two cases so far are `DialogOverlay` inside the portal and `PopoverTrigger` nested in `TooltipTrigger asChild`.

Wrapped in `React.forwardRef` so far: `Button`, `PopoverTrigger`, `TooltipTrigger`, `DialogTrigger`, `DialogClose`, `DialogOverlay`, `HoverCardTrigger`. Do the same to any new wrapper in one of those positions, re-apply it after `shadcn add --overwrite`, and check the dev server's console, since production builds are silent about it.

`ChatInput` is also a `forwardRef` component, for a different reason. Its `setValueAndFocus` handle lets `App` fill the input from an example question chip.
