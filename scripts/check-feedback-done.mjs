// Checks src/feedbackDone.ts: the localStorage record of answers that must not offer rating again.
//
//     node scripts/check-feedback-done.mjs
//
// A wrong key or a broken cap fails quietly: the rate button comes back after a reload and a
// second rating silently overwrites the first in DynamoDB. Storage that throws must not break
// rating, since private windows and blocked site data do exactly that.

import assert from 'node:assert/strict'
// A .ts import, run under Node's built-in type stripping (Node 22.18+ / 23.6+).
import {
    FEEDBACK_DONE_KEY,
    FEEDBACK_DONE_LIMIT,
    isFeedbackDone,
    markFeedbackDone,
} from '../src/feedbackDone.ts'

const m = new Map()
const store = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }

assert.equal(isFeedbackDone(store, 's1', 't1'), false)
markFeedbackDone(store, 's1', 't1')
assert.equal(isFeedbackDone(store, 's1', 't1'), true)
assert.equal(isFeedbackDone(store, 's2', 't1'), false, 'same timestamp, other session')
markFeedbackDone(store, 's1', 't1')
assert.equal(JSON.parse(m.get(FEEDBACK_DONE_KEY)).length, 1, 'marking twice stores one entry')

// Answers from before 3.4.0 can lack session_id; null and undefined are the same key.
markFeedbackDone(store, null, 't9')
assert.equal(isFeedbackDone(store, undefined, 't9'), true)

for (let i = 0; i < FEEDBACK_DONE_LIMIT + 5; i++) markFeedbackDone(store, 's', `x${i}`)
assert.equal(JSON.parse(m.get(FEEDBACK_DONE_KEY)).length, FEEDBACK_DONE_LIMIT)
assert.equal(isFeedbackDone(store, 's', 'x0'), false, 'the oldest entry is dropped')
assert.equal(isFeedbackDone(store, 's', `x${FEEDBACK_DONE_LIMIT + 4}`), true)

// Corrupt data reads as empty and is replaced on the next write.
m.set(FEEDBACK_DONE_KEY, '{not json')
assert.equal(isFeedbackDone(store, 's1', 't1'), false)
markFeedbackDone(store, 's1', 't1')
assert.equal(isFeedbackDone(store, 's1', 't1'), true)
m.set(FEEDBACK_DONE_KEY, '{"a":1}')
assert.equal(isFeedbackDone(store, 's1', 't1'), false, 'valid JSON of the wrong shape reads as empty')

const throwing = {
    getItem() {
        throw new Error('denied')
    },
    setItem() {
        throw new Error('denied')
    },
}
assert.equal(isFeedbackDone(throwing, 's1', 't1'), false)
assert.doesNotThrow(() => markFeedbackDone(throwing, 's1', 't1'))

console.log('feedback done checks passed')
