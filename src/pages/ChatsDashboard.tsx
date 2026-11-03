
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import ChatLayout from '@/components/chat/ChatLayout';
import { CONVERSATIONS_PAGE_SIZE, useConversations } from '@/hooks/useConversations';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useUazapiGroups } from '@/hooks/useUazapiGroups';
import PauseDurationDialog from '@/components/PauseDurationDialog';
import { useRedisPauseStatus } from '@/hooks/useRedisPauseStatus';
import { usePendencias } from '@/hooks/usePendencias';
import { useTags } from '@/hooks/useTags';
import {
  useConversationStatus,
  useConversationStatusRealtime,
} from '@/hooks/useConversationStatus';
import { useAtendimentos } from '@/hooks/useAtendimentos';
import { useAtendenteAtivo } from '@/context/AtendenteAtivoContext';
import { supabase } from '@/integrations/supabase/client';
import { getChatDetails } from '@/services/uazapi';
import { setActiveChat } from '@/lib/activeChat';
import {
  categoriaDoGrupo,
  grupoSomenteLeitura,
  timerMensagensTemporarias,
} from '@/lib/grupos';
import {
  ChatViewMode,
  Conversation,
  ConversationAssignmentFilter,
  ConversationStatusFilter,
} from '@/types/chat';
import { formatMessageTime } from '@/utils/chatUtils';
import { rotuloPreviaMidia } from '@/lib/media';

