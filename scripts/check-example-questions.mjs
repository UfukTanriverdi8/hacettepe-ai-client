// Checks src/exampleQuestions.ts: the pools and the draw, with no DOM and no React.
//
//     node scripts/check-example-questions.mjs
//
// A shuffle that repeats an entry or never reaches one still renders three plausible chips, so a
// wrong draw is easy to miss by eye. The pool checks also stop placeholder text from shipping.

import assert from 'node:assert/strict'
// A .ts import, run under Node's built-in type stripping (Node 22.18+ / 23.6+).
import { EXAMPLE_COUNT, EXAMPLE_POOL, pickRandom } from '../src/exampleQuestions.ts'

/** A small seeded generator (mulberry32), so a failure reproduces. */
const seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

for (const [language, pool] of Object.entries(EXAMPLE_POOL)) {
    assert.ok(pool.length >= EXAMPLE_COUNT, `${language}: needs at least ${EXAMPLE_COUNT} questions`)
    assert.equal(new Set(pool).size, pool.length, `${language}: duplicate question`)
    for (const question of pool) {
        assert.ok(question.trim() === question && question.length > 0, `${language}: blank or padded entry`)
        assert.ok(!/placeholder|yer tutucu/i.test(question), `${language}: placeholder text: ${question}`)
    }
}

const pool = EXAMPLE_POOL.EN
const before = [...pool]

// Each draw is `count` distinct members of the pool, and the pool is left in place.
const random = seeded(1)
const DRAWS = 1000
const counts = new Map(pool.map((question) => [question, 0]))
for (let i = 0; i < DRAWS; i++) {
    const picks = pickRandom(pool, EXAMPLE_COUNT, random)
    assert.equal(picks.length, EXAMPLE_COUNT)
    assert.equal(new Set(picks).size, EXAMPLE_COUNT, 'a draw repeated an entry')
    for (const pick of picks) {
        assert.ok(counts.has(pick), 'a draw returned something outside the pool')
        counts.set(pick, counts.get(pick) + 1)
    }
}
assert.deepEqual([...pool], before, 'pickRandom reordered the pool')
// Every entry lands in EXAMPLE_COUNT / pool.length of the draws (30% for 3 of 10, so about 300). The
// seed is fixed, so this band cannot flake. It catches a stuck shuffle and a visibly skewed one.
const expected = (DRAWS * EXAMPLE_COUNT) / pool.length
for (const [question, n] of counts) {
    assert.ok(Math.abs(n - expected) <= expected * 0.2, `skewed draw: "${question}" came up ${n} times, expected about ${expected}`)
}

// Every position in the draw is reachable by every entry, not only the first one.
const first = new Set()
for (let i = 0; i < 1000; i++) first.add(pickRandom(pool, EXAMPLE_COUNT, random)[0])
assert.equal(first.size, pool.length, 'some entries never came first')

// Edges: nothing asked for, and more than the pool holds.
assert.deepEqual(pickRandom(pool, 0), [])
assert.deepEqual(pickRandom(pool, -2), [])
assert.equal(pickRandom(pool, pool.length + 5).length, pool.length)
assert.deepEqual([...pickRandom([], 3)], [])

console.log('check-example-questions: all cases pass')
