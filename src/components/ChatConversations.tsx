import {useRef, useEffect} from 'react';
import ChatMessage from './ChatMessage';
import type { Language, Message } from '../types';


interface ChatConversationsProps {
    chatHistory: Message[]
    language: Language
    feedbackUrl: string
}

const ChatConversations = ({ chatHistory, language, feedbackUrl }: ChatConversationsProps) => {

    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight; // Scroll to bottom
        }
      }, [chatHistory]);

    const greetingMsg = language === 'EN' ? 'Hello! How can I help you today?' : 'Merhaba! Bugün size nasıl yardımcı olabilirim?';
  return (

    <div ref={chatContainerRef} className='flex flex-col items-center p-4 overflow-y-auto h-full scroll-container'>
        <ChatMessage sender='AI' message={greetingMsg} isPlaceholder={false} language={language} />
      {chatHistory.map((chat, index) => (
        <ChatMessage key={index} sender={chat.sender} message={chat.message} isPlaceholder={chat.isPlaceholder} skipTypewriter={chat.skipTypewriter} status={chat.status} timestamp={chat.timestamp} session_id={chat.session_id} feedbackUrl={feedbackUrl} language={language} />
      ))}
    </div>
  );
};

export default ChatConversations;
