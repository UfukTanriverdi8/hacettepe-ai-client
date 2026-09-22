import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import DeerMark from './DeerMark'
import FeedbackModal from './FeedbackModal'
import { useCyclingText } from '../hooks/useCyclingText'
import { useSmoothedText } from '../hooks/useSmoothedText'
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

type ChatMessageProps = Pick<Message, 'sender' | 'message' | 'isPlaceholder' | 'status' | 'timestamp' | 'session_id'> & {
    feedbackUrl: string
    language: Language
}

const ChatMessage = ({ sender, message, isPlaceholder, status, timestamp, session_id, feedbackUrl, language }: ChatMessageProps) => {
    const cyclingMsg = useCyclingText(LOADING_MESSAGES[language])
    // Streamed answers animate toward the text received so far; history and human turns show
    // at once. The smoother tells them apart by whether the text grew after mounting.
    // '' while the placeholder is up, so the first chunk animates in instead of landing whole.
    const displayedMsg = useSmoothedText(isPlaceholder ? '' : (message ?? ''))
    const [showFeedbackModal, setShowFeedbackModal] = useState(false)
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

    // Holds the feedback button back until the text has finished revealing, rather than letting
    // it appear on the `done` event while the smoother is still catching up.
    const isTypingComplete = displayedMsg === message
    const showFeedbackButton = sender === 'AI' && !isPlaceholder && isTypingComplete && timestamp && !feedbackSubmitted

    if (sender === 'Human') {
        return (
            <div className="max-w-[85%] self-end rounded-[18px] rounded-br-[4px] bg-secondary px-4 py-2 whitespace-pre-wrap text-secondary-foreground">
                {displayedMsg}
            </div>
        )
    }

    return (
        <div className="flex items-start gap-3">
            <DeerMark className={`mt-0.5 size-6 shrink-0 ${isPlaceholder ? 'animate-breathe text-muted-foreground' : 'text-primary'}`} />
            <div className="flex min-w-0 flex-1 flex-col items-start">
                {isPlaceholder ? (
                    // The cycling animation covers the seconds before the backend reports what it
                    // is actually doing; a real status event takes over from there.
                    <p className="text-muted-foreground" aria-live="polite">{status || cyclingMsg}</p>
                ) : (
                    <div className="markdown w-full">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {displayedMsg}
                        </ReactMarkdown>
                    </div>
                )}
                {showFeedbackButton && (
                    <button
                        onClick={() => setShowFeedbackModal(true)}
                        className="mt-3 rounded-full border px-3 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                        <span className="feedback-emoji-wiggle">💬</span>{' '}
                        {language === 'TR' ? 'Geri bildirimde bulun' : 'Give feedback'}
                    </button>
                )}
                {timestamp && (
                    <FeedbackModal
                        open={showFeedbackModal}
                        onClose={(submitted) => {
                            setShowFeedbackModal(false)
                            if (submitted) setFeedbackSubmitted(true)
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
