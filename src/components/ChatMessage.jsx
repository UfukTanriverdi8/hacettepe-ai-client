import { useEffect, useState } from 'react'
import { FaUser } from "react-icons/fa6"
import { GiDeerHead } from "react-icons/gi"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import FeedbackModal from './FeedbackModal'
import { useCyclingText } from '../hooks/useCyclingText'

const LOADING_MESSAGES = ['🤔 Düşünüyor...','🦌 Hacettepe kaynakları taranıyor...' ,'🧑‍🍳 Cevap üretiliyor...']

const ChatMessage = ({ sender, message, isPlaceholder, skipTypewriter, status, timestamp, question, session_id, feedbackUrl, language }) => {
    const cyclingMsg = useCyclingText(LOADING_MESSAGES)
    const [displayedMsg, setDisplayedMsg] = useState("")
    const [isTypingComplete, setIsTypingComplete] = useState(false)
    const [showFeedbackModal, setShowFeedbackModal] = useState(false)
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

    useEffect(() => {
        if (sender === 'AI' && isPlaceholder) {
            // Cycling loading animation now lives in useCyclingText
            return

        } else if (sender === 'AI' && !skipTypewriter) {
            // Greeting message — one-time typewriter
            setDisplayedMsg('')
            setIsTypingComplete(false)
            let charIndex = 0
            const interval = setInterval(() => {
                setDisplayedMsg(message.slice(0, charIndex + 1))
                charIndex++
                if (charIndex >= message.length) {
                    clearInterval(interval)
                    setIsTypingComplete(true)
                }
            }, 25)
            return () => clearInterval(interval)

        } else {
            // Instant display — real AI responses, history, human messages
            setDisplayedMsg(message)
            setIsTypingComplete(true)
        }
    }, [message])

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
