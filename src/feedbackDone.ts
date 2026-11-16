// Answers that must not offer rating again: rated (200), or gone from the table (404). Without
// this the rate button returns after a reload, and a second rating silently overwrites the first,
// since the backend's record_feedback is a plain SET on (session_id, timestamp).

export const FEEDBACK_DONE_KEY = 'feedback-done'
// A chat holds at most 15 answers and stored rows expire after 180 days, so this covers years of
// normal use while keeping the entry small.
export const FEEDBACK_DONE_LIMIT = 300

/** The part of Storage this needs, so the check script can pass a Map-backed stand-in. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>

// Answers from before 3.4.0 can lack session_id; they share the '' prefix, and timestamps keep
// them apart.
const keyOf = (sessionId: string | null | undefined, timestamp: string) => `${sessionId ?? ''}|${timestamp}`

// Anything unreadable (private window, blocked storage, corrupt or foreign data) reads as empty.
function read(store: KeyValueStore): string[] {
    try {
        const parsed: unknown = JSON.parse(store.getItem(FEEDBACK_DONE_KEY) ?? '[]')
        return Array.isArray(parsed)
            ? parsed.filter((entry): entry is string => typeof entry === 'string')
            : []
    } catch {
        return []
    }
}

export function isFeedbackDone(
    store: KeyValueStore,
    sessionId: string | null | undefined,
    timestamp: string,
) {
    return read(store).includes(keyOf(sessionId, timestamp))
}

export function markFeedbackDone(
    store: KeyValueStore,
    sessionId: string | null | undefined,
    timestamp: string,
) {
    const key = keyOf(sessionId, timestamp)
    const entries = [...read(store).filter((entry) => entry !== key), key].slice(-FEEDBACK_DONE_LIMIT)
    try {
        store.setItem(FEEDBACK_DONE_KEY, JSON.stringify(entries))
    } catch {
        // Storage refused the write: the answer stays done for this page only, as before 3.4.1.
    }
}
