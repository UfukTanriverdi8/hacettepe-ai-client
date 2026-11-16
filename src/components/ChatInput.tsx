import { ArrowUp } from 'lucide-react'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import { settleAnswer } from '../streamOutcome'
import type { Language, Message, StreamEvent } from '../types'

const ERROR_MESSAGE = {
    EN: 'Sorry, something went wrong. Please try again.',
    TR: 'Üzgünüm, bir şeyler ters gitti. Lütfen tekrar deneyin.',
}
const RATE_LIMIT_MESSAGE = {
    EN: 'Too many questions in a short time. Wait a few minutes and try again.',
    TR: 'Kısa sürede çok fazla soru soruldu. Birkaç dakika bekleyip tekrar deneyin.',
}
// The backend's FALLBACK_MESSAGE (app/agent/loop.py), sent as a single token when its tool loop
// runs out of turns. It is English whatever language the question was in, so an exact match is
// shown as the interface language's text instead. Drop this once the backend stops sending it
// (backend #45).
const BACKEND_FALLBACK = "I don't have information on that."
const NO_INFORMATION_MESSAGE = {
    EN: BACKEND_FALLBACK,
    TR: 'Üzgünüm, bu konuda bir bilgi bulamadım.',
}
interface ChatInputProps {
    chatHistory: Message[]
    setChatHistory: Dispatch<SetStateAction<Message[]>>
    // Owned by App, because the header's new-chat button clears it too.
    sessionId: string | null
    setSessionId: (sessionId: string | null) => void
    language: Language
    chatUrl: string
}
export interface ChatInputHandle {
    setValueAndFocus: (value: string) => void
}

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
    ({ chatHistory, setChatHistory, sessionId, setSessionId, language, chatUrl }, ref) => {
        const [inputValue, setInputValue] = useState('')
        const inputRef = useRef<HTMLInputElement>(null)

        useImperativeHandle(ref, () => ({
            setValueAndFocus: (value: string) => {
                setInputValue(value)
                inputRef.current?.focus()
                inputRef.current?.setSelectionRange(value.length, value.length)
            },
        }))
        const [loading, setLoading] = useState(false)

        const sendPrompt = async (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault()
            if (loading) return
            if (inputValue.trim() === '') return

            const currentQuestion = inputValue
            setInputValue('')
            setLoading(true)

            if (chatHistory.length >= 30) {
                const maxLimitEN = 'This chat has reached its message limit. Start a new chat to keep asking.'
                const maxLimitTR =
                    'Bu sohbet mesaj sınırına ulaştı. Sormaya devam etmek için yeni bir sohbet başlatın.'
                toast.info(language === 'EN' ? maxLimitEN : maxLimitTR, {
                    position: 'top-center',
                    className: 'custom-toast',
                })
                setInputValue(currentQuestion)
                setLoading(false)
                return
            }

            // The human message's id lets a 429 take the exchange back out. One less than the
            // placeholder's, so it cannot collide: `loading` keeps questions at least a request apart.
            const aiMessageId = Date.now()
            const humanMessageId = aiMessageId - 1
            setChatHistory((prevHistory) => [
                ...prevHistory,
                { id: humanMessageId, sender: 'Human', message: currentQuestion },
            ])

            // Add a placeholder for the AI response
            setChatHistory((prevHistory) => [
                ...prevHistory,
                {
                    id: aiMessageId,
                    sender: 'AI',
                    message: language === 'EN' ? 'Thinking...🤔' : 'Hmm...🤔',
                    isPlaceholder: true,
                    inFlight: true,
                },
            ])

            // Every stream event is a partial update to that one placeholder, so this runs
            // several times per question rather than once at the end.
            const patchAiMessage = (patch: Partial<Message>) =>
                setChatHistory((prevHistory) =>
                    prevHistory.map((message) =>
                        message.id === aiMessageId ? { ...message, ...patch } : message,
                    ),
                )

            let activeSessionId = sessionId
            let answer = ''
            let lastStatus: string | null = null
            let errorShown = false
            let doneSeen = false
            let settled = false

            // Runs once per question, when the stream ends cleanly or throws, and is the only place
            // inFlight is cleared. A break keeps whatever text arrived (flagged as cut off); only an
            // answer with no text left after any discard falls back to the error message.
            const settle = () => {
                if (settled) return
                settled = true
                switch (settleAnswer({ answer, doneSeen, errorShown })) {
                    case 'complete':
                        patchAiMessage({ inFlight: false })
                        break
                    case 'cut_off':
                        // message stays as stored, so a swapped fallback text is kept.
                        patchAiMessage({
                            inFlight: false,
                            interrupted: true,
                            isPlaceholder: false,
                            status: null,
                        })
                        break
                    case 'failed':
                        patchAiMessage({
                            inFlight: false,
                            message: ERROR_MESSAGE[language],
                            isPlaceholder: false,
                            status: null,
                        })
                        break
                }
            }

            const handleEvent = (event: StreamEvent) => {
                switch (event.type) {
                    case 'session':
                        // Sent before any Bedrock work, so the id survives a stream that dies
                        // halfway and the next question continues the same conversation.
                        activeSessionId = event.session_id
                        setSessionId(event.session_id)
                        localStorage.setItem('session_id', event.session_id)
                        break
                    case 'status':
                        // Kept as well as rendered, so a discard can put the bubble back into the
                        // state it was in before the retracted text overwrote it.
                        lastStatus = event.message
                        patchAiMessage({ status: lastStatus })
                        break
                    case 'token':
                        // Appended, not assigned: one event per text delta, a few hundred per
                        // answer. ChatMessage smooths the arrival rate, so the lumpiness the
                        // network imposes on these does not reach the screen.
                        answer += event.text
                        patchAiMessage({
                            message: answer === BACKEND_FALLBACK ? NO_INFORMATION_MESSAGE[language] : answer,
                            isPlaceholder: false,
                            status: null,
                        })
                        break
                    case 'discard':
                        // Everything streamed so far was the model narrating a tool call it was
                        // about to make, not answer text (app/streaming.py's discard()). Dropping
                        // it here is what keeps 'let me check the live page' from being glued to
                        // the front of the real answer. Back to isPlaceholder so the status line
                        // returns, carrying whatever the server last reported until the tool's own
                        // status arrives a moment later.
                        answer = ''
                        patchAiMessage({ message: '', isPlaceholder: true, status: lastStatus })
                        break
                    case 'sources':
                        // Offsets index `answer` as it stands now: the backend sends only the final
                        // turn's citations, and a discard already cleared any earlier text.
                        patchAiMessage({ sources: event.sources, citations: event.citations })
                        break
                    case 'done':
                        // timestamp is the DynamoDB sort key this answer is stored under, and is
                        // absent when the write failed — ChatMessage gates the feedback button on it
                        // and says the answer was not saved.
                        doneSeen = true
                        patchAiMessage({
                            timestamp: event.timestamp,
                            session_id: activeSessionId,
                            unsaved: !event.timestamp,
                        })
                        break
                    case 'error':
                        errorShown = true
                        console.error(event.message)
                        patchAiMessage({
                            message: ERROR_MESSAGE[language],
                            isPlaceholder: false,
                            status: null,
                        })
                        break
                }
            }

            try {
                const response = await fetch(chatUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: currentQuestion,
                        ...(activeSessionId && { session_id: activeSessionId }),
                    }),
                })

                if (response.status === 429) {
                    // WAF's ChatRateLimit (or Lambda's concurrency cap) refused the question before
                    // the backend saw it. The generic error would invite an instant retry, and each
                    // retry extends the block, so say what happened and hand the question back, the
                    // way the message limit above does.
                    setChatHistory((prevHistory) =>
                        prevHistory.filter(
                            (message) => message.id !== aiMessageId && message.id !== humanMessageId,
                        ),
                    )
                    toast.info(RATE_LIMIT_MESSAGE[language], {
                        position: 'top-center',
                        className: 'custom-toast',
                    })
                    // Text typed while the request was pending wins over the old question.
                    setInputValue((current) => (current.trim() ? current : currentQuestion))
                    return
                }

                if (!response.ok || !response.body) {
                    throw new Error(`HTTP ${response.status}`)
                }

                const reader = response.body.getReader()
                const decoder = new TextDecoder()
                let buffer = ''

                for (;;) {
                    const { done, value } = await reader.read()
                    if (done) break
                    // stream: true holds back an incomplete UTF-8 sequence. Turkish answers are
                    // full of multi-byte characters, so a chunk splitting one is routine.
                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    // Chunk boundaries land wherever TCP puts them, not on newlines, so the last
                    // element is usually a partial line. Carry it into the next read instead of
                    // parsing it — parsing throws, dropping it loses tokens.
                    // split() always returns at least one element, so pop() never yields undefined.
                    buffer = lines.pop() ?? ''
                    for (const line of lines) {
                        if (line.trim()) handleEvent(JSON.parse(line) as StreamEvent)
                    }
                }

                buffer += decoder.decode()
                if (buffer.trim()) handleEvent(JSON.parse(buffer) as StreamEvent)
                // A clean end is not proof of a whole answer: the stream can close before `done`.
                settle()
            } catch (error) {
                console.error('Error:', error)
                // Without this the placeholder stays on "Thinking...🤔" forever and gets persisted
                // to localStorage in that state.
                settle()
            } finally {
                setLoading(false)
            }
        }

        const label =
            language === 'EN'
                ? 'What would you like to know about Hacettepe?'
                : 'Hacettepe hakkında ne öğrenmek istersiniz?'

        return (
            <form
                onSubmit={sendPrompt}
                className="flex items-center gap-2 rounded-[22px] border bg-muted py-1.5 pr-1.5 pl-4 transition-colors focus-within:border-primary/50"
            >
                <input
                    ref={inputRef}
                    id="chat-input"
                    type="text"
                    aria-label={label}
                    placeholder={label}
                    autoComplete="off"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent py-1.5 text-base outline-none sm:text-[15px]"
                />
                <Button
                    type="submit"
                    size="icon"
                    disabled={loading || inputValue.trim() === ''}
                    aria-label={language === 'EN' ? 'Send' : 'Gönder'}
                    className="size-9 rounded-full"
                >
                    <ArrowUp className="size-[18px]" strokeWidth={2.2} />
                </Button>
            </form>
        )
    },
)
ChatInput.displayName = 'ChatInput'

export default ChatInput
