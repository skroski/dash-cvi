import React from 'react';
import { ArrowLeft, Phone, Info, Users, LogOut, Megaphone, Timer } from 'lucide-react';
import { formatarTimerTemporario } from '@/lib/grupos';
import { Button } from '@/components/ui/button';
import { Conversation } from '@/types/chat';
import UserAvatar from '@/components/shared/UserAvatar';
import AtendimentoControl from '@/components/atendentes/AtendimentoControl';
import ConversationStatusControl from './ConversationStatusControl';
import DeleteChatHistoryDialog from './DeleteChatHistoryDialog';
import ScheduledMessagesDialog from './ScheduledMessagesDialog';

interface ChatThreadHeaderProps {
  selectedConversation: Conversation | undefined;
  /** Presente apenas no mobile: volta para a lista de conversas. */
  onBack?: () => void;
  /** Presente apenas no mobile: abre o painel de informações do cliente. */
  onOpenInfo?: () => void;
  onHistoryDeleted?: (sessionId: string) => void;
}

const ChatThreadHeader = ({
  selectedConversation,
  onBack,
  onOpenInfo,
  onHistoryDeleted,
}: ChatThreadHeaderProps) => {
  if (!selectedConversation) {
    return (
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-center text-muted-foreground">
          <span>Selecione uma conversa</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b bg-card px-3 py-2.5">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onBack}
            aria-label="Voltar para a lista de conversas"
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        <UserAvatar
          src={selectedConversation.avatar}
          name={selectedConversation.name}
          isGroup={selectedConversation.isGroup}
        />

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">
            {selectedConversation.name}
          </h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {selectedConversation.isGroup ? (
              <span className="flex items-center gap-1">
                {selectedConversation.isGroupActive === false ? (
                  <>
                    <LogOut size={12} aria-hidden="true" />
                    Você não faz mais parte deste grupo — sem mensagens novas
                  </>
                ) : (
                  <>
                    <Users size={12} aria-hidden="true" />
                    {selectedConversation.groupParticipants
                      ? `Grupo · ${selectedConversation.groupParticipants} participantes`
                      : 'Grupo do WhatsApp'}
                  </>
                )}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Phone size={12} aria-hidden="true" />
                {selectedConversation.phone}
              </span>
            )}
            {selectedConversation.petName && selectedConversation.petName !== 'Não informado' && (
              <span className="hidden truncate sm:inline">Pet: {selectedConversation.petName}</span>
            )}
            {/* O que a Uazapi informa do grupo e muda o que dá para fazer aqui */}
            {selectedConversation.isGroup && selectedConversation.groupSomenteLeitura && (
              <span
                className="flex items-center gap-1 text-warning"
                title="Só administradores podem enviar mensagens neste grupo e a instância não é admin."
              >
                <Megaphone size={12} aria-hidden="true" />
                Somente leitura
              </span>
            )}
            {selectedConversation.isGroup && !!selectedConversation.groupTimerTemporario && (
              <span
                className="flex items-center gap-1"
                title="Mensagens temporárias ativas: o WhatsApp apaga as mensagens após esse prazo, então o histórico antigo não fica disponível."
              >
                <Timer size={12} aria-hidden="true" />
                Somem em{' '}
                {formatarTimerTemporario(selectedConversation.groupTimerTemporario)}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Status da conversa, agendamento e atribuição são do fluxo de
              atendimento individual — não fazem sentido num grupo. */}
          {!selectedConversation.isGroup && (
            <>
              <ConversationStatusControl sessionId={selectedConversation.sessionId} />
              <ScheduledMessagesDialog conversation={selectedConversation} />
              <AtendimentoControl
                sessionId={selectedConversation.sessionId}
                clientId={selectedConversation.clientData?.id}
                clienteNome={selectedConversation.name}
              />
            </>
          )}
          {onOpenInfo && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onOpenInfo}
              aria-label="Ver informações do cliente"
            >
              <Info className="h-5 w-5" />
            </Button>
          )}
          {/* Apagar histórico só se aplica a conversas individuais */}
          {!selectedConversation.isGroup && (
            <DeleteChatHistoryDialog
              sessionId={selectedConversation.sessionId}
              clientName={selectedConversation.name}
              onHistoryDeleted={() => onHistoryDeleted?.(selectedConversation.sessionId)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatThreadHeader;
