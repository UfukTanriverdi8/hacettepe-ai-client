import type { Message } from './types'

/** What ChatInput knows about a /chat stream at the moment it stops. */
export interface StreamProgress {
    // The answer text after any discard, so a retracted preamble never counts as text.
    answer: string
    doneSeen: boolean
    // An `error` event already replaced the message with the error text.
    errorShown: boolean
}

/**
 * How an answer ends: kept as is, kept with a cut-off note, or replaced by the error text.
 * 'failed' wins whenever there is no answer text to keep, so a stream that ends with nothing
 * (or with only a discarded preamble) never leaves the placeholder cycling.
 */
export type Settlement = 'complete' | 'cut_off' | 'failed'

export function settleAnswer({ answer, doneSeen, errorShown }: StreamProgress): Settlement {
    if (errorShown || answer === '') return 'failed'
    return doneSeen ? 'complete' : 'cut_off'
}

/**
 * The patch each ending writes onto the message. 'cut_off' leaves `message` as stored, so a
 * swapped fallback text is kept. 'failed' also clears what a text-less `done` set: the error text
 * must not offer a feedback button that rates an empty stored row, or claim it was not saved.
 */
export function settlementPatch(settlement: Settlement, errorText: string): Partial<Message> {
    switch (settlement) {
        case 'complete':
            return { inFlight: false }
        case 'cut_off':
            return { inFlight: false, interrupted: true, isPlaceholder: false, status: null }
        case 'failed':
            return {
                inFlight: false,
                message: errorText,
                isPlaceholder: false,
                status: null,
                timestamp: undefined,
                unsaved: false,
            }
    }
}

/**
 * Repairs a history saved while an answer was streaming: the request that would have finished it
 * died with the page. Partial text stays and is flagged; a placeholder loses its "thinking" text.
 * Messages from before inFlight existed are left alone unless they are still placeholders, since
 * an old half-streamed answer cannot be told apart from an old unsaved one.
 */
export function recoverInterrupted(history: Message[]): Message[] {
    return history.map((message) => {
        if (message.sender !== 'AI' || !(message.inFlight || message.isPlaceholder)) return message
        const recovered: Message = { ...message, inFlight: false, interrupted: true, status: null }
        if (message.isPlaceholder) {
            recovered.message = ''
            recovered.isPlaceholder = false
        }
        return recovered
    })
}
