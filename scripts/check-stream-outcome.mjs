// Checks src/streamOutcome.ts: how a /chat stream settles, and how a history saved mid-stream is
// repaired on load. No DOM and no React.
//
//     node scripts/check-stream-outcome.mjs
//
// A wrong rule here fails quietly: a cut-off answer looks finished, or a placeholder cycles
// "Thinking..." forever after a reload. Neither throws, so neither shows up in a quick look.

import assert from 'node:assert/strict'
// A .ts import, run under Node's built-in type stripping (Node 22.18+ / 23.6+).
import { recoverInterrupted, settleAnswer, settlementPatch } from '../src/streamOutcome.ts'

// settleAnswer: errorShown wins, then an empty answer fails, then `done` decides.
assert.equal(settleAnswer({ answer: 'Tam yanıt', doneSeen: true, errorShown: false }), 'complete')
assert.equal(settleAnswer({ answer: 'Yarım', doneSeen: false, errorShown: false }), 'cut_off')
// A clean end with nothing sent, and a discard followed by a break, both leave answer empty.
assert.equal(settleAnswer({ answer: '', doneSeen: false, errorShown: false }), 'failed')
assert.equal(settleAnswer({ answer: '', doneSeen: true, errorShown: false }), 'failed')
// An `error` event already replaced the text; no cut-off note goes on top of it.
assert.equal(settleAnswer({ answer: 'Yarım', doneSeen: false, errorShown: true }), 'failed')

// settlementPatch: what each ending writes onto the message.
assert.deepEqual(settlementPatch('complete', 'err'), { inFlight: false })
assert.deepEqual(settlementPatch('cut_off', 'err'), {
    inFlight: false,
    interrupted: true,
    isPlaceholder: false,
    status: null,
})
// A `done` with no text still set timestamp (or unsaved). The error text must not carry a feedback
// button that rates an empty stored row, or a "couldn't be saved" note.
assert.deepEqual(settlementPatch('failed', 'err'), {
    inFlight: false,
    message: 'err',
    isPlaceholder: false,
    status: null,
    timestamp: undefined,
    unsaved: false,
})

const finished = { sender: 'AI', message: 'Eski yanıt', id: 1, timestamp: 't1' }
const human = { sender: 'Human', message: 'Soru' }
const partial = { sender: 'AI', message: 'Yarım yan', id: 2, inFlight: true, status: null }
const waiting = {
    sender: 'AI',
    message: 'Hmm...🤔',
    id: 3,
    isPlaceholder: true,
    inFlight: true,
    status: 'searching the knowledge base...',
}
// Saved by 3.3.0 or earlier, before inFlight existed.
const legacyPlaceholder = { sender: 'AI', message: 'Thinking...🤔', id: 4, isPlaceholder: true }

const untouched = [human, finished]
assert.deepEqual(recoverInterrupted(untouched), untouched, 'a finished history must load unchanged')
assert.deepEqual(recoverInterrupted([partial])[0], {
    ...partial,
    inFlight: false,
    interrupted: true,
    status: null,
})
for (const stuck of [waiting, legacyPlaceholder]) {
    assert.deepEqual(recoverInterrupted([stuck])[0], {
        ...stuck,
        message: '',
        isPlaceholder: false,
        inFlight: false,
        interrupted: true,
        status: null,
    })
}
// The input is never mutated: React state must not change under its own feet.
const input = [{ ...partial }]
recoverInterrupted(input)
assert.deepEqual(input, [partial])

console.log('stream outcome checks passed')
