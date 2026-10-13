# Component notes

Detail behind two sections of `CLAUDE.md`. Read this before changing `FeedbackModal.tsx` or anything in `src/components/ui/`.

## Feedback modal (`FeedbackModal.tsx`)

- Triggered by the "Geri bildirimde bulun" pill (lucide `MessageSquare` icon) shown on AI messages after the reveal completes.
- The button has a wiggle animation (`feedback-icon-wiggle` CSS class) on appearance.
- It requires `timestamp` to be present on the message.
- It is hidden after submission (`feedbackSubmitted` state in `ChatMessage`).
- The modal contains:
  - A 5-star rating with half-star support (0.5 increments via left/right half-hover). The row is a `role="slider"`: arrow keys step by 0.5, Home and End jump to 0 and 5.
  - An optional comment textarea.
  - Bilingual TR/EN labels.
- `POST {feedbackUrl}` uses the fixed path from `/config.json`, not a per-message URL.
- Request body: `{ session_id, timestamp, feedback_value: 'Positive'|'Negative', rating: 0-10, feedback_reason? }`
  - `feedback_value` is `'Positive'` if stars are 3 or more, else `'Negative'`.
  - `rating` is stars × 2 (the 0 to 5 star scale becomes a 0 to 10 integer).
- A non-2xx response raises an error toast. The endpoint answers **404** when `(session_id, timestamp)` matches no stored exchange, either because it aged out under the 180-day TTL or was never written. Thanking the user for a rating that went nowhere is the failure to avoid here.

## shadcn on React 18: `ref` on generated components

shadcn now generates for React 19, where `ref` is an ordinary prop. On React 18 a plain function component drops it. A generated component used as a Radix `asChild` trigger then never passes its DOM node up, and the popover or tooltip it opens stays unpositioned at `translate(0, -200%)`, off-screen.

A wrapper that Radix clones a ref onto fails the same way, with a dev-only "Function components cannot be given refs" warning. Two cases so far are `DialogOverlay` inside the portal and `PopoverTrigger` nested in `TooltipTrigger asChild`.

Wrapped in `React.forwardRef` so far: `Button`, `PopoverTrigger`, `TooltipTrigger`, `DialogTrigger`, `DialogClose`, `DialogOverlay`, `HoverCardTrigger`. Do the same to any new wrapper in one of those positions, re-apply it after `shadcn add --overwrite`, and check the dev server's console, since production builds are silent about it.

`ChatInput` is also a `forwardRef` component, for a different reason. Its `setValueAndFocus` handle lets `App` fill the input from an example question chip.
