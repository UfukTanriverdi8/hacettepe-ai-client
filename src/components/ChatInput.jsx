import { FaArrowUp, FaTrashCan } from "react-icons/fa6";
import { useState} from 'react';

const ChatInput = ({chatHistory, setChatHistory, language, activeBackend, singleAgentApiUrl, multiAgentApiUrl}) => {
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState(() => {
        const savedSessionId = localStorage.getItem('session_id');
        return savedSessionId ? savedSessionId : null;
    });

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          sendPrompt()
        }
      }

      const sendPrompt = async () => {
        if(loading) return
        if (inputValue === '') return

        const currentQuestion = inputValue
        setInputValue('')
        setLoading(true)

        if(chatHistory.length >= 30){
            let maxLimitEN = "You have reached the maximum chat history limit. Please clear the chat history to continue."
            let maxLimitTR = "Maksimum mesaj sınırına ulaştınız. Devam etmek için lütfen sohbet geçmişini temizleyin."
            alert(language === 'EN' ? maxLimitEN : maxLimitTR)
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

        try {
            let responseText
            let timestamp
            let newSessionId

            const requestBody = { action: 'chat', prompt: currentQuestion }
            if (sessionId) requestBody.session_id = sessionId

            const apiUrl = activeBackend === 'multi_agent' ? multiAgentApiUrl : singleAgentApiUrl
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            })

            if (!response.ok) {
                alert("We're sorry, but something went wrong. Please try again later.")
                throw new Error('Network response was not ok')
            }

            const data = await response.json()

            if (activeBackend === 'multi_agent') {
                const parsed = JSON.parse(data.body)
                responseText = parsed.response
                timestamp = parsed.timestamp
                newSessionId = parsed.session_id
            } else {
                responseText = data.response
                timestamp = data.timestamp
                newSessionId = data.session_id
            }

            if (newSessionId) {
                setSessionId(newSessionId)
                localStorage.setItem('session_id', newSessionId)
            }

            setChatHistory(prevHistory => prevHistory.map(message =>
                message.id === aiMessageId
                    ? { ...message, message: responseText, isPlaceholder: false, skipTypewriter: true, timestamp, question: currentQuestion, session_id: newSessionId, apiUrl }
                    : message
            ))

        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    }

    const clearChat = () => {
        if (confirm("Sohbet geçmişini temizlemek istediğine emin misiniz?") == true) {
            setChatHistory([])
            setSessionId(null)
            localStorage.removeItem('session_id')
        }
      }

    return (
        <div className="flex justify-center items-center p-2 pt-0">
          <div className="flex items-center w-full max-w-3xl">
            <div className="flex-grow h-14">
              <input
                type="text"
                placeholder={language === 'EN' ? 'What would you like to know about Hacettepe?' : 'Hacettepe hakkında ne öğrenmek istersiniz?'}
                autoComplete='off'
                value={inputValue}
                onKeyDown={handleKeyDown}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full h-14 px-4 text-white bg-black bg-opacity-50 rounded-xl border-2 border-primary transition-colors duration-300 focus:border-secondary focus:outline-none"
              />
            </div>
            <div className="flex-shrink-0 ml-2 text-2xl">
              <button
              onClick={sendPrompt}
              className={`transition-all duration-300 p-2 rounded-md focus:outline-none focus:ring-2 ${loading ? 'bg-black text-secondary' : 'bg-secondary text-tertiary hover:bg-secondary-red '} `}>
                <FaArrowUp />
              </button>
            </div>
            <div className="flex-shrink-0 ml-2 text-2xl">
              <button
              onClick={clearChat}
              className="bg-black text-tertiary p-2 rounded-md transition-all hover:bg-secondary duration-300 focus:outline-none focus:ring-2">
                <FaTrashCan />
              </button>
            </div>
          </div>
        </div>
      )
}

export default ChatInput
