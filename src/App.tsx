import Header from './components/Header'
import ChatConversations from './components/ChatConversations'
import ChatInput from './components/ChatInput'
import DeerMark from './components/DeerMark'
import InfoModal from './components/InfoModal'
import NewChatDialog from './components/NewChatDialog'
import LoadingScreen from './components/LoadingScreen'
import ConfigErrorScreen from './components/ConfigErrorScreen'
import { TooltipProvider } from '@/components/ui/tooltip'
import { loadConfig } from './config'
import { useSettings } from './hooks/useSettings'
import { useState, useEffect } from 'react'
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.min.css';
import type { AppConfig, Message } from './types'

const App =  () => {
    const { theme, setTheme, language, setLanguage } = useSettings()
    const [infoOpen, setInfoOpen] = useState(false)
    const [newChatOpen, setNewChatOpen] = useState(false)

    const [chatHistory, setChatHistory] = useState<Message[]>(() => {
        // Retrieve chat history from localStorage or default to []
        const savedChatHistory = localStorage.getItem('chatHistory')
        return savedChatHistory ? JSON.parse(savedChatHistory) : []
    })

    useEffect(() => {
        // Store chat history in localStorage when it changes
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory))
    }, [chatHistory])

    const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem('session_id'))

    const startNewChat = () => {
        setChatHistory([])
        setSessionId(null)
        localStorage.removeItem('session_id')
    }

    const [config, setConfig] = useState<AppConfig | null>(null)
    const [configError, setConfigError] = useState<unknown>(null)
    const [configRetryToken, setConfigRetryToken] = useState(0)

    useEffect(() => {
        let cancelled = false
        setConfigError(null)
        loadConfig()
            .then(c => { if (!cancelled) setConfig(c) })
            .catch(e => { if (!cancelled) setConfigError(e) })
        return () => { cancelled = true }
    }, [configRetryToken])

    const retryConfig = () => setConfigRetryToken(prev => prev + 1)

    if (configError) {
        return <ConfigErrorScreen onRetry={retryConfig} />
    }

    if (!config) {
        return <LoadingScreen language={language} />
    }

    const tr = language === 'TR'
    const hasChat = chatHistory.length > 0

    // One tree for both states, so ChatInput never remounts: it holds the in-flight request and
    // its loading flag, and a remount on the first question would drop both mid-stream. Instead
    // the spacers around the composer give their height to the conversation as it fills in,
    // which is what slides the composer from the middle of the page to the bottom.
    const grow = (value: number) => ({ flexGrow: value })

    return (
    <TooltipProvider delayDuration={400}>
    <div className="flex h-dvh flex-col bg-background text-foreground">
        <Header
            language={language}
            setLanguage={setLanguage}
            theme={theme}
            setTheme={setTheme}
            hasChat={hasChat}
            onNewChat={() => setNewChatOpen(true)}
            onInfoClick={() => setInfoOpen(true)}
        />
        <main className="flex min-h-0 flex-1 flex-col">
            <div aria-hidden="true" style={grow(hasChat ? 0 : 1)} className="basis-0 transition-[flex-grow] duration-500 ease-out motion-reduce:transition-none" />
            <ChatConversations chatHistory={chatHistory} language={language} feedbackUrl={config.feedbackUrl} style={grow(hasChat ? 1 : 0)} />
            {/* Collapses by animating its grid row from 1fr to 0fr, which a height transition
                cannot do for content of unknown height. */}
            <div
                aria-hidden={hasChat}
                className={`grid transition-[grid-template-rows,opacity] duration-400 ease-out motion-reduce:transition-none ${hasChat ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}
            >
                <div className="overflow-hidden">
                    <div className="flex flex-col items-center gap-3 px-4 pb-6 text-center">
                        <DeerMark className="size-10 text-primary" />
                        <h2 className="text-2xl font-medium tracking-tight text-balance">
                            {tr ? 'Merhaba! Bugün size nasıl yardımcı olabilirim?' : 'Hello! How can I help you today?'}
                        </h2>
                    </div>
                </div>
            </div>
            <div className="mx-auto w-full max-w-3xl shrink-0 px-4">
                <ChatInput
                    language={language}
                    chatHistory={chatHistory}
                    setChatHistory={setChatHistory}
                    sessionId={sessionId}
                    setSessionId={setSessionId}
                    chatUrl={config.chatUrl}
                />
                <p className="px-2 pt-2 pb-3 text-center text-xs text-muted-foreground">
                    {tr
                        ? 'Hacettepe AI hata yapabilir. Önemli bilgileri resmi duyurulardan doğrulayın.'
                        : 'Hacettepe AI can make mistakes. Check important details against official announcements.'}
                </p>
            </div>
            <div aria-hidden="true" style={grow(hasChat ? 0 : 1.4)} className="basis-0 transition-[flex-grow] duration-500 ease-out motion-reduce:transition-none" />
        </main>
        <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} language={language} />
        <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} onConfirm={startNewChat} language={language} />
        <ToastContainer />
    </div>
    </TooltipProvider>
    )
}

export default App