const ChatsDashboard = () => {
  const queryClient = useQueryClient();
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  const [conversationSearchTerm, setConversationSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOnlyPaused, setShowOnlyPaused] = useState(false);
  const [showOnlyUnanswered, setShowOnlyUnanswered] = useState(false);
  const [showOnlyPendencias, setShowOnlyPendencias] = useState(false);
  const [tagFilterId, setTagFilterId] = useState<number | null>(null);

  const [statusFilter, setStatusFilter] = useState<ConversationStatusFilter>('todas');
  const [assignmentFilter, setAssignmentFilter] =
    useState<ConversationAssignmentFilter>('todas');
  // Avatares de grupos sem histórico (não existem no estado de conversas)
  const [groupAvatars, setGroupAvatars] = useState<Map<string, string>>(new Map());
  // Guarda as últimas mensagens de grupos conhecidas localmente
  const [groupLastMessages, setGroupLastMessages] = useState<
    Map<string, { lastMessage: string; time: string; lastMessageDate: string }>
  >(() => {
    try {
      const stored = localStorage.getItem('cvi-group-last-messages');
      if (stored) {
        return new Map(JSON.parse(stored));
      }
    } catch {}
    return new Map();
  });
  // Oculta por padrão os grupos que a instância não faz mais parte (só
  // aparecem pelo histórico salvo, sem mensagens novas possíveis)
  const [showInactiveGroups, setShowInactiveGroups] = useState(false);

  // Uma única assinatura mantém todos os consumidores do cache sincronizados.
  useConversationStatusRealtime();

  // Pendências e tags dos clientes (para filtros e badges nas conversas)
  const { abertasPorCliente } = usePendencias();
  const { tags, tagsPorCliente } = useTags();

  // Status de ciclo de vida (aberta/fechada/arquivada) para o filtro por status
  const { statusPorSession } = useConversationStatus();

  // Atendente ativo no painel + atendimentos abertos (filtro "Atribuídas")
  const { atendenteAtivoId, atendenteAtivo } = useAtendenteAtivo();
  const { atendimentoPorSession } = useAtendimentos();

  // Grupos do WhatsApp via Uazapi (aba Grupos, nome real e participantes)
  const { groups, groupsByJid, loading: groupsLoading, refreshGroups } = useUazapiGroups();

  const location = useLocation();

  // A rota define a visão: /groups mostra todos os grupos, /chats as conversas
  const viewMode: ChatViewMode = location.pathname === '/groups' ? 'groups' : 'chats';

  // Reage aos query params da URL e mantém filtros limpos no início da tela
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const selectParam = params.get('select');
    const filterParam = params.get('filter');
    const searchParam = params.get('search');

    if (selectParam) {
      setSelectedChat(selectParam);
    }
    setShowOnlyPaused(filterParam === 'paused');
    setShowOnlyUnanswered(filterParam === 'unanswered');
    setShowOnlyPendencias(filterParam === 'pendencias');
    setConversationSearchTerm(searchParam || '');
    if (!filterParam) {
      setTagFilterId(null);
      setStatusFilter('todas');
      setAssignmentFilter('todas');
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
  
  // Sincroniza a última mensagem do grupo com o estado e cache local
  useEffect(() => {
    if (!selectedChat || !selectedChat.includes('@g.us') || messages.length === 0) return;
    const latest = messages[0];
    if (!latest) return;
    const lastMessage = latest.mediaUrl
      ? rotuloPreviaMidia({ type: latest.type, mediaUrl: latest.mediaUrl, fileName: latest.fileName })
      : latest.content || 'Sem mensagens recentes';
    const timestamp = latest.timestamp ? new Date(latest.timestamp) : new Date();
    const time = formatMessageTime(timestamp);

    setGroupLastMessages(prev => {
      const current = prev.get(selectedChat);
      if (current?.lastMessage === lastMessage && current?.time === time) return prev;
      const next = new Map(prev);
      next.set(selectedChat, { lastMessage, time, lastMessageDate: timestamp.toISOString() });
      try {
        localStorage.setItem('cvi-group-last-messages', JSON.stringify(Array.from(next.entries())));
      } catch {}
      return next;
    });
  }, [selectedChat, messages]);
  
  // Set up real-time listeners for new chat messages
  useRealtimeUpdates({ 
    updateConversationLastMessage, 
    fetchConversations: async () => {
      return await fetchConversations();
    }
  });

  // Atualização manual simples e direta: limpa caches e busca do servidor
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      // Invalida todos os caches do React Query (status, atendimentos, pendências)
      queryClient.invalidateQueries();

      if (viewMode === 'groups') {
        await Promise.all([
          fetchConversations(),
          refreshGroups().catch((err) => {
            console.error('Erro ao atualizar grupos via Uazapi:', err);
          }),
        ]);
      } else {
        await fetchConversations();
      }
      toast.success('Conversas e dados atualizados!');
    } catch (error) {
      console.error('Erro ao atualizar conversas:', error);
      toast.error('Erro ao atualizar conversas');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Enriquece as conversas de grupo com os dados reais da Uazapi
  // (nome atual do grupo e total de participantes)
  const enrichedConversations = React.useMemo(() => {
    if (groupsByJid.size === 0) return conversations;
    return conversations.map(conv => {
      if (!conv.isGroup) return conv;
      const group = groupsByJid.get(conv.sessionId);
      if (!group) return conv;
      const name = group.name || conv.name;
      return {
        ...conv,
        name,
        groupParticipants: group.participantsCount,
        groupCategoria: categoriaDoGrupo(name),
        groupSomenteLeitura: grupoSomenteLeitura(group),
        groupTimerTemporario: timerMensagensTemporarias(group),
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
      const cached = groupLastMessages.get(group.jid);
      if (existing) {
        withHistory.delete(group.jid);
        const hasExistingMsg =
          existing.lastMessage &&
          existing.lastMessage !== 'Sem mensagem' &&
          existing.lastMessage !== 'Sem mensagens recentes';
        return {
          ...existing,
          isGroupActive: true,
          lastMessage: hasExistingMsg ? existing.lastMessage : (cached?.lastMessage || existing.lastMessage),
          time: existing.time || cached?.time || '',
          lastMessageDate: existing.lastMessageDate || (cached?.lastMessageDate ? new Date(cached.lastMessageDate) : undefined),
        };
      }
      const name = group.name || `Grupo WhatsApp (${group.jid.split('@')[0]})`;
      return {
        id: group.jid,
        name,
        lastMessage: cached?.lastMessage || 'Sem mensagens recentes',
        time: cached?.time || '',
        unread: 0,
        avatar: groupAvatars.get(group.jid) || '',
        phone: group.jid,
        email: '',
        sessionId: group.jid,
        isGroup: true,
        groupParticipants: group.participantsCount,
        isGroupActive: true,
        lastMessageDate: cached?.lastMessageDate ? new Date(cached.lastMessageDate) : undefined,
        groupCategoria: categoriaDoGrupo(group.name),
        groupSomenteLeitura: grupoSomenteLeitura(group),
        groupTimerTemporario: timerMensagensTemporarias(group),
      };
    });

    // Grupos com histórico que a Uazapi não listou (ex.: instância saiu do
    // grupo) — sem valor para o atendimento, não recebem mensagem nova.
    merged.push(
      ...Array.from(withHistory.values()).map(conv => {
        const cached = groupLastMessages.get(conv.sessionId);
        const hasExistingMsg =
          conv.lastMessage &&
          conv.lastMessage !== 'Sem mensagem' &&
          conv.lastMessage !== 'Sem mensagens recentes';
        return {
          ...conv,
          isGroupActive: false,
          lastMessage: hasExistingMsg ? conv.lastMessage : (cached?.lastMessage || conv.lastMessage),
          time: conv.time || cached?.time || '',
          lastMessageDate: conv.lastMessageDate || (cached?.lastMessageDate ? new Date(cached.lastMessageDate) : undefined),
          groupCategoria: conv.groupCategoria ?? categoriaDoGrupo(conv.name),
        };
      })
    );

    // Com mensagens recentes primeiro; sem histórico, ordem alfabética
    return merged.sort((a, b) => {
      const dateA = a.lastMessageDate?.getTime() ?? 0;
      const dateB = b.lastMessageDate?.getTime() ?? 0;
      if (dateA !== dateB) return dateB - dateA;
      return a.name.localeCompare(b.name);
    });
  }, [enrichedConversations, groups, groupAvatars, groupLastMessages]);

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

    avatarFetchAttempted.current.add(selectedChat);
    void getChatDetails(selectedConversation.phone)
      .then(data => {
        const avatarUrl = data?.image || data?.imagePreview;
        if (avatarUrl) {
          updateConversationLocal(selectedChat, { avatar: avatarUrl });
          // Grupos sem histórico não estão no estado de conversas: guarda à parte
          setGroupAvatars(prev => new Map(prev).set(selectedChat, avatarUrl));
        }
      })
      .catch(err => console.error("Error fetching avatar from UAZAPI:", err));
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

  // Grupos que a instância não faz mais parte, dentro dos grupos com histórico
  const inactiveGroupsCount = React.useMemo(
    () => groupConversations.filter(conv => conv.isGroupActive === false).length,
    [groupConversations]
  );

  // Filter conversations based on search term, paused filter and unanswered filter
  const filteredConversations = React.useMemo(() => {
    // Aba Grupos usa a lista completa da Uazapi; os demais filtros são da aba Conversas
    let result = viewMode === 'groups' ? groupConversations : enrichedConversations;
    if (viewMode === 'groups' && !showInactiveGroups) {
      result = result.filter(conversation => conversation.isGroupActive !== false);
    }
  
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
  }, [viewMode, groupConversations, enrichedConversations, showInactiveGroups, conversationSearchTerm, showOnlyPaused, showOnlyUnanswered, showOnlyPendencias, tagFilterId,  statusFilter, statusPorSession, abertasPorCliente, tagsPorCliente, isConversationPaused, atendenteAtivoId, assignmentFilter, atendimentoPorSession]);

  const filterCounts = React.useMemo(() => {
    let unanswered = 0;
    let paused = 0;
    let pendencias = 0;
        const byTag = new Map<number, number>();

    // Contadores da visão de conversas (exclui grupos do WhatsApp)
    const chatConversations = enrichedConversations.filter(conv => !conv.isGroup);

    const byStatus: Record<ConversationStatusFilter, number> = {
      todas: chatConversations.length,
      aberta: 0,
      fechada: 0,
      arquivada: 0,
    };

    for (const conv of chatConversations) {
      if (conv.lastMessageSender === 'human') unanswered++;
      if (isConversationPaused(conv.phone)) paused++;

      const clientId = conv.clientData?.id;
      if (clientId && (abertasPorCliente.get(clientId)?.length || 0) > 0) {
        pendencias++;
      }

      const clientTags = clientId ? tagsPorCliente.get(clientId) || [] : [];
            for (const t of clientTags) {
        byTag.set(t.id, (byTag.get(t.id) || 0) + 1);
      }

      const st = statusPorSession.get(conv.id)?.status ?? 'aberta';
      if (st in byStatus) {
        byStatus[st as keyof typeof byStatus]++;
      }
    }

    return { unanswered, paused, pendencias, byTag, byStatus };
  }, [enrichedConversations, isConversationPaused, abertasPorCliente, tagsPorCliente, statusPorSession]);

  const hasLocalConversationFilters =
    showOnlyPaused || showOnlyUnanswered || showOnlyPendencias || tagFilterId !== null ||
    statusFilter !== 'todas' ||
    (atendenteAtivoId !== null && assignmentFilter === 'atribuidas');
  const conversationCount =
    viewMode === 'groups'
      ? (conversationSearchTerm.trim() ? filteredConversations.length : Math.max(filteredConversations.length))
      : hasLocalConversationFilters
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
      
      const { data, error } = await supabase.functions.invoke('atendimento-controle', {
        body: {
          action: 'pausar',
          sessionId: selectedPhoneNumber,
          durationSeconds: duration ? duration * 60 * 60 : null,
        },
      });
      if (error || data?.error) {
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

  const blockNumber = async (phoneNumber: string) => {
    try {
      setIsLoading(prev => ({ ...prev, [`pause-${phoneNumber}`]: true }));
      const { error } = await supabase.rpc('bloquear_telefone_atendimento', {
        p_telefone: phoneNumber,
        p_motivo: 'operadora_ou_spam',
        p_observacao: 'Bloqueado manualmente no painel de conversas',
      });
      if (error) {
        // Fallback via edge function
        await supabase.functions.invoke('atendimento-controle', {
          body: { action: 'bloquear', sessionId: phoneNumber },
        });
      }
      toast.success("Número bloqueado permanentemente", {
        description: `O assistente foi permanentemente desativado para ${phoneNumber}.`,
      });
      fetchConversations();
    } catch (err) {
      console.error('Erro ao bloquear número:', err);
      toast.error("Erro ao bloquear número", { description: "Não foi possível bloquear o contato." });
    } finally {
      setIsLoading(prev => ({ ...prev, [`pause-${phoneNumber}`]: false }));
      closePauseDialog();
    }
  };

  const startBot = async (phoneNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsLoading(prev => ({ ...prev, [`start-${phoneNumber}`]: true }));
      
      const { data, error } = await supabase.functions.invoke('atendimento-controle', {
        body: { action: 'retomar', sessionId: phoneNumber },
      });
      if (error || data?.error) {
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
        onBlock={blockNumber}
        phoneNumber={selectedPhoneNumber}
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
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={loadMoreConversations}
          messages={filteredMessages}
          handleNewMessage={handleNewMessage}
          selectedConversation={selectedConversation}
          markConversationRead={markConversationRead}
          onSearchMessages={handleSearchMessages}
          onSearchConversations={handleSearchConversations}
          conversationSearchValue={conversationSearchTerm}
          conversationCount={conversationCount}
          conversationPageSize={CONVERSATIONS_PAGE_SIZE}
          searchingConversations={viewMode === 'chats' && conversationsSearching}
          pauseStatus={pauseStatus}
          onRefresh={handleRefresh}
          onConversationUpdate={handleRefresh}
          updateConversationLocal={updateConversationLocal}
          isRefreshing={isRefreshing}
          showOnlyPaused={showOnlyPaused}
          onTogglePausedFilter={() => setShowOnlyPaused(prev => !prev)}
          showOnlyUnanswered={showOnlyUnanswered}
          onToggleUnansweredFilter={() => setShowOnlyUnanswered(prev => !prev)}
          showOnlyPendencias={showOnlyPendencias}
          onTogglePendenciasFilter={() => setShowOnlyPendencias(prev => !prev)}
          viewMode={viewMode}
          showInactiveGroups={showInactiveGroups}
          onToggleInactiveGroupsFilter={() => setShowInactiveGroups(prev => !prev)}
          inactiveGroupsCount={inactiveGroupsCount}
          tagFilterId={tagFilterId}
          onTagFilterChange={setTagFilterId}
          filterCounts={filterCounts}
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
