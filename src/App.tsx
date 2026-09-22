import Header from './components/Header'
import ChatConversations from './components/ChatConversations'
import ChatInput from './components/ChatInput'
import Footer from './components/Footer'
import InfoModal from './components/InfoModal'
import LoadingScreen from './components/LoadingScreen'
import ConfigErrorScreen from './components/ConfigErrorScreen'
import { loadConfig } from './config'
import { useState, useEffect } from 'react'
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.min.css';
import type { AppConfig, Language, Message } from './types'

const App =  () => {
    const [openModal, setOpenModal] = useState(false)
    const toggleModal = () => {
        setOpenModal(!openModal)  // Toggle the modal's open state
    };

    const [chatHistory, setChatHistory] = useState<Message[]>(() => {
        // Retrieve chat history from localStorage or default to []
        const savedChatHistory = localStorage.getItem('chatHistory')
        if (savedChatHistory) {
            const parsed: Message[] = JSON.parse(savedChatHistory)
            // Mark all loaded messages to skip typewriter effect
            return parsed.map(msg => ({ ...msg, skipTypewriter: true }))
        }
        return []
    })
    
    useEffect(() => {
        // Store chat history in localStorage when it changes
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory))
    }, [chatHistory])

    // Pinned while there is no way to change it. The EN strings stay in the components for a
    // future settings page; the stored key is dropped so an earlier EN choice does not stick.
    const language: Language = 'TR'
    useEffect(() => {
        localStorage.removeItem('language')
    }, [])

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
        return <LoadingScreen />
    }

    return (
    <div className="flex flex-col h-screen bg-primary/85 text-tertiary">
        <Header />
        <div className="grow overflow-auto scrollable max-h-full">
        <ChatConversations chatHistory={chatHistory} language={language} feedbackUrl={config.feedbackUrl} />
        </div>
        <ChatInput language={language} chatHistory={chatHistory} setChatHistory={setChatHistory} chatUrl={config.chatUrl} />
        {openModal && <InfoModal language={language} onClose={toggleModal} />}
        <Footer onInfoClick={toggleModal} />
        <ToastContainer />
    </div>
    )
}

export default App
