import { useMemo, useState } from 'react'
import type { ComponentProps } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components, ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MessageSquare } from 'lucide-react'
import DeerMark from './DeerMark'
import CitationBubbles from './CitationBubbles'
import FeedbackModal from './FeedbackModal'
import { remarkCitations } from '../citations'
import { isFeedbackDone, markFeedbackDone } from '../feedbackDone'
import { useCyclingText } from '../hooks/useCyclingText'
import { useSmoothedText } from '../hooks/useSmoothedText'
import { describeStatus } from '../statusText'
import type { Language, Message } from '../types'

// Claims only what is true of the window it covers: the seconds before the backend's first
// status event, when all that is known is that the question was sent. The two messages this
// used to cycle alongside it ('Hacettepe kaynakları taranıyor...', 'Cevap üretiliyor...')
// named states the server now reports for real, on a timer that had no connection to whether
// they were happening — so the placeholder regularly contradicted the server.
// Module-level so the arrays keep their identity: useCyclingText restarts when they change.
const LOADING_MESSAGES: Record<Language, readonly string[]> = {
    TR: ['Düşünüyor...'],
    EN: ['Thinking...'],
}

// Stored as flags on the message and worded here, so a language switch re-words them like the
// status line. `interruptedEmpty` is a reload before any text arrived, with nothing to have cut off.
const ANSWER_NOTES: Record<Language, Record<'interrupted' | 'interruptedEmpty' | 'unsaved', string>> = {
    EN: {
        interrupted: 'This answer was cut off before it finished. Ask again for the full answer.',
        interruptedEmpty: 'This answer was interrupted. Please ask again.',
        unsaved:
            "This answer couldn't be saved, so it can't be rated and won't be remembered in follow-up questions.",
    },
    TR: {
        interrupted: 'Bu yanıt tamamlanmadan kesildi. Tam yanıt için soruyu tekrar sorun.',
        interruptedEmpty: 'Bu yanıt yarıda kaldı. Lütfen tekrar sorun.',
        unsaved: 'Bu yanıt kaydedilemedi. Puanlanamaz ve sonraki sorularda hatırlanmaz.',
    },
}

// placeCitations marks each bubble group as a span with a data-cite list; any other span passes
// through untouched.
const citationSpan = (sources: NonNullable<Message['sources']>, language: Language) =>
    function CitationSpan({ node, ...props }: ComponentProps<'span'> & ExtraProps) {
        const cite = node?.properties.dataCite
        if (typeof cite !== 'string') return <span {...props} />
        return <CitationBubbles numbers={cite.split(',').map(Number)} sources={sources} language={language} />
    }

type ChatMessageProps = Pick<
    Message,
    | 'sender'
    | 'message'
    | 'isPlaceholder'
    | 'status'
    | 'timestamp'
    | 'session_id'
    | 'sources'
    | 'citations'
    | 'interrupted'
    | 'unsaved'
> & {
    feedbackUrl: string
    language: Language
}

