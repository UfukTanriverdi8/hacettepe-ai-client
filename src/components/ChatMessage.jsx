import { useEffect, useState } from 'react'
import { FaUser } from "react-icons/fa6"
import { GiDeerHead } from "react-icons/gi"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import FeedbackModal from './FeedbackModal'
import { useCyclingText } from '../hooks/useCyclingText'
import { useSmoothedText } from '../hooks/useSmoothedText'

// Claims only what is true of the window it covers: the seconds before the backend's first
// status event, when all that is known is that the question was sent. The two messages this
// used to cycle alongside it ('🦌 Hacettepe kaynakları taranıyor...', '🧑‍🍳 Cevap üretiliyor...')
// named states the server now reports for real, on a timer that had no connection to whether
// they were happening — so the placeholder regularly contradicted the server.
const LOADING_MESSAGES = ['🤔 Düşünüyor...']

const ChatMessage = ({ sender, message, isPlaceholder, skipTypewriter, status, timestamp, question, session_id, feedbackUrl, language }) => {
    const cyclingMsg = useCyclingText(LOADING_MESSAGES)
    // The greeting is the one message whose full text exists when it mounts, so it is the one
    // that still types at a fixed rate. Everything else — streamed answers, history, human
    // turns — goes through the smoother, which decides between animating and instant display
    // from whether the text grew after mounting.
    const isGreeting = sender === 'AI' && !isPlaceholder && !skipTypewriter
    // '' while the placeholder is up, so the first chunk animates in instead of landing whole.
    const smoothedMsg = useSmoothedText(isPlaceholder ? '' : (message ?? ''))
    const [typedMsg, setTypedMsg] = useState('')
    const [greetingComplete, setGreetingComplete] = useState(false)
    const [showFeedbackModal, setShowFeedbackModal] = useState(false)
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

    useEffect(() => {
        if (!isGreeting) return

        setTypedMsg('')
        setGreetingComplete(false)
        let charIndex = 0
        const interval = setInterval(() => {
            setTypedMsg(message.slice(0, charIndex + 1))
            charIndex++
            if (charIndex >= message.length) {
                clearInterval(interval)
                setGreetingComplete(true)
            }
        }, 25)
        return () => clearInterval(interval)
    }, [message, isGreeting])

    const displayedMsg = isGreeting ? typedMsg : smoothedMsg
    // Holds the feedback button back until the text has finished revealing, rather than letting
    // it appear on the `done` event while the smoother is still catching up.
    const isTypingComplete = isGreeting ? greetingComplete : displayedMsg === message

    const showFeedbackButton = sender === 'AI' && !isPlaceholder && isTypingComplete && timestamp && !feedbackSubmitted

    return (
        <div className="w-full max-w-3xl p-2 mb-2 flex items-start text-tertiary bg-black bg-opacity-50 rounded-lg">
            {sender === 'AI' && <GiDeerHead className={`flex-shrink-0 w-8 mr-2 mt-1 text-2xl ${isPlaceholder ? 'text-[#9ca3af]' : 'text-secondary'}`} />}
            {sender === 'Human' && <FaUser className="flex-shrink-0 w-8 mr-2 mt-1 text-2xl" />}
            <div className="flex flex-col flex-1">
                {sender === 'AI' ? (
                    isPlaceholder ? (
                        // The cycling animation covers the seconds before the backend reports
                        // what it is actually doing; a real status event takes over from there.
                        <p className="text-[#9ca3af]">{status || cyclingMsg}</p>
                    ) : (
                        <div className="prose prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {displayedMsg}
                            </ReactMarkdown>
                        </div>
                    )
                ) : (
                    <p>{displayedMsg}</p>
                )}
                {showFeedbackButton && (
                    <button
                        onClick={() => setShowFeedbackModal(true)}
                        className="mt-2 text-base text-white-text hover:text-secondary transition-colors duration-200 self-end"
                    >
                        <span className="feedback-emoji-wiggle">💬</span>{' '}
                        {language === 'TR' ? 'Geri bildirimde bulun' : 'Give feedback'}
                    </button>
                )}
                {showFeedbackModal && (
                    <FeedbackModal
                        onClose={(submitted) => {
                            setShowFeedbackModal(false)
                            if (submitted) setFeedbackSubmitted(true)
                        }}
                        question={question}
                        answer={message}
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
