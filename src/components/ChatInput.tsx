import { ArrowUp } from 'lucide-react';
import { useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import type { Language, Message, StreamEvent } from '../types';

// The backend's status strings are English and defined in app/agent/tool_specs.py
// (STATUS_MESSAGES and POST_TOOL_STATUS). An unmapped status falls through to the raw string,
// so a tool added server-side shows something rather than nothing until this map catches up.
const STATUS_TEXT: Record<string, Record<Language, string>> = {
    'searching the knowledge base...': {
        TR: 'Hacettepe kaynakları taranıyor...',
        EN: 'Searching the knowledge base...',
    },
    'fetching a live page...': {
        TR: 'Güncel sayfa getiriliyor...',
        EN: 'Fetching a live page...',
    },
    // Sent once a tool's results are back, covering the stretch where the model is reasoning
    // over them and nothing is on screen yet. Without it the tool's own status stays up for
    // ~8s, claiming a search is still running after it finished.
    'going through the results...': {
        TR: 'Sonuçlar inceleniyor...',
        EN: 'Going through the results...',
    },
}

const localizeStatus = (message: string, language: Language) => STATUS_TEXT[message]?.[language] ?? message

interface ChatInputProps {
    chatHistory: Message[]
    setChatHistory: Dispatch<SetStateAction<Message[]>>
    // Owned by App, because the header's new-chat button clears it too.
    sessionId: string | null
    setSessionId: (sessionId: string | null) => void
    language: Language
    chatUrl: string
}

const ChatInput = ({chatHistory, setChatHistory, sessionId, setSessionId, language, chatUrl}: ChatInputProps) => {
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);

      const sendPrompt = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if(loading) return
        if (inputValue.trim() === '') return

        const currentQuestion = inputValue
        setInputValue('')
        setLoading(true)

        if(chatHistory.length >= 30){
            const maxLimitEN = "This chat has reached its message limit. Start a new chat to keep asking."
            const maxLimitTR = "Bu sohbet mesaj sınırına ulaştı. Sormaya devam etmek için yeni bir sohbet başlatın."
            toast.info(language === 'EN' ? maxLimitEN : maxLimitTR, { position: 'top-center', className: 'custom-toast' })
            setInputValue(currentQuestion)
            setLoading(false)
            return
        }

        // Add the human message
        setChatHistory(prevHistory => [...prevHistory, { sender: 'Human', message: currentQuestion }])

        // Add a placeholder for the AI response
        const aiMessageId = Date.now();
        setChatHistory(prevHistory => [
            ...prevHistory,
            {
                id: aiMessageId,
                sender: 'AI',
                message: language === 'EN' ? 'Thinking...🤔' : 'Hmm...🤔',
                isPlaceholder: true
            }
        ])

        // Every stream event is a partial update to that one placeholder, so this runs
        // several times per question rather than once at the end.
        const patchAiMessage = (patch: Partial<Message>) => setChatHistory(prevHistory => prevHistory.map(message =>
            message.id === aiMessageId ? { ...message, ...patch } : message
        ))

        let activeSessionId = sessionId
        let answer = ''
        let lastStatus: string | null = null
        let errorShown = false

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
                    lastStatus = localizeStatus(event.message, language)
                    patchAiMessage({ status: lastStatus })
                    break
                case 'token':
                    // Appended, not assigned: one event per text delta, a few hundred per
                    // answer. ChatMessage smooths the arrival rate, so the lumpiness the
                    // network imposes on these does not reach the screen.
                    answer += event.text
                    patchAiMessage({ message: answer, isPlaceholder: false, status: null })
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
                case 'done':
                    // timestamp is the DynamoDB sort key this answer is stored under, and is
                    // absent when the write failed — ChatMessage gates the feedback button on it.
                    patchAiMessage({ timestamp: event.timestamp, session_id: activeSessionId })
                    break
                case 'error':
                    errorShown = true
                    patchAiMessage({ message: event.message, isPlaceholder: false, status: null })
                    break
            }
        }

        try {
            const response = await fetch(chatUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: currentQuestion,
                    ...(activeSessionId && { session_id: activeSessionId })
                })
            })

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

        } catch (error) {
            console.error('Error:', error);
            // Without this the placeholder stays on "Thinking...🤔" forever and gets persisted
            // to localStorage in that state.
            if (!errorShown) {
                patchAiMessage({
                    message: language === 'EN'
                        ? 'Sorry, something went wrong. Please try again.'
                        : 'Üzgünüm, bir şeyler ters gitti. Lütfen tekrar deneyin.',
                    isPlaceholder: false,
                    status: null
                })
            }
        } finally {
            setLoading(false);
        }
    }

    const label = language === 'EN' ? 'What would you like to know about Hacettepe?' : 'Hacettepe hakkında ne öğrenmek istersiniz?'

    return (
        <form
            onSubmit={sendPrompt}
            className="flex items-center gap-2 rounded-[22px] border bg-muted py-1.5 pr-1.5 pl-4 transition-colors focus-within:border-primary/50"
        >
            <input
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
}

export default ChatInput
