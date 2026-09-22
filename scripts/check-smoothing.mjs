// Drives useSmoothedText's advance() directly, with no DOM and no React render.
//
//     node scripts/check-smoothing.mjs
//
// The repo has no test runner, and the reveal math is the kind that fails quietly: a step that
// never quite reaches the end drops the last characters of every answer, which is easy to miss
// by eye and impossible to miss here.

import assert from 'node:assert/strict'
// A .ts import, run under Node's built-in type stripping (Node 22.18+ / 23.6+).
import { advance } from '../src/hooks/useSmoothedText.ts'

// A tick budget, not a timing claim. Every case below has to settle well inside it; the point
// is that the loops terminate rather than that they terminate at any particular speed.
const MAX_TICKS = 2000

/** Tick until the screen catches up with the goal, returning how many ticks it took. */
const settle = (start, goal) => {
    let shown = start
    for (let ticks = 1; ticks <= MAX_TICKS; ticks++) {
        shown = advance(shown, goal)
        if (shown === goal) return { shown, ticks }
    }
    return { shown, ticks: Infinity }
}

const answer = 'Staj başvurusu için gereken şartlar şunlardır: '.repeat(40)

// 1. A chunked arrival ends on the exact full text, not a prefix of it.
{
    const chunkCount = 8
    const size = Math.ceil(answer.length / chunkCount)
    let shown = ''
    for (let i = 1; i <= chunkCount; i++) {
        const goal = answer.slice(0, i * size)
        // Chunks land ~1.25s apart in production; at 33ms a tick that is roughly 38 ticks.
        for (let t = 0; t < 38; t++) {
            shown = advance(shown, goal)
            assert.ok(goal.startsWith(shown), `showed text the server had not sent: ${shown}`)
        }
    }
    const { shown: final, ticks } = settle(shown, answer)
    assert.equal(final, answer, 'never caught up with the full answer')
    assert.ok(ticks < MAX_TICKS, 'catch-up did not terminate')
    console.log(`ok  8 chunks -> exact full text, tail drained in ${ticks} ticks`)
}

// 2. A large chunk is revealed gradually rather than dumped in one tick. This is the whole
//    point of the module, so it gets an assertion rather than an eyeball.
{
    const { ticks } = settle('', answer)
    assert.ok(ticks > 20, `revealed ${answer.length} chars in only ${ticks} ticks`)
    console.log(`ok  one ${answer.length}-char chunk spread over ${ticks} ticks`)
}

// 3. Drain time grows with the logarithm of chunk size, which is what lets one rate serve both
//    a 250-character chunk and a 1000-character one.
{
    const small = settle('', 'x'.repeat(250)).ticks
    const large = settle('', 'x'.repeat(1000)).ticks
    assert.ok(large < small * 2, `drain time scaled badly: ${small} -> ${large} ticks`)
    console.log(`ok  250 chars in ${small} ticks, 1000 chars in ${large}`)
}

// 4. Replacement text snaps. The error event overwrites a partial answer with an unrelated
//    string, and revealing that one character at a time would be absurd.
{
    const partial = answer.slice(0, 120)
    const failure = 'Üzgünüm, bir şeyler ters gitti. Lütfen tekrar deneyin.'
    assert.equal(advance(partial, failure), failure, 'error message did not replace at once')
    console.log('ok  replacement text snaps instead of animating')
}

// 5. Already caught up is a no-op, so an idle bubble re-renders to the same string and React
//    bails out rather than re-parsing Markdown 30 times a second forever.
{
    assert.equal(advance(answer, answer), answer)
    assert.equal(advance('', ''), '')
    console.log('ok  caught-up state is a no-op')
}

console.log('\nall smoothing checks passed')
