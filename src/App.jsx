import Header from './components/Header'
import ChatConversations from './components/ChatConversations'
import ChatInput from './components/ChatInput'
import Footer from './components/Footer'
import InfoModal from './components/InfoModal'
import LoadingScreen from './components/LoadingScreen'
import ConfigErrorScreen from './components/ConfigErrorScreen'
import { loadConfig } from './config'
import { useState, useEffect } from 'react'
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.min.css';

const App =  () => {
    const [openModal, setOpenModal] = useState(false)
    const toggleModal = () => {
        setOpenModal(!openModal)  // Toggle the modal's open state
    };

    const [chatHistory, setChatHistory] = useState(() => {
        // Retrieve chat history from localStorage or default to []
        const savedChatHistory = localStorage.getItem('chatHistory')
        if (savedChatHistory) {
            const parsed = JSON.parse(savedChatHistory)
            // Mark all loaded messages to skip typewriter effect
            return parsed.map(msg => ({ ...msg, skipTypewriter: true }))
        }
        return []
    })
    
    useEffect(() => {
        // Store chat history in localStorage when it changes
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory))
    }, [chatHistory])

    const [language, setLanguage] = useState(() => {
        // Retrieve language from localStorage or default to 'TR'
        const savedLanguage = localStorage.getItem('language')
        return savedLanguage ? savedLanguage : 'TR'
      })
    
      useEffect(() => {
        // Store language preference in localStorage when it changes
        localStorage.setItem('language', language)
      }, [language])

    const enLangChange = "Language changed to English! Chat will be in English too!"
    const trLangChange = "Dil Türkçeye değiştirildi! Cevaplar Türkçe olacak."
    const langChangeInfoMsgEN = "Are you sure you want to change the language? This action will clear your chat history."
    const langChangeInfoMsgTR = "Dili değiştirmek istediğinizden emin misiniz? Bu eylem sohbet geçmişinizi silecek."
    const handleLanguageChange = () => {
        const langChangeInfoMsg = language === 'EN' ? langChangeInfoMsgEN : langChangeInfoMsgTR
        if(chatHistory.length > 0){
            if(confirm(langChangeInfoMsg) == true){
                changeLanguage()
            } else {
                return
            }
        }else{
            changeLanguage()
        }

      }

    const [config, setConfig] = useState(null)
    const [configError, setConfigError] = useState(null)
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

      const changeLanguage = () => {
        setChatHistory([]) // Clear the chat history
        localStorage.removeItem('session_id') // Clear session_id
        const newLang = language === 'EN' ? 'TR' : 'EN'
            setLanguage(newLang)
    
            toast.dismiss()
            // Show a toast notification
            toast.success(`${newLang === 'EN' ? enLangChange : trLangChange}`, {
              position: "top-left",
              autoClose: 3000,  // auto-close the toast after 3 seconds
              hideProgressBar: false,
              closeOnClick: true,
              draggable: true,
              pauseOnHover: false,
              progress: undefined,
              className: 'custom-toast'
            })
        }
      
    if (configError) {
        return <ConfigErrorScreen onRetry={retryConfig} />
    }

    if (!config) {
        return <LoadingScreen />
    }

    return (
    <div className="flex flex-col h-screen bg-primary bg-opacity-85 text-tertiary">
        <Header className="fixed top-0 left-0 right-0" language={language} handleLanguageChange={handleLanguageChange}/>
        <div className="flex-grow overflow-auto scrollable max-h-full">
        <ChatConversations chatHistory={chatHistory} language={language} feedbackUrl={config.feedbackUrl} />
        </div>
        <ChatInput className="fixed" language={language} chatHistory={chatHistory} setChatHistory={setChatHistory} chatUrl={config.chatUrl} />
        {openModal && <InfoModal language={language} onClose={toggleModal} />}
        <Footer className="fixed bottom-0 left-0 right-0" onInfoClick={toggleModal} />
        <ToastContainer />
    </div>
    )
}

export default App
