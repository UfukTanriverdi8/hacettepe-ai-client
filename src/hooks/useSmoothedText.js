import { useEffect, useState } from 'react'

// Reveals text at a steady rate no matter how unevenly it arrives.
//
// The backend streams a token event per text delta, but the guardrail's sync processing mode
// re-bunches those few hundred events into 5-11 network chunks (measured 2026-09-22, see
// ../../hacettepe-ai-backend/CLAUDE.md). Painting each chunk the moment it lands is what made
// answers appear in lumps. Holding the text the server has sent apart from the text on screen
// and closing the gap on a timer makes chunk size invisible to the reader — the same code
// looks right whether the server sends 5 chunks or 400.

const TICK_MS = 33
// Characters per tick are proportional to how far behind the screen is, so the reveal sprints
// when a big chunk lands and eases as it catches up. No fixed rate can win: fast enough to
// drain a large chunk overruns the small ones and stutters, slow enough for the small ones is
// still typing long after the answer finished.
//
// Because the backlog decays by a constant fraction per tick, drain time grows only with its
// logarithm: 250 characters clear in 37 ticks (~1.2s) and 1000 in 50 (~1.7s), so one setting
// serves chunks of wildly different sizes. 10 is picked to match the measured ~1.25s between
// chunks — a faster divisor finishes each chunk early and leaves the text sitting still until
// the next one lands, which trades lumpy arrival for visible dead air. Math.max(1, ...) is what
// guarantees it reaches the end rather than approaching it forever.
const CATCH_UP_DIVISOR = 10

/**
 * One tick's worth of progress from `current` toward `goal`.
 *
 * Exported for the sake of being checkable without a DOM — this is the only real logic in the
 * module, and `node scripts/check-smoothing.mjs` drives it directly.
 */
export function advance(current, goal) {
    if (current === goal) return current
    // A goal that does not extend what is on screen is a replacement rather than more of the
    // same answer — the error event overwriting a partial answer is the case that matters.
    // Animating that diff would be nonsense, so it snaps.
    if (!goal.startsWith(current)) return goal
    const step = Math.max(1, Math.ceil((goal.length - current.length) / CATCH_UP_DIVISOR))
    return goal.slice(0, current.length + step)
}

/**
 * The visible prefix of `target`, advancing toward it a few characters at a time.
 *
 * Text present when the component mounts is shown immediately, which is what separates a
 * streamed answer from every other case without needing a flag: history restored from
 * localStorage, the user's own message and a completed answer all arrive whole, while a
 * streamed answer mounts as a placeholder and grows afterward. Pass '' while the placeholder is
 * up so the first chunk animates in rather than appearing at once.
 */
export function useSmoothedText(target) {
    const [shown, setShown] = useState(target)

    // One timeout that reschedules itself, rather than a standing interval: a message that has
    // caught up holds no timer at all, so a 30-message history costs nothing and only the bubble
    // currently streaming is ticking. The `target` dependency is affordable because React
    // batches every token event parsed from one network chunk into a single render, so this
    // sees the 5-11 chunks rather than the few hundred deltas inside them.
    useEffect(() => {
        if (shown === target) return
        const timer = setTimeout(() => setShown(advance(shown, target)), TICK_MS)
        return () => clearTimeout(timer)
    }, [shown, target])

    return shown
}
