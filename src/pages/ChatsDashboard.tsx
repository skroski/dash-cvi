
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import ChatLayout from '@/components/chat/ChatLayout';
import { useConversations } from '@/hooks/useConversations';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useUazapiGroups } from '@/hooks/useUazapiGroups';
import PauseDurationDialog from '@/components/PauseDurationDialog';
import { useRedisPauseStatus } from '@/hooks/useRedisPauseStatus';
import { usePendencias } from '@/hooks/usePendencias';
import { useTags } from '@/hooks/useTags';
import { useConversationStatus } from '@/hooks/useConversationStatus';
import { useAtendimentos } from '@/hooks/useAtendimentos';
import { useAtendenteAtivo } from '@/context/AtendenteAtivoContext';
import { getActiveConfig, getWebhookUrl } from '@/config/env';
import { setActiveChat } from '@/lib/activeChat';
import {
  ChatViewMode,
  Conversation,
  ConversationAssignmentFilter,
  ConversationStatusFilter,
} from '@/types/chat';

const ChatsDashboard = () => {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  const [conversationSearchTerm, setConversationSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showOnlyPaused, setShowOnlyPaused] = useState(false);
  const [showOnlyUnanswered, setShowOnlyUnanswered] = useState(false);
  const [showOnlyPendencias, setShowOnlyPendencias] = useState(false);
  const [tagFilterId, setTagFilterId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<ConversationStatusFilter>('todas');
  const [assignmentFilter, setAssignmentFilter] =
    useState<ConversationAssignmentFilter>('todas');
  // Avatares de grupos sem histórico (não existem no estado de conversas)
  const [groupAvatars, setGroupAvatars] = useState<Map<string, string>>(new Map());

  // Pendências e tags dos clientes (para filtros e badges nas conversas)
  const { abertasPorCliente } = usePendencias();
  const { tags, tagsPorCliente } = useTags();

  // Status de ciclo de vida (aberta/fechada/arquivada) para o filtro por status
  const { statusPorSession } = useConversationStatus();

  // Atendente ativo no painel + atendimentos abertos (filtro "Atribuídas")
  const { atendenteAtivoId, atendenteAtivo } = useAtendenteAtivo();
  const { atendimentoPorSession } = useAtendimentos();

  // Ao escolher um atendente no header, o painel já entra filtrado nas
  // conversas atribuídas a ele; sem atendente, volta a mostrar todas
  useEffect(() => {
    setAssignmentFilter(atendenteAtivoId !== null ? 'atribuidas' : 'todas');
  }, [atendenteAtivoId]);

  // Grupos do WhatsApp via Uazapi (aba Grupos, nome real e participantes)
  const { groups, groupsByJid, loading: groupsLoading, refreshGroups } = useUazapiGroups();

  const location = useLocation();

  // A rota define a visão: /groups mostra todos os grupos, /chats as conversas
  const viewMode: ChatViewMode = location.pathname === '/groups' ? 'groups' : 'chats';

  // Reage aos query params da URL (inclusive quando a notificação
  // "Abrir conversa" navega com um novo ?select= já dentro da página)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const selectParam = params.get('select');
    const filterParam = params.get('filter');
    const searchParam = params.get('search');

    if (selectParam) {
      setSelectedChat(selectParam);
    }
    if (filterParam === 'paused') {
      setShowOnlyPaused(true);
    } else if (filterParam === 'unanswered') {
      setShowOnlyUnanswered(true);
    } else if (filterParam === 'pendencias') {
      setShowOnlyPendencias(true);
    }
    if (searchParam) {
      setConversationSearchTerm(searchParam);
    }
  }, [location.search]);

  // Informa ao listener global de notificações qual conversa está aberta,
  // para não tocar som/toast da conversa que o usuário já está lendo
  useEffect(() => {
    setActiveChat(selectedChat);
    return () => setActiveChat(null);
  }, [selectedChat]);

  // Fetch Redis pause status for all blocked phones (polling every 30s)
  const pauseStatus = useRedisPauseStatus();
  
  // Use custom hooks for data fetching and state management
  const { 
    conversations, 
    setConversations, 
    loading: conversationsLoading, 
    loadingMore,
    hasMore,
    totalCount,
    searching: conversationsSearching,
    updateConversationLastMessage, 
    fetchConversations,
    loadMoreConversations,
    updateConversationLocal
  } = useConversations(viewMode === 'chats' ? conversationSearchTerm : '');
  
  // Telefone da conversa selecionada — usado para localizar a mídia no banco
  // da Uazapi (o session_id costuma ser o próprio número, mas o phone é o mais
  // confiável quando difere).
  const selectedChatPhone = conversations.find((c) => c.id === selectedChat)?.phone;

  const {
    messages,
    loading: messagesLoading,
    handleNewMessage
  } = useChatMessages(selectedChat, selectedChatPhone);
  
  // Set up real-time listeners for new chat messages
  useRealtimeUpdates({ 
    updateConversationLastMessage, 
    fetchConversations: async () => {
      return await fetchConversations();
    }
  });

  // Manual refresh handler (na aba Grupos também recarrega a lista da Uazapi)
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (viewMode === 'groups') {
        await Promise.all([
          fetchConversations(),
          refreshGroups().catch((err) => {
            console.error('Erro ao atualizar grupos via Uazapi:', err);
            toast.error('Erro ao atualizar grupos', {
              description: 'Não foi possível consultar a Uazapi. Tente novamente.',
            });
          }),
        ]);
      } else {
        await fetchConversations();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh every 30 seconds to keep conversations up to date
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchConversations();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchConversations, autoRefresh]);

  const handleToggleAutoRefresh = () => setAutoRefresh(prev => !prev);

  // Enriquece as conversas de grupo com os dados reais da Uazapi
  // (nome atual do grupo e total de participantes)
  const enrichedConversations = React.useMemo(() => {
    if (groupsByJid.size === 0) return conversations;
    return conversations.map(conv => {
      if (!conv.isGroup) return conv;
      const group = groupsByJid.get(conv.sessionId);
      if (!group) return conv;
      return {
        ...conv,
        name: group.name || conv.name,
        groupParticipants: group.participantsCount,
      };
    });
  }, [conversations, groupsByJid]);

  // Aba "Grupos": todos os grupos da instância Uazapi, mesclados com as
  // conversas existentes (para manter última mensagem, hora e não lidas)
  const groupConversations = React.useMemo(() => {
    const withHistory = new Map(
      enrichedConversations.filter(conv => conv.isGroup).map(conv => [conv.sessionId, conv])
    );

    const merged: Conversation[] = groups.map(group => {
      const existing = withHistory.get(group.jid);
      if (existing) {
        withHistory.delete(group.jid);
        return existing;
      }
      return {
        id: group.jid,
        name: group.name || `Grupo WhatsApp (${group.jid.split('@')[0]})`,
        lastMessage: 'Sem mensagens recentes',
        time: '',
        unread: 0,
        avatar: groupAvatars.get(group.jid) || '',
        phone: group.jid,
        email: '',
        sessionId: group.jid,
        isGroup: true,
        groupParticipants: group.participantsCount,
      };
    });

    // Grupos com histórico que a Uazapi não listou (ex.: instância saiu do grupo)
    merged.push(...withHistory.values());

    // Com mensagens recentes primeiro; sem histórico, ordem alfabética
    return merged.sort((a, b) => {
      const dateA = a.lastMessageDate?.getTime() ?? 0;
      const dateB = b.lastMessageDate?.getTime() ?? 0;
      if (dateA !== dateB) return dateB - dateA;
      return a.name.localeCompare(b.name);
    });
  }, [enrichedConversations, groups, groupAvatars]);

  // Find the currently selected conversation (pode ser grupo sem histórico)
  const selectedConversation =
    enrichedConversations.find(conv => conv.id === selectedChat) ??
    groupConversations.find(conv => conv.id === selectedChat);

  // Evita repetir a consulta de avatar da mesma conversa (grupos sem
  // histórico mudam de identidade a cada recomputação do memo)
  const avatarFetchAttempted = React.useRef(new Set<string>());

  // Dynamic avatar loader when chat changes
  useEffect(() => {
    if (!selectedChat || !selectedConversation) return;
    if (selectedConversation.avatar && selectedConversation.avatar.startsWith('http')) return;
    if (avatarFetchAttempted.current.has(selectedChat)) return;

    const config = getActiveConfig();
    const uazapiConfig = {
      serverUrl: config.UAZAPI_SERVER_URL,
      instanceToken: config.UAZAPI_INSTANCE_TOKEN,
    };

    if (uazapiConfig.serverUrl && uazapiConfig.instanceToken) {
      avatarFetchAttempted.current.add(selectedChat);
      fetch(`${uazapiConfig.serverUrl.replace(/\/$/, '')}/chat/details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': uazapiConfig.instanceToken
        },
        body: JSON.stringify({
          number: selectedConversation.phone,
          preview: true
        })
      })
      .then(res => res.json())
      .then(data => {
        const avatarUrl = data?.image || data?.imagePreview;
        if (avatarUrl) {
          updateConversationLocal(selectedChat, { avatar: avatarUrl });
          // Grupos sem histórico não estão no estado de conversas: guarda à parte
          setGroupAvatars(prev => new Map(prev).set(selectedChat, avatarUrl));
        }
      })
      .catch(err => console.error("Error fetching avatar from UAZAPI:", err));
    }
  }, [selectedChat, selectedConversation, updateConversationLocal]);

  // Helper: checks if a conversation's phone is paused in Redis
  const isConversationPaused = React.useCallback((phone: string) => {
    if (!pauseStatus || pauseStatus.size === 0) return false;
    const normalized = phone.replace(/\D/g, '');
    if (pauseStatus.has(normalized)) return true;
    const last11 = normalized.slice(-11);
    for (const key of pauseStatus.keys()) {
      if (key.slice(-11) === last11) return true;
    }
    return false;
  }, [pauseStatus]);

  // Filter conversations based on search term, paused filter and unanswered filter
  const filteredConversations = React.useMemo(() => {
    // Aba Grupos usa a lista completa da Uazapi; os demais filtros são da aba Conversas
    let result = viewMode === 'groups' ? groupConversations : enrichedConversations;
    if (viewMode === 'groups' && conversationSearchTerm.trim()) {
      const term = conversationSearchTerm.toLowerCase();
      result = result.filter(conversation =>
        (conversation.name && conversation.name.toLowerCase().includes(term)) ||
        (conversation.phone && conversation.phone.toLowerCase().includes(term)) ||
        (conversation.petName && conversation.petName.toLowerCase().includes(term))
      );
    }
    if (viewMode === 'chats') {
      if (atendenteAtivoId !== null && assignmentFilter === 'atribuidas') {
        result = result.filter(conversation =>
          atendimentoPorSession.get(conversation.sessionId)?.atendenteId === atendenteAtivoId
        );
      }
      if (showOnlyPaused) {
        result = result.filter(conversation => isConversationPaused(conversation.phone));
      }
      if (showOnlyUnanswered) {
        result = result.filter(conversation => conversation.lastMessageSender === 'human');
      }
      if (showOnlyPendencias) {
        result = result.filter(conversation => {
          const clientId = conversation.clientData?.id;
          return !!clientId && (abertasPorCliente.get(clientId)?.length || 0) > 0;
        });
      }
      if (tagFilterId !== null) {
        result = result.filter(conversation => {
          const clientId = conversation.clientData?.id;
          if (!clientId) return false;
          return (tagsPorCliente.get(clientId) || []).some(tag => tag.id === tagFilterId);
        });
      }
      if (statusFilter !== 'todas') {
        result = result.filter(conversation =>
          (statusPorSession.get(conversation.id)?.status ?? 'aberta') === statusFilter
        );
      }
    }
    return result;
  }, [viewMode, groupConversations, enrichedConversations, conversationSearchTerm, showOnlyPaused, showOnlyUnanswered, showOnlyPendencias, tagFilterId, statusFilter, statusPorSession, abertasPorCliente, tagsPorCliente, isConversationPaused, atendenteAtivoId, assignmentFilter, atendimentoPorSession]);

  const hasLocalConversationFilters =
    showOnlyPaused || showOnlyUnanswered || showOnlyPendencias || tagFilterId !== null ||
    statusFilter !== 'todas' ||
    (atendenteAtivoId !== null && assignmentFilter === 'atribuidas');
  const conversationCount =
    viewMode === 'groups' || hasLocalConversationFilters
      ? filteredConversations.length
      : totalCount;

  // Filter messages based on search term
  const filteredMessages = React.useMemo(() => {
    if (!messageSearchTerm.trim()) return messages;
    
    return messages.filter(message => 
      message.content.toLowerCase().includes(messageSearchTerm.toLowerCase())
    );
  }, [messages, messageSearchTerm]);

  const openPauseDialog = (phoneNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPhoneNumber(phoneNumber);
    setPauseDialogOpen(true);
  };

  const closePauseDialog = () => {
    setPauseDialogOpen(false);
  };

  const pauseBot = async (duration: number | null) => {
    try {
      setIsLoading(prev => ({ ...prev, [`pause-${selectedPhoneNumber}`]: true }));
      
      const response = await fetch(getWebhookUrl('pausaBot', '/pausa_bot'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          phoneNumber: selectedPhoneNumber,
          duration,
          unit: 'seconds'
        }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao pausar o bot');
      }
      
      toast.success("Bot pausado", {
        description: duration
          ? `Bot pausado com sucesso para ${selectedPhoneNumber}. O bot ficará pausado até ser reativado manualmente.`
          : `Bot não foi pausado para ${selectedPhoneNumber}.`,
      });
      
    } catch (error) {
      console.error('Erro ao pausar bot:', error);
      toast.error("Erro ao pausar bot", { description: "Ocorreu um erro ao pausar o bot." });
    } finally {
      setIsLoading(prev => ({ ...prev, [`pause-${selectedPhoneNumber}`]: false }));
      closePauseDialog();
    }
  };

  const startBot = async (phoneNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsLoading(prev => ({ ...prev, [`start-${phoneNumber}`]: true }));
      
      const response = await fetch(getWebhookUrl('iniciaBot', '/inicia_bot'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao iniciar o bot');
      }
      
      toast.success("Bot ativado", { description: `Bot ativado com sucesso para ${phoneNumber}` });
    } catch (error) {
      console.error('Erro ao iniciar bot:', error);
      toast.error("Erro ao ativar bot", { description: "Ocorreu um erro ao ativar o bot." });
    } finally {
      setIsLoading(prev => ({ ...prev, [`start-${phoneNumber}`]: false }));
    }
  };

  // Mark a conversation as read when selected
  const markConversationRead = (sessionId: string) => {
    setConversations(currentConversations => 
      currentConversations.map(conv => {
        if (conv.id === sessionId) {
          return { ...conv, unread: 0 };
        }
        return conv;
      })
    );
  };

  const handleSearchMessages = (searchTerm: string) => {
    setMessageSearchTerm(searchTerm);
  };

  const handleSearchConversations = (searchTerm: string) => {
    setConversationSearchTerm(searchTerm);
  };

  // Após excluir o histórico de uma sessão: atualiza a lista sem recarregar a página
  const handleHistoryDeleted = (sessionId: string) => {
    if (selectedChat === sessionId) {
      setSelectedChat(null);
    }
    fetchConversations();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <PauseDurationDialog
        isOpen={pauseDialogOpen}
        onOpenChange={setPauseDialogOpen}
        onConfirm={pauseBot}
      />

      <div className="flex-1 overflow-hidden">
        <ChatLayout 
          conversations={filteredConversations}
          selectedChat={selectedChat}
          setSelectedChat={setSelectedChat}
          isLoading={isLoading}
          openPauseDialog={openPauseDialog}
          startBot={startBot}
          loading={viewMode === 'groups' ? conversationsLoading || groupsLoading : conversationsLoading}
          loadingMore={viewMode === 'chats' && loadingMore}
          hasMore={viewMode === 'chats' && hasMore}
          onLoadMore={loadMoreConversations}
          messages={filteredMessages}
          handleNewMessage={handleNewMessage}
          selectedConversation={selectedConversation}
          markConversationRead={markConversationRead}
          onSearchMessages={handleSearchMessages}
          onSearchConversations={handleSearchConversations}
          conversationSearchValue={conversationSearchTerm}
          conversationCount={conversationCount}
          searchingConversations={viewMode === 'chats' && conversationsSearching}
          pauseStatus={pauseStatus}
          onRefresh={handleRefresh}
          onConversationUpdate={handleRefresh}
          updateConversationLocal={updateConversationLocal}
          isRefreshing={isRefreshing}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={handleToggleAutoRefresh}
          showOnlyPaused={showOnlyPaused}
          onTogglePausedFilter={() => setShowOnlyPaused(prev => !prev)}
          showOnlyUnanswered={showOnlyUnanswered}
          onToggleUnansweredFilter={() => setShowOnlyUnanswered(prev => !prev)}
          showOnlyPendencias={showOnlyPendencias}
          onTogglePendenciasFilter={() => setShowOnlyPendencias(prev => !prev)}
          viewMode={viewMode}
          tagFilterId={tagFilterId}
          onTagFilterChange={setTagFilterId}
          tags={tags}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          assignmentFilter={assignmentFilter}
          onAssignmentFilterChange={setAssignmentFilter}
          atendenteAtivoNome={atendenteAtivo?.nome ?? null}
          tagsPorCliente={tagsPorCliente}
          abertasPorCliente={abertasPorCliente}
          onHistoryDeleted={handleHistoryDeleted}
        />
      </div>
    </div>
  );
};

export default ChatsDashboard;
