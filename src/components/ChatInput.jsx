import { FaArrowUp, FaTrashCan } from "react-icons/fa6";
import { useState} from 'react';

// The backend's status strings are English and defined in app/agent/tool_specs.py
// (STATUS_MESSAGES and POST_TOOL_STATUS). An unmapped status falls through to the raw string,
// so a tool added server-side shows something rather than nothing until this map catches up.
const STATUS_TEXT = {
    'searching the knowledge base...': {
        TR: '🦌 Hacettepe kaynakları taranıyor...',
        EN: '🦌 Searching the knowledge base...',
    },
    'fetching a live page...': {
        TR: '🌐 Güncel sayfa getiriliyor...',
        EN: '🌐 Fetching a live page...',
    },
    // Sent once a tool's results are back, covering the stretch where the model is reasoning
    // over them and nothing is on screen yet. Without it the tool's own status stays up for
    // ~8s, claiming a search is still running after it finished.
    'going through the results...': {
        TR: '📖 Sonuçlar inceleniyor...',
        EN: '📖 Going through the results...',
    },
}

const localizeStatus = (message, language) => STATUS_TEXT[message]?.[language] ?? message

const ChatInput = ({chatHistory, setChatHistory, language, chatUrl}) => {
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

        // Every stream event is a partial update to that one placeholder, so this runs
        // several times per question rather than once at the end.
        const patchAiMessage = (patch) => setChatHistory(prevHistory => prevHistory.map(message =>
            message.id === aiMessageId ? { ...message, ...patch } : message
        ))

        let activeSessionId = sessionId
        let answer = ''
        let errorShown = false

        const handleEvent = (event) => {
            switch (event.type) {
                case 'session':
                    // Sent before any Bedrock work, so the id survives a stream that dies
                    // halfway and the next question continues the same conversation.
                    activeSessionId = event.session_id
                    setSessionId(event.session_id)
                    localStorage.setItem('session_id', event.session_id)
                    break
                case 'status':
                    patchAiMessage({ status: localizeStatus(event.message, language) })
                    break
                case 'token':
                    // Appended, not assigned: one event per text delta, a few hundred per
                    // answer. ChatMessage smooths the arrival rate, so the lumpiness the
                    // network imposes on these does not reach the screen.
                    answer += event.text
                    patchAiMessage({ message: answer, isPlaceholder: false, skipTypewriter: true, status: null })
                    break
                case 'done':
                    // timestamp is the DynamoDB sort key this answer is stored under, and is
                    // absent when the write failed — ChatMessage gates the feedback button on it.
                    patchAiMessage({ timestamp: event.timestamp, question: currentQuestion, session_id: activeSessionId })
                    break
                case 'error':
                    errorShown = true
                    patchAiMessage({ message: event.message, isPlaceholder: false, skipTypewriter: true, status: null })
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
                buffer = lines.pop()
                for (const line of lines) {
                    if (line.trim()) handleEvent(JSON.parse(line))
                }
            }

            buffer += decoder.decode()
            if (buffer.trim()) handleEvent(JSON.parse(buffer))

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
                    skipTypewriter: true,
                    status: null
                })
            }
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
