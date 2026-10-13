# Stream behavior and source bubbles

Detail behind the "API Integration" section of `CLAUDE.md`, which keeps the event table and the framing rules. Read this before changing the stream reader in `ChatInput.tsx`, `useSmoothedText`, or `CitationBubbles`.

## Smoothing the reveal

Events from `/chat` do not reach the browser perfectly evenly. `useSmoothedText` absorbs the unevenness by keeping the text the server has sent apart from the text on screen, and closing the gap on a 33ms timer. It fixes jitter, not absence.

While the backend's guardrail ran in `streamProcessingMode: "sync"`, a 2001-character answer arrived in three bursts with a 6.18s silence in the middle. No reveal rate can spread three characters across six seconds, so the smoother looked broken and the guardrail was the cause. Backend 0.6.0 moved to `async`, which gives about 38 arrival points roughly 0.3s apart for a 2028-character answer. That is the input this hook was designed for.

`CATCH_UP_DIVISOR = 10` suits that pace. At about 60 characters every 0.3s, the displayed text settles about 60 characters behind, which is a third of a second, and the reveal stays continuous.

`npm run check:smoothing` drives the reveal math (`advance()`) over simulated chunky arrivals.

## Why `discard` exists

The model sometimes narrates before calling a tool, and those words are streamed before anything reveals that a tool call is coming. `app/streaming.py` in the backend spells out why they cannot be withheld. The client drops them and returns to the status line.

`lastStatus` is kept in `sendPrompt`'s closure for exactly this. The `token` handler nulls `status`, so without it the bubble would fall back to the cycling placeholder for the moment before the next status event lands.

Whether preamble should stay visible instead, interleaved the way Claude.ai shows it, is open as #22. Change neither side of `discard` without settling that first.

## Source bubbles

`sources[].n` is the number on a bubble. `kind` is `webpage`, `document` or `live` (a page fetched during this answer, drawn in `primary`). `citations[].offset` is where a cited passage ends in the concatenated token text, in UTF-16 units.

remark's node positions index the same string, so `placeCitations` (`src/citations.ts`) maps each offset straight onto the paragraph, heading or table cell containing it and appends one bubble group at that block's end. An offset in a gap goes to the block before it, and a source with no citation entry (an uncited live fetch) goes on the last block. A list item's text is a paragraph in mdast, so list items need no case of their own.

The plugin is added only once `isTypingComplete`, the feedback button's gate. The offsets index the full answer, and on a partly revealed prefix they would land on the wrong blocks. Answers from before 3.2.0 have no `sources` and show no bubbles.

Each bubble is a link inside a Radix HoverCard:
- Mouse: hover previews, a click opens the source.
- Keyboard: focus previews, Enter opens.
- Touch: the first tap previews (the click is `preventDefault`ed when the preceding `pointerdown` was touch) and the card itself is the link.

Radix's trigger calls `preventDefault` in a passive touchstart listener, so mobile Chrome logs "Unable to preventDefault inside passive event listener". It is harmless.

`.markdown a` is unlayered CSS and would beat the bubbles' utilities, so it excludes `.cite`.

`npm run check:citations` runs `placeCitations` over real mdast.
