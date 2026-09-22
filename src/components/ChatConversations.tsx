import { useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';
import ChatMessage from './ChatMessage';
import type { Language, Message } from '../types';

interface ChatConversationsProps {
    chatHistory: Message[]
    language: Language
    feedbackUrl: string
    // Flex growth, animated by App: 0 on an empty chat, 1 once there are messages.
    style: CSSProperties
}

const ChatConversations = ({ chatHistory, language, feedbackUrl, style }: ChatConversationsProps) => {

    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight; // Scroll to bottom
        }
      }, [chatHistory]);

  return (
    <div ref={chatContainerRef} style={style} className="min-h-0 basis-0 overflow-y-auto transition-[flex-grow] duration-500 ease-out motion-reduce:transition-none">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 pb-6 text-[15px]">
        {chatHistory.map((chat, index) => (
          <ChatMessage key={index} sender={chat.sender} message={chat.message} isPlaceholder={chat.isPlaceholder} status={chat.status} timestamp={chat.timestamp} session_id={chat.session_id} feedbackUrl={feedbackUrl} language={language} />
        ))}
      </div>
    </div>
  );
};

export default ChatConversations;
