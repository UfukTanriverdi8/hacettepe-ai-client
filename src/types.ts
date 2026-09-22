export type Language = 'EN' | 'TR'

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
    // Set on everything except the greeting; ChatMessage reads it as "do not run the fixed-rate
    // typewriter".
    skipTypewriter?: boolean
    // Used to patch the placeholder as stream events arrive.
    id?: number
    // Localized status text, shown while isPlaceholder is true. Null once text starts arriving.
    status?: string | null
    // DynamoDB sort key from the `done` event; gates the feedback button.
    timestamp?: string
    // From the `session` event; the feedback DynamoDB partition key.
    session_id?: string | null
}

/** One line of the /chat NDJSON stream. */
export type StreamEvent =
    | { type: 'session'; session_id: string }
    | { type: 'status'; message: string }
    | { type: 'token'; text: string }
    | { type: 'discard' }
    // timestamp is absent when the server's DynamoDB write failed.
    | { type: 'done'; timestamp?: string }
    | { type: 'error'; message: string }
