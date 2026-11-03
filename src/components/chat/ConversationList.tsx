import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  Loader2,
  Pin,
  MessageSquare,
  Clock,
  ClipboardList,
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { Conversation, ConversationStatusInfo } from '@/types/chat';
import { ClientPendencia, Tag } from '@/types/crm';
import TagBadge from '@/components/tags/TagBadge';
import DeleteChatHistoryDialog from './DeleteChatHistoryDialog';
import UserAvatar from '@/components/shared/UserAvatar';
import EmptyState from '@/components/shared/EmptyState';
import { SkeletonList } from '@/components/shared/skeletons';
import { formatDayTime, formatPhone } from '@/lib/formatters';
import { stripHtmlAndFormatting } from '@/utils/formatMessage';
import { PauseStatusMap, formatTtlDuration } from '@/hooks/useRedisPauseStatus';
import { useConversationStatus } from '@/hooks/useConversationStatus';

const PINS_STORAGE_KEY = 'cvi-chat-pins';

const loadPins = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(PINS_STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
};

interface ConversationListProps {
  conversations: Conversation[];
  selectedChat: string | null;
  setSelectedChat: (id: string) => void;
  isLoading: Record<string, boolean>;
  openPauseDialog: (phoneNumber: string, e: React.MouseEvent) => void;
  startBot: (phoneNumber: string, e: React.MouseEvent) => void;
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  pauseStatus?: PauseStatusMap;
  tagsPorCliente?: Map<number, Tag[]>;
  abertasPorCliente?: Map<number, ClientPendencia[]>;
  onHistoryDeleted?: (sessionId: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  endOfListText?: string;
  conversationPageSize?: number;
}

const ConversationList = ({
  conversations,
  selectedChat,
  setSelectedChat,
  isLoading,
  openPauseDialog,
  startBot,
  loading,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  pauseStatus,
  tagsPorCliente,
  abertasPorCliente,
  onHistoryDeleted,
  emptyTitle = 'Nenhuma conversa encontrada',
  emptyDescription = 'Ajuste os filtros ou aguarde novas mensagens dos clientes.',
  endOfListText = 'Todas as conversas foram carregadas',
  conversationPageSize = 200
}: ConversationListProps) => {
  // Force re-render every minute so elapsed pause time stays accurate
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const { statusPorSession, reabrirConversa, mudandoStatus } = useConversationStatus();

  // Conversas fechadas/arquivadas expandidas manualmente (mostram o card completo)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showArquivadas, setShowArquivadas] = useState(false);
  const [reopeningConversationId, setReopeningConversationId] = useState<string | null>(null);

  const toggleExpanded = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(conversationId)) {
        next.delete(conversationId);
      } else {
        next.add(conversationId);
      }
      return next;
    });
  };

  const handleReabrir = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReopeningConversationId(conversationId);
    reabrirConversa(conversationId, {
      onSuccess: () => {
        setReopeningConversationId(null);
        setExpandedRows(prev => {
          const next = new Set(prev);
          next.delete(conversationId);
          return next;
        });
      },
      onError: () => setReopeningConversationId(null),
    });
  };

  const getPauseInfo = (phone: string) => {
    if (!pauseStatus || pauseStatus.size === 0) return null;
    const normalized = phone.replace(/\D/g, '');
    if (pauseStatus.has(normalized)) return pauseStatus.get(normalized)!;
    const last11 = normalized.slice(-11);
    for (const [key, val] of pauseStatus.entries()) {
      if (key.slice(-11) === last11) return val;
    }
    return null;
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const [pinnedConversations, setPinnedConversations] = useState<string[]>(loadPins);

  const togglePin = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedConversations(prev => {
      const next = prev.includes(conversationId)
        ? prev.filter(id => id !== conversationId)
        : [...prev, conversationId];
      localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const loadingMoreLabel = `Carregando até ${conversationPageSize} conversas...`;

  // Sort conversations: pinned first, then by date
  const sortedConversations = useMemo(() => [...conversations].sort((a, b) => {
    const aIsPinned = pinnedConversations.includes(a.id);
    const bIsPinned = pinnedConversations.includes(b.id);

    if (aIsPinned && !bIsPinned) return -1;
    if (!aIsPinned && bIsPinned) return 1;

    const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
    const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
    return dateB - dateA;
  }), [conversations, pinnedConversations]);

  // Ciclo de vida: abertas no topo; fechadas retraídas logo abaixo;
  // arquivadas em seção recolhida no fim da lista
  const { abertas, fechadas, arquivadas } = useMemo(() => {
    const groups = {
      abertas: [] as Conversation[],
      fechadas: [] as Conversation[],
      arquivadas: [] as Conversation[],
    };

    for (const conversation of sortedConversations) {
      const status = statusPorSession.get(conversation.id)?.status ?? 'aberta';
      if (status === 'fechada') {
        groups.fechadas.push(conversation);
      } else if (status === 'arquivada') {
        groups.arquivadas.push(conversation);
      } else {
        groups.abertas.push(conversation);
      }
    }

    return groups;
  }, [sortedConversations, statusPorSession]);
  // Filtro "Arquivadas" ativo: a seção não pode nascer recolhida
  const somenteArquivadas =
    abertas.length === 0 && fechadas.length === 0 && arquivadas.length > 0;

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Observa o sentinela (fim da lista) e carrega a próxima página quando ele
  // fica visível. Roda em useEffect (não em callback ref) para garantir que scrollRef
  // e sentinelRef já estejam montados - refs de filhos podem ser anexados antes do
  // ref do pai durante o commit do React, deixando scrollRef.current nulo cedo demais.
  useEffect(() => {
    if (!hasMore || loadingMore || !onLoadMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      {
        root: scrollRef.current,
        rootMargin: '150px', // dispara o carregamento um pouco antes de chegar ao fim
        threshold: 0,
      }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore, sortedConversations.length]);

  if (loading) {
    return <SkeletonList rows={8} />;
  }

  /** Linha retraída: conversa fechada/arquivada compacta, com expandir e reabrir. */
  const renderRetractedRow = (conversation: Conversation, statusInfo: ConversationStatusInfo) => {
    const isSelected = selectedChat === conversation.id;
    const isArquivada = statusInfo.status === 'arquivada';
    const isReopening = reopeningConversationId === conversation.id;

    return (
      <div
        key={conversation.id}
        role="listitem"
        className={`group cursor-pointer border-b px-3 py-2 opacity-70 transition-colors hover:bg-accent/50 hover:opacity-100 focus-within:opacity-100 ${
          isSelected ? 'border-l-4 border-l-primary bg-accent opacity-100' : ''
        }`}
        onClick={() => setSelectedChat(conversation.id)}
      >
        <div className="flex items-center gap-2.5">
          <UserAvatar
            src={conversation.avatar}
            name={conversation.name}
            isGroup={conversation.isGroup}
            className="h-7 w-7"
          />
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-sm font-medium text-muted-foreground outline-none focus-visible:underline"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedChat(conversation.id);
            }}
          >
            {conversation.name}
          </button>

          {conversation.unread > 0 && (
            <Badge className="shrink-0 bg-primary px-1.5 text-primary-foreground" aria-label={`${conversation.unread} mensagens não lidas`}>
              {conversation.unread}
            </Badge>
          )}

          <span
            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
              isArquivada
                ? 'border-warning/20 bg-warning/10 text-warning'
                : 'border-border bg-muted text-muted-foreground'
            }`}
          >
            {isArquivada ? 'Arquivada' : 'Fechada'}
          </span>

          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {conversation.lastMessageDate ? formatDayTime(conversation.lastMessageDate) : ''}
          </span>

          <div className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Expandir conversa"
              aria-expanded={false}
              onClick={(e) => toggleExpanded(conversation.id, e)}
              className="h-7 w-7 text-muted-foreground"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={isReopening ? 'Reabrindo conversa' : 'Reabrir conversa'}
              onClick={(e) => handleReabrir(conversation.id, e)}
              disabled={mudandoStatus}
              className="h-7 w-7 text-muted-foreground hover:text-primary"
            >
              {isReopening ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  /** Card completo da conversa (padrão das abertas; fechadas/arquivadas expandidas). */
  const renderFullRow = (conversation: Conversation) => {
    const isPinned = pinnedConversations.includes(conversation.id);
    const isSelected = selectedChat === conversation.id;
    const pauseInfo = getPauseInfo(conversation.phone);
    const pauseLoading = isLoading[`pause-${conversation.phone}`];
    const startLoading = isLoading[`start-${conversation.phone}`];
    const clientId = conversation.clientData?.id;
    const clientTags = clientId ? tagsPorCliente?.get(clientId) || [] : [];
    const pendenciasAbertas = clientId ? abertasPorCliente?.get(clientId)?.length || 0 : 0;
    const statusInfo = statusPorSession.get(conversation.id);
    const isRetraivel = !!statusInfo && statusInfo.status !== 'aberta';
    const isArquivada = statusInfo?.status === 'arquivada';
    const statusDate = isArquivada ? statusInfo?.arquivadaEm : statusInfo?.fechadaEm;
    const isReopening = reopeningConversationId === conversation.id;

    return (
      <div
        key={conversation.id}
        role="listitem"
        className={`group relative cursor-pointer border-b p-3 transition-colors hover:bg-accent/50 focus-within:bg-accent/50 ${
          isSelected ? 'border-l-4 border-l-primary bg-accent' : ''
        }`}
        onClick={() => setSelectedChat(conversation.id)}
      >
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <UserAvatar
              src={conversation.avatar}
              name={conversation.name}
              isGroup={conversation.isGroup}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className="min-w-0 truncate text-left font-medium outline-none focus-visible:underline w-full block"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedChat(conversation.id);
                  }}
                >
                  {conversation.name}
                </button>
                {!conversation.isGroup && conversation.phone && (
                  <div className="text-xs text-muted-foreground truncate font-mono">
                    {formatPhone(conversation.phone)}
                  </div>
                )}
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground mt-0.5">
                {conversation.lastMessageDate ? formatDayTime(conversation.lastMessageDate) : ''}
              </span>
            </div>

            <div className="mt-0.5 flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {stripHtmlAndFormatting(conversation.lastMessage)}
              </p>
              {conversation.unread > 0 && (
                <Badge className="shrink-0 bg-primary px-1.5 text-primary-foreground" aria-label={`${conversation.unread} mensagens não lidas`}>
                  {conversation.unread}
                </Badge>
              )}
            </div>

            {(conversation.petName && conversation.petName !== 'Não informado') ||
            clientTags.length > 0 ||
            pendenciasAbertas > 0 ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {conversation.petName && conversation.petName !== 'Não informado' && (
                  <span className="inline-block max-w-[150px] truncate rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    Pet: {conversation.petName}
                  </span>
                )}
                {pendenciasAbertas > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning tabular-nums"
                    title={`${pendenciasAbertas} pendência(s) em aberto`}
                  >
                    <ClipboardList className="h-3 w-3" aria-hidden="true" />
                    {pendenciasAbertas}
                  </span>
                )}
                {clientTags.slice(0, 2).map(tag => (
                  <TagBadge key={tag.id} tag={tag} />
                ))}
                {clientTags.length > 2 && (
                  <span className="text-[10px] text-muted-foreground">+{clientTags.length - 2}</span>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            {isRetraivel && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Retrair conversa"
                aria-expanded={true}
                onClick={(e) => toggleExpanded(conversation.id, e)}
                className="h-8 w-8 text-muted-foreground"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              aria-label={isPinned ? 'Desafixar conversa' : 'Fixar conversa'}
              aria-pressed={isPinned}
              onClick={(e) => togglePin(conversation.id, e)}
              className={`h-8 w-8 ${isPinned ? 'text-warning' : 'text-muted-foreground'}`}
            >
              <Pin className={`h-4 w-4 ${isPinned ? 'fill-current' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Faixa de status de conversa fechada/arquivada + reabertura */}
        {isRetraivel && (
          <div
            className={`mt-2 flex items-center gap-1.5 rounded-md border px-2 py-1.5 ${
              isArquivada
                ? 'border-warning/30 bg-warning/10'
                : 'border-border bg-muted/60'
            }`}
          >
            {isArquivada ? (
              <Archive className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <span className={`text-xs font-medium ${isArquivada ? 'text-warning' : 'text-muted-foreground'}`}>
              {isArquivada ? 'Arquivada' : 'Fechada'}
              {statusDate ? ` em ${formatDayTime(statusDate)}` : ''}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => handleReabrir(conversation.id, e)}
              disabled={mudandoStatus}
              className="ml-auto h-7 px-2 text-xs"
            >
              {isReopening ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              {isReopening ? 'Reabrindo...' : 'Reabrir'}
            </Button>
          </div>
        )}

        {/* Controles do bot: só fazem sentido em conversas individuais abertas */}
        {!conversation.isGroup && !isRetraivel && (
          <>
            {/* Badge de pausa do bot: prazo de expiração sempre visível */}
            {pauseInfo && (
              <div className="mt-2 flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0 animate-pulse text-destructive" aria-hidden="true" />
                <span className="text-xs font-medium text-destructive">
                  Bot pausado
                </span>
                <span className="ml-auto font-mono text-xs text-destructive">
                  {pauseInfo.ttl < 0 ? 'sem prazo' : `expira em ${formatTtlDuration(pauseInfo.ttl)}`}
                </span>
              </div>
            )}

            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => openPauseDialog(conversation.phone, e)}
                disabled={pauseLoading}
                className="border-warning bg-warning text-warning-foreground hover:bg-warning/90 hover:text-warning-foreground"
              >
                {pauseLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Pause size={16} />
                )}
                Pausar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => startBot(conversation.phone, e)}
                disabled={startLoading}
                className="border-success bg-success text-success-foreground hover:bg-success/90 hover:text-success-foreground"
              >
                {startLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Play size={16} />
                )}
                Ativar
              </Button>
              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                <DeleteChatHistoryDialog
                  sessionId={conversation.sessionId}
                  clientName={conversation.name}
                  onHistoryDeleted={() => onHistoryDeleted?.(conversation.sessionId)}
                />
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  /** Fechadas/arquivadas: retraídas por padrão, card completo quando expandidas. */
  const renderStatusRow = (conversation: Conversation) => {
    const statusInfo = statusPorSession.get(conversation.id);
    if (!statusInfo) return renderFullRow(conversation);
    return expandedRows.has(conversation.id)
      ? renderFullRow(conversation)
      : renderRetractedRow(conversation, statusInfo);
  };

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto" role="list" aria-label="Conversas">
      {abertas.map(renderFullRow)}

      {fechadas.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Fechadas
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] tabular-nums">
              {fechadas.length}
            </Badge>
          </div>
          {fechadas.map(renderStatusRow)}
        </>
      )}

      {arquivadas.length > 0 && (somenteArquivadas ? (
        // Lista filtrada só com arquivadas: seção sempre visível, sem recolher
        <>
          <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            Arquivadas
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] tabular-nums">
              {arquivadas.length}
            </Badge>
          </div>
          {arquivadas.map(renderStatusRow)}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setShowArquivadas(prev => !prev)}
            aria-expanded={showArquivadas}
            className="flex w-full items-center gap-1.5 border-b bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/70"
          >
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            Arquivadas
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] tabular-nums">
              {arquivadas.length}
            </Badge>
            <ChevronDown
              className={`ml-auto h-3.5 w-3.5 transition-transform ${showArquivadas ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          {showArquivadas && arquivadas.map(renderStatusRow)}
        </>
      ))}

      {loadingMore && (
        <div className="flex items-center justify-center p-4" role="status" aria-live="polite">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
          <span className="ml-2 text-sm text-muted-foreground">{loadingMoreLabel}</span>
        </div>
      )}

      {hasMore && !loadingMore && <div ref={sentinelRef} className="h-4 w-full" />}

      {!hasMore && conversations.length > 0 && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          {endOfListText}
        </div>
      )}

      {!loading && conversations.length === 0 && (
        <EmptyState
          icon={<MessageSquare />}
          title={emptyTitle}
          description={emptyDescription}
        />
      )}
    </div>
  );
};

export default ConversationList;
