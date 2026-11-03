import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, MessageSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/types/chat';
import MessageItem from './MessageItem';
import EmptyState from '@/components/shared/EmptyState';
import { SkeletonMessages } from '@/components/shared/skeletons';

// Margem para considerar que o usuário está "no fim" da conversa. Acima disso
// ele está lendo o histórico e nada pode mover a posição dele.
const BOTTOM_THRESHOLD_PX = 120;

interface MessageListProps {
  conversationId: string;
  messages: ChatMessage[];
  loading: boolean;
}

/**
 * Regras de rolagem da thread:
 * - abrir uma conversa posiciona no fim, antes da pintura e sem animação;
 * - mensagem nova só move a visão se o usuário já estava no fim;
 * - assim que ele rola para cima, nada mais mexe na posição — só o botão
 *   "ir para mensagens recentes", que é uma ação explícita dele.
 *
 * Toda a movimentação é instantânea de propósito. A versão anterior animava com
 * requestAnimationFrame, e rAF não roda com a aba em segundo plano: a animação
 * congelava no meio, deixando o usuário presa numa posição intermediária e com
 * o estado de "acompanhando/lendo" travado.
 */
const MessageList = ({ conversationId, messages, loading }: MessageListProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Enquanto true, mensagens novas empurram a visão para baixo. Vira false no
  // instante em que o usuário rola para cima e só volta quando ele retorna ao fim.
  const isPinnedToBottomRef = useRef(true);
  // Qual conversa já teve o posicionamento inicial no fim. Guardar o id (em vez
  // de um booleano) evita depender da ordem entre os efeitos na troca de conversa.
  const pinnedConversationRef = useRef<string | null>(null);

  const [showRecentMessagesButton, setShowRecentMessagesButton] = useState(false);

  // O polling pode devolver um array novo com o mesmo conteúdo. A assinatura
  // evita tratar isso como "mensagem nova" e mexer na posição do usuário.
  const newestMessage = messages[0];
  const messagesSignature = newestMessage
    ? [newestMessage.timestamp, newestMessage.role, newestMessage.content, newestMessage.mediaUrl].join('|')
    : 'empty';

  const isNearBottom = useCallback((viewport: HTMLDivElement) => {
    const distanceToBottom = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
    return distanceToBottom <= BOTTOM_THRESHOLD_PX;
  }, []);

  /** Posiciona no fim imediatamente e volta ao modo "acompanhando". */
  const pinToBottom = useCallback(() => {
    const viewport = scrollAreaRef.current;
    if (!viewport) return;
    viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    isPinnedToBottomRef.current = true;
    setShowRecentMessagesButton(false);
  }, []);

  // Troca de conversa: volta ao modo "acompanhando", independente de onde o
  // usuário tinha parado na conversa anterior. Declarado antes do efeito de
  // posicionamento porque os layout effects rodam na ordem de declaração.
  useLayoutEffect(() => {
    isPinnedToBottomRef.current = true;
    setShowRecentMessagesButton(false);
  }, [conversationId]);

  // Ao abrir a conversa, vai para o fim ANTES da pintura (useLayoutEffect):
  // com useEffect o usuário chegaria a ver um quadro no topo do histórico.
  useLayoutEffect(() => {
    if (loading || messages.length === 0) return;
    if (pinnedConversationRef.current === conversationId) return;
    const viewport = scrollAreaRef.current;
    if (!viewport) return;

    viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    pinnedConversationRef.current = conversationId;
    isPinnedToBottomRef.current = true;
    setShowRecentMessagesButton(false);
  }, [conversationId, loading, messages.length]);

  // Mensagem nova: acompanha se o usuário está no fim; se ele está lendo o
  // histórico, não move nada e só acende o aviso. É um efeito direto (não
  // depende do ResizeObserver abaixo) para que o comportamento principal da
  // thread não fique refém de um mecanismo assíncrono do navegador.
  useLayoutEffect(() => {
    if (loading || messages.length === 0) return;
    // O posicionamento inicial da conversa é responsabilidade do efeito acima
    if (pinnedConversationRef.current !== conversationId) return;

    if (!isPinnedToBottomRef.current) {
      setShowRecentMessagesButton(true);
      return;
    }
    const viewport = scrollAreaRef.current;
    if (!viewport) return;
    viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  }, [conversationId, loading, messagesSignature, messages.length]);

  // Mídia (imagem/áudio) não tem altura antes de carregar, então o conteúdo
  // cresce depois que já posicionamos. O observer reancora no fim enquanto o
  // usuário estiver acompanhando.
  useEffect(() => {
    const content = contentRef.current;
    const viewport = scrollAreaRef.current;
    if (!content || !viewport) return;

    const observer = new ResizeObserver(() => {
      if (!isPinnedToBottomRef.current) {
        // Usuário lendo o histórico: nada se move, só sinalizamos a novidade
        setShowRecentMessagesButton(true);
        return;
      }
      viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    });

    observer.observe(content);
    return () => observer.disconnect();
  }, [conversationId, loading]);

  // Fonte única da verdade sobre "acompanhando ou lendo": qualquer rolagem
  // (roda, toque, barra, teclado) passa por este evento.
  useEffect(() => {
    const viewport = scrollAreaRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      // Antes do posicionamento inicial a posição ainda não é escolha do usuário
      if (pinnedConversationRef.current !== conversationId) return;

      const nearBottom = isNearBottom(viewport);
      isPinnedToBottomRef.current = nearBottom;
      setShowRecentMessagesButton(!nearBottom);
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [conversationId, isNearBottom]);

  // Reverse messages for display (oldest at top, newest at bottom)
  const displayMessages = [...messages].reverse();

  return (
    <div className="relative h-full min-h-0">
      <ScrollArea className="h-full" scrollAreaRef={scrollAreaRef}>
        {/* O padding vive aqui dentro: no Root do ScrollArea ele ficaria fora
            do viewport e falsearia a conta de scrollHeight/clientHeight. */}
        <div ref={contentRef} className="p-4">
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
                <div key={`msg-${index}`}>
                  <MessageItem message={message} index={index} />
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {showRecentMessagesButton && displayMessages.length > 0 && (
        <button
          type="button"
          onClick={pinToBottom}
          className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Ir para as mensagens mais recentes"
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          Ir para mensagens recentes
        </button>
      )}
    </div>
  );
};

export default MessageList;
