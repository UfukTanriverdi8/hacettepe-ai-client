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

// How close to the bottom still counts as reading the latest message.
const STICK_THRESHOLD_PX = 80;

const ChatConversations = ({ chatHistory, language, feedbackUrl, style }: ChatConversationsProps) => {

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    // A ref, not state: read inside the observer, never rendered.
    const stickToBottom = useRef(true);

    // Follows the content's height rather than chatHistory. Status events rewrite the history
    // without changing the height, and useSmoothedText keeps revealing on its own timer after
    // the last event, so scrolling on history changes both jumps needlessly and stops early.
    useEffect(() => {
        const container = chatContainerRef.current;
        const content = contentRef.current;
        if (!container || !content) return;
        const observer = new ResizeObserver(() => {
            if (stickToBottom.current) container.scrollTop = container.scrollHeight;
        });
        observer.observe(content);
        return () => observer.disconnect();
    }, []);

    // Sending a question means wanting to see the answer, wherever the reader had scrolled.
    // Also runs on mount, which opens a restored history at its latest message.
    const humanTurns = chatHistory.filter(chat => chat.sender === 'Human').length;
    useEffect(() => {
        const container = chatContainerRef.current;
        if (!container) return;
        stickToBottom.current = true;
        container.scrollTop = container.scrollHeight;
    }, [humanTurns]);

    const handleScroll = () => {
        const container = chatContainerRef.current;
        if (!container) return;
        stickToBottom.current = container.scrollHeight - container.scrollTop - container.clientHeight < STICK_THRESHOLD_PX;
    };

  return (
    <div ref={chatContainerRef} onScroll={handleScroll} style={style} className="min-h-0 basis-0 overflow-y-auto transition-[flex-grow] duration-500 ease-out motion-reduce:transition-none">
      <div ref={contentRef} className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 pb-6 text-[15px]">
        {chatHistory.map((chat, index) => (
          <ChatMessage key={index} sender={chat.sender} message={chat.message} isPlaceholder={chat.isPlaceholder} status={chat.status} timestamp={chat.timestamp} session_id={chat.session_id} feedbackUrl={feedbackUrl} language={language} />
        ))}
      </div>
    </div>
  );
};

export default ChatConversations;
