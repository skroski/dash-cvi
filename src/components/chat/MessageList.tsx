import React, { useRef, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/types/chat';
import MessageItem from './MessageItem';
import EmptyState from '@/components/shared/EmptyState';
import { SkeletonMessages } from '@/components/shared/skeletons';

interface MessageListProps {
  messages: ChatMessage[];
  loading: boolean;
}

const MessageList = ({ messages, loading }: MessageListProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  // Scroll to the bottom (most recent message) whenever messages change
  useEffect(() => {
    if (messages.length > 0 && lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  // Reverse messages for display (oldest at top, newest at bottom)
  const displayMessages = [...messages].reverse();

  return (
    <ScrollArea className="flex-1 overflow-y-scroll p-4" scrollAreaRef={scrollAreaRef}>
      {loading ? (
        <SkeletonMessages />
      ) : displayMessages.length === 0 ? (
        <EmptyState
          icon={<MessageSquare />}
          title="Nenhuma mensagem"
          description="As mensagens desta conversa aparecerão aqui."
        />
      ) : (
        <div className="space-y-4">
          {displayMessages.map((message, index) => (
            <div
              key={`msg-${index}`}
              ref={index === displayMessages.length - 1 ? lastMessageRef : undefined}
            >
              <MessageItem message={message} index={index} />
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
};

export default MessageList;
