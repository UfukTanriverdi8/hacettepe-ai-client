export type Language = 'EN' | 'TR'

/** 'system' follows prefers-color-scheme and keeps following it while the page is open. */
export type ThemePreference = 'system' | 'light' | 'dark'

/** The shape of /config.json, loaded once at startup by loadConfig(). */
export interface AppConfig {
    chatUrl: string
    feedbackUrl: string
}

export interface Message {
    sender: 'Human' | 'AI'
    message: string
    // True until the first `token` event, and true again after a `discard` retracts the tokens
    // that already arrived.
    isPlaceholder?: boolean
    // Used to patch the placeholder as stream events arrive.
    id?: number
    // The backend's raw status string, shown (localized by describeStatus) while isPlaceholder is
    // true. Null once text starts arriving.
    status?: string | null
    // DynamoDB sort key from the `done` event; gates the feedback button.
    timestamp?: string
    // From the `session` event; the feedback DynamoDB partition key.
    session_id?: string | null
    // From the `sources` event. Absent on answers from before 3.2.0, which show no bubbles.
    sources?: Source[]
    citations?: Citation[]
    // True from the placeholder until the stream settles. Only a reload mid-stream leaves it set,
    // which is how recoverInterrupted (src/streamOutcome.ts) finds such a message.
    inFlight?: boolean
    // The stream broke before `done`. The text, if any, is partial.
    interrupted?: boolean
    // `done` arrived without a timestamp: the server could not store this answer, so it cannot be
    // rated and is missing from follow-up questions' replayed history.
    unsaved?: boolean
}

/** One source behind an answer; `n` is the number on its bubble. */
export interface Source {
    n: number
    url: string
    title: string
    // 'live' is a page fetched while writing this answer, the rest are knowledge base copies.
    kind: 'webpage' | 'document' | 'live'
}

/** Where a cited passage ends in the answer, in UTF-16 units (JS string indices). */
export interface Citation {
    offset: number
    n: number[]
}

/** One line of the /chat NDJSON stream. */
export type StreamEvent =
    | { type: 'session'; session_id: string }
    | { type: 'status'; message: string }
    | { type: 'token'; text: string }
    | { type: 'discard' }
    // After the last token, before done. Both lists are empty when the answer cites nothing.
    | { type: 'sources'; sources: Source[]; citations: Citation[] }
    // timestamp is absent when the server's DynamoDB write failed.
    | { type: 'done'; timestamp?: string }
    | { type: 'error'; message: string }
