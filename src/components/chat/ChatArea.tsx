import React from 'react';
import { Archive, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatMessage, Conversation } from '@/types/chat';
import { useConversationStatus } from '@/hooks/useConversationStatus';
import { formatDayTime } from '@/lib/formatters';
import ChatThreadHeader from './ChatThreadHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import NoSelectedChat from './NoSelectedChat';

interface ChatAreaProps {
  selectedChat: string | null;
  selectedConversation: Conversation | undefined;
  messages: ChatMessage[];
  loading: boolean;
  onNewMessage?: (message: ChatMessage) => void;
  onHistoryDeleted?: (sessionId: string) => void;
  /** Presente apenas no mobile */
  onBack?: () => void;
  /** Presente apenas no mobile */
  onOpenInfo?: () => void;
}

const ChatArea = ({
  selectedChat,
  selectedConversation,
  messages,
  loading,
  onNewMessage,
  onHistoryDeleted,
  onBack,
  onOpenInfo,
}: ChatAreaProps) => {
  const { statusPorSession, reabrirConversa, mudandoStatus } = useConversationStatus();

  if (!selectedChat) {
    return <NoSelectedChat />;
  }

  const statusInfo = statusPorSession.get(selectedChat);
  const status = statusInfo?.status ?? 'aberta';
  const statusDate = status === 'arquivada' ? statusInfo?.arquivadaEm : statusInfo?.fechadaEm;

  return (
    <div className="flex h-full flex-col">
      <ChatThreadHeader
        selectedConversation={selectedConversation}
        onBack={onBack}
        onOpenInfo={onOpenInfo}
        onHistoryDeleted={onHistoryDeleted}
      />
      <div className="min-h-0 flex-1 overflow-y-scroll">
        <MessageList messages={messages} loading={loading} />
      </div>
      {status === 'aberta' ? (
        <MessageInput
          selectedChat={selectedChat}
          selectedConversation={selectedConversation}
          onNewMessage={onNewMessage}
        />
      ) : (
        // Conversa fechada/arquivada: substitui o campo de mensagem pelo aviso
        // de status com a ação de reabertura.
        <div className="border-t bg-muted/50 px-4 py-3" role="status">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              {status === 'arquivada' ? (
                <Archive className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              Conversa {status === 'arquivada' ? 'arquivada' : 'fechada'}
              {statusDate ? ` em ${formatDayTime(statusDate)}` : ''} — reabra para enviar mensagens.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => reabrirConversa(selectedChat)}
              disabled={mudandoStatus}
            >
              {mudandoStatus ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              )}
              Reabrir conversa
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatArea;