const ChatMessage = ({
    sender,
    message,
    isPlaceholder,
    status,
    timestamp,
    session_id,
    sources,
    citations,
    interrupted,
    unsaved,
    feedbackUrl,
    language,
}: ChatMessageProps) => {
    const cyclingMsg = useCyclingText(LOADING_MESSAGES[language])
    // Streamed answers animate toward the text received so far; history and human turns show
    // at once. The smoother tells them apart by whether the text grew after mounting.
    // '' while the placeholder is up, so the first chunk animates in instead of landing whole.
    const displayedMsg = useSmoothedText(isPlaceholder ? '' : (message ?? ''))
    const [showFeedbackModal, setShowFeedbackModal] = useState(false)
    // Seeded from localStorage so a rated answer stays rated after a reload. A live answer mounts
    // before its `done` brings a timestamp, and a brand-new answer cannot be done yet anyway.
    const [feedbackDone, setFeedbackDone] = useState(
        () => !!timestamp && isFeedbackDone(localStorage, session_id, timestamp),
    )

    // Holds the feedback button back until the text has finished revealing, rather than letting
    // it appear on the `done` event while the smoother is still catching up.
    const isTypingComplete = displayedMsg === message
    const showFeedbackButton =
        sender === 'AI' && !isPlaceholder && isTypingComplete && timestamp && !feedbackDone
    // Offsets index the full answer, so bubbles wait for the reveal to finish, like the feedback
    // button: added to a partly revealed prefix, they would land on the wrong paragraphs. Memoized
    // so a finished answer's bubbles keep their identity, and an open card its state, when
    // ChatConversations re-renders for a later message.
    const showCitations = sender === 'AI' && !isPlaceholder && isTypingComplete && !!sources?.length
    const remarkPlugins = useMemo(
        () => (showCitations ? [remarkGfm, remarkCitations(sources!, citations ?? [])] : [remarkGfm]),
        [showCitations, sources, citations],
    )
    const components = useMemo<Components | undefined>(
        () => (showCitations ? { span: citationSpan(sources!, language) } : undefined),
        [showCitations, sources, language],
    )
    // Before the first status the placeholder only knows the question was sent, so the deer
    // waits; once the server says what it is doing, that step's icon stands in until text arrives.
    const pending = status ? describeStatus(status, language) : null
    const PendingIcon = pending?.icon
    // Waits for the reveal like the feedback button, so a note never sits under half-shown text.
    const note =
        sender === 'AI' && !isPlaceholder && isTypingComplete
            ? interrupted
                ? ANSWER_NOTES[language][message ? 'interrupted' : 'interruptedEmpty']
                : unsaved
                  ? ANSWER_NOTES[language].unsaved
                  : null
            : null

    if (sender === 'Human') {
        return (
            <div className="max-w-[85%] self-end rounded-[18px] rounded-br-[4px] bg-secondary px-4 py-2 whitespace-pre-wrap text-secondary-foreground">
                {displayedMsg}
            </div>
        )
    }

    return (
        <div className="flex items-start gap-3">
            {isPlaceholder && PendingIcon ? (
                <PendingIcon
                    aria-hidden="true"
                    strokeWidth={1.7}
                    className="mt-0.5 size-6 shrink-0 animate-breathe p-0.5 text-muted-foreground"
                />
            ) : (
                <DeerMark
                    className={`mt-0.5 size-6 shrink-0 ${isPlaceholder ? 'animate-breathe text-muted-foreground' : 'text-primary'}`}
                />
            )}
            <div className="flex min-w-0 flex-1 flex-col items-start">
                {isPlaceholder ? (
                    // The cycling animation covers the seconds before the backend reports what it
                    // is actually doing; a real status event takes over from there.
                    <p className="text-muted-foreground" aria-live="polite">
                        {pending?.text ?? cyclingMsg}
                    </p>
                ) : (
                    message && (
                        <div className="markdown w-full">
                            <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
                                {displayedMsg}
                            </ReactMarkdown>
                        </div>
                    )
                )}
                {note && (
                    <p className={`text-[13px] text-muted-foreground ${message ? 'mt-2' : ''}`}>{note}</p>
                )}
                {showFeedbackButton && (
                    <button
                        onClick={() => setShowFeedbackModal(true)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                        <MessageSquare aria-hidden="true" className="feedback-icon-wiggle size-3.5" />
                        {language === 'TR' ? 'Geri bildirimde bulun' : 'Give feedback'}
                    </button>
                )}
                {timestamp && (
                    <FeedbackModal
                        open={showFeedbackModal}
                        onClose={() => setShowFeedbackModal(false)}
                        onDone={() => {
                            markFeedbackDone(localStorage, session_id, timestamp)
                            setFeedbackDone(true)
                        }}
                        timestamp={timestamp}
                        session_id={session_id}
                        feedbackUrl={feedbackUrl}
                        language={language}
                    />
                )}
            </div>
        </div>
    )
}

export default ChatMessage
