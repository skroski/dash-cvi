import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Conversation, N8nChatHistory } from '@/types/chat';
import { formatMessageTime } from '@/utils/chatUtils';
import { getActiveChat } from '@/lib/activeChat';

type MessageRecord = Record<string, unknown>;

function parseMessageRecord(message: unknown): MessageRecord | null {
  if (typeof message === 'string') {
    try {
      const parsed = JSON.parse(message);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as MessageRecord
        : null;
    } catch {
      return null;
    }
  }
  return message && typeof message === 'object' && !Array.isArray(message)
    ? message as MessageRecord
    : null;
}

function getStringField(record: MessageRecord, field: string): string {
  const value = record[field];
  return typeof value === 'string' ? value : '';
}

function getMessageType(message: unknown): 'human' | 'ai' | 'unknown' {
  const parsedMessage = parseMessageRecord(message);
  const type = parsedMessage?.type;
  if (type === 'human' || type === 'ai') return type;

  const messages = parsedMessage?.messages;
  if (Array.isArray(messages) && messages.length > 0) {
    const lastMessage = parseMessageRecord(messages[messages.length - 1]);
    const lastType = lastMessage?.type;
    if (lastType === 'human' || lastType === 'ai') return lastType;
  }

  return 'unknown';
}

type SearchConversationRow =
  Database['public']['Functions']['search_conversations']['Returns'][number];

const ITEMS_PER_PAGE = 100;
const SEARCH_DEBOUNCE_MS = 300;

function getMessageDetails(message: unknown) {
  let lastMessage = 'Sem mensagem';
  const parsedMessage = parseMessageRecord(message);

  if (!parsedMessage && typeof message === 'string') {
    lastMessage = message;
  }

  if (parsedMessage) {
    const content = getStringField(parsedMessage, 'content');
    const mediaUrl = getStringField(parsedMessage, 'mediaUrl');
    const messageType = getStringField(parsedMessage, 'type');
    const messages = parsedMessage.messages;

    if (content) {
      lastMessage = content;
    } else if (mediaUrl) {
      lastMessage = messageType === 'image'
        ? '📷 Imagem'
        : messageType === 'audio'
          ? '🎵 Áudio'
          : '📄 Documento';
    } else if (Array.isArray(messages)) {
      const lastRecord = parseMessageRecord(messages.at(-1));
      lastMessage = lastRecord ? getStringField(lastRecord, 'content') || 'Sem mensagem' : 'Sem mensagem';
    }
  }

  return {
    lastMessage,
    name: parsedMessage
      ? getStringField(parsedMessage, 'groupName')
        || getStringField(parsedMessage, 'chatName')
        || getStringField(parsedMessage, 'pushName')
        || getStringField(parsedMessage, 'senderName')
      : '',
    avatar: parsedMessage
      ? getStringField(parsedMessage, 'avatarUrl') || getStringField(parsedMessage, 'avatar')
      : '',
  };
}

function toConversation(row: SearchConversationRow): Conversation {
  const isGroup = row.session_id.includes('@g.us');
  const groupNumber = row.session_id.split('@')[0];
  const messageDetails = getMessageDetails(row.message);
  const parsedDate = row.message_date ? new Date(row.message_date) : new Date();
  const rawDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const lastMessageDate = new Date(
    rawDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  );
  const hasClient = row.client_id !== null;

  return {
    id: row.session_id,
    name: isGroup
      ? messageDetails.name || `Grupo WhatsApp (${groupNumber})`
      : row.client_name || messageDetails.name || `Contato (${row.session_id})`,
    lastMessage: messageDetails.lastMessage,
    time: formatMessageTime(lastMessageDate),
    unread: 0,
    avatar: messageDetails.avatar,
    phone: row.client_phone || row.session_id,
    email: row.client_email || (hasClient ? 'Sem email' : ''),
    petName: row.pet_name || (hasClient ? 'Não informado' : undefined),
    petType: row.pet_size || (hasClient ? 'Não informado' : undefined),
    petBreed: row.pet_breed || (hasClient ? 'Não informado' : undefined),
    sessionId: row.session_id,
    lastMessageDate,
    lastMessageSender: getMessageType(row.message),
    isGroup,
    clientData: hasClient
      ? {
          id: row.client_id,
          nome: row.client_name || 'Cliente sem nome',
          email: row.client_email || 'Sem email',
          telefone: row.client_phone || '',
          cpf_cnpj: row.cpf_cnpj || '',
          servico: row.service || '',
          asaas_customer_id: row.asaas_customer_id || '',
        }
      : undefined,
  };
}

async function fetchConversationsFallback(
  searchTerm: string,
  page: number,
  limit: number
): Promise<{ rows: SearchConversationRow[]; total: number }> {
  let matchedSessionIdsFromClients: string[] = [];

  if (searchTerm) {
    const { data: matchedClients } = await supabase
      .from('dados_cliente')
      .select('sessionid')
      .or(`nome.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%,nome_pet.ilike.%${searchTerm}%`)
      .limit(100);

    if (matchedClients) {
      matchedSessionIdsFromClients = matchedClients
        .map(c => c.sessionid)
        .filter((id): id is string => Boolean(id));
    }
  }

  let query = supabase
    .from('n8n_chat_histories')
    .select('session_id, id, message, data')
    .order('id', { ascending: false });

  if (searchTerm) {
    if (matchedSessionIdsFromClients.length > 0) {
      query = query.or(
        `session_id.ilike.%${searchTerm}%,session_id.in.(${matchedSessionIdsFromClients.join(',')})`
      );
    } else {
      query = query.ilike('session_id', `%${searchTerm}%`);
    }
  }

  const { data: historyData, error: historyError } = await query.limit(500);
  if (historyError) throw historyError;

  const latestBySession = new Map<string, (typeof historyData)[number]>();
  for (const item of historyData || []) {
    if (item.session_id && !latestBySession.has(item.session_id)) {
      latestBySession.set(item.session_id, item);
    }
  }

  const sessions = Array.from(latestBySession.values());
  const sessionIds = sessions.map(s => s.session_id);

  const clientsMap = new Map<string, Record<string, unknown>>();
  if (sessionIds.length > 0) {
    const { data: clientsData } = await supabase
      .from('dados_cliente')
      .select('*')
      .in('sessionid', sessionIds);

    if (clientsData) {
      for (const client of clientsData) {
        if (client.sessionid && !clientsMap.has(client.sessionid)) {
          clientsMap.set(client.sessionid, client as Record<string, unknown>);
        }
      }
    }
  }

  const offset = page * limit;
  const pagedSessions = sessions.slice(offset, offset + limit);

  const rows: SearchConversationRow[] = pagedSessions.map(s => {
    const client = clientsMap.get(s.session_id);
    return {
      session_id: s.session_id,
      latest_id: Number(s.id),
      message: s.message as SearchConversationRow['message'],
      message_date: s.data,
      client_id: client?.id ? Number(client.id) : null,
      client_name: (client?.nome as string) ?? null,
      client_phone: (client?.telefone as string) ?? null,
      client_email: (client?.email as string) ?? null,
      pet_name: (client?.nome_pet as string) ?? null,
      pet_size: (client?.porte_pet as string) ?? null,
      pet_breed: (client?.raca_pet as string) ?? null,
      cpf_cnpj: (client?.cpf_cnpj as string) ?? null,
      service: (client?.servico as string) ?? null,
      asaas_customer_id: (client?.asaas_customer_id as string) ?? null,
      total_count: sessions.length,
    };
  });

  return { rows, total: sessions.length };
}

export function useConversations(searchTerm = '') {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const normalizedSearchTerm = searchTerm.trim();
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(normalizedSearchTerm);
  const [searching, setSearching] = useState(false);
  const requestIdRef = useRef(0);

  const updateConversationLastMessage = useCallback(async (sessionId: string) => {
    try {
      const { data: historyData, error: historyError } = await supabase
        .from('n8n_chat_histories')
        .select('*')
        .eq('session_id', sessionId)
        .order('id', { ascending: false })
        .limit(1);

      if (historyError) throw historyError;

      if (historyData && historyData.length > 0) {
        const chatHistory = historyData[0] as N8nChatHistory;

        setConversations(currentConversations => {
          const updatedConversations = currentConversations.map(conv => {
            if (conv.id === sessionId) {
              const messageDetails = getMessageDetails(chatHistory.message);

              // Use hora field if available, otherwise fall back to data field
              const messageDate = chatHistory.hora
                ? new Date(chatHistory.hora)
                : chatHistory.data
                  ? new Date(chatHistory.data)
                  : new Date();

              const messageSender = getMessageType(chatHistory.message);
              // Só conta como não lida mensagem de cliente em conversa que
              // não está aberta na tela (respostas do bot não são "não lidas")
              const shouldIncrementUnread =
                messageSender === 'human' && getActiveChat() !== sessionId;

              return {
                ...conv,
                name: conv.clientData && !conv.isGroup
                  ? conv.name
                  : messageDetails.name || conv.name,
                avatar: messageDetails.avatar || conv.avatar,
                lastMessage: messageDetails.lastMessage,
                time: formatMessageTime(messageDate),
                unread: shouldIncrementUnread ? conv.unread + 1 : conv.unread,
                lastMessageDate: messageDate,
                lastMessageSender: messageSender
              };
            }
            return conv;
          });

          // Sort conversations by last message date, most recent first
          return updatedConversations.sort((a, b) => {
            const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
            const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
            return dateB - dateA;
          });
        });
      }
    } catch (error) {
      console.error('Error updating conversation last message:', error);
    }
  }, []);

  useEffect(() => {
    if (normalizedSearchTerm === debouncedSearchTerm) return;

    setSearching(true);
    const timeout = window.setTimeout(
      () => setDebouncedSearchTerm(normalizedSearchTerm),
      normalizedSearchTerm ? SEARCH_DEBOUNCE_MS : 0
    );

    return () => window.clearTimeout(timeout);
  }, [normalizedSearchTerm, debouncedSearchTerm]);

  const fetchConversations = useCallback(async (page = 0, append = false, showLoading = false) => {
    const requestId = ++requestIdRef.current;
    const offset = page * ITEMS_PER_PAGE;

    try {
      if (page === 0 && showLoading) {
        setLoading(true);
      } else if (page > 0) {
        setLoadingMore(true);
      }
      if (page === 0 && debouncedSearchTerm) {
        setSearching(true);
      }

      let rows: SearchConversationRow[] = [];
      let resultTotal: number | null = null;

      const { data, error } = await supabase.rpc('search_conversations', {
        p_search: debouncedSearchTerm || null,
        p_limit: ITEMS_PER_PAGE,
        p_offset: offset,
      });

      if (error) {
        // Fall back to client query if RPC function does not exist in Supabase DB (PGRST202 / 404)
        const isMissingFunction =
          error.code === 'PGRST202' ||
          error.code === '42883' ||
          error.message?.includes('search_conversations');

        if (isMissingFunction) {
          console.warn('RPC search_conversations não encontrada no Supabase. Utilizando fallback direto...');
          const fallbackResult = await fetchConversationsFallback(
            debouncedSearchTerm,
            page,
            ITEMS_PER_PAGE
          );
          rows = fallbackResult.rows;
          resultTotal = fallbackResult.total;
        } else {
          throw error;
        }
      } else {
        rows = (data || []) as SearchConversationRow[];
        resultTotal = rows.length > 0
          ? Number(rows[0].total_count)
          : page === 0
            ? 0
            : null;
      }

      if (requestId !== requestIdRef.current) return;

      const pageConversations = rows.map(toConversation);

      if (resultTotal !== null) {
        setTotalCount(resultTotal);
        setHasMore(offset + rows.length < resultTotal);
      } else {
        setHasMore(false);
      }

      if (append) {
        setConversations(previous => {
          const merged = new Map(previous.map(conversation => [conversation.id, conversation]));
          pageConversations.forEach(conversation => merged.set(conversation.id, conversation));
          return Array.from(merged.values()).sort((a, b) => {
            const dateA = a.lastMessageDate?.getTime() ?? 0;
            const dateB = b.lastMessageDate?.getTime() ?? 0;
            return dateB - dateA;
          });
        });
      } else {
        setConversations(pageConversations);
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error('Error fetching conversations:', error);
      toast.error('Erro ao carregar conversas', {
        description: 'Ocorreu um erro ao carregar as conversas.',
      });
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setSearching(false);
      }
    }
  }, [debouncedSearchTerm]);

  const loadMoreConversations = useCallback(() => {
    if (!loadingMore && hasMore) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchConversations(nextPage, true);
    }
  }, [currentPage, loadingMore, hasMore, fetchConversations]);

  const refreshConversations = useCallback(() => {
    setCurrentPage(0);
    setHasMore(true);
    fetchConversations(0, false);
  }, [fetchConversations]);

  // Carga inicial e nova busca global após o debounce.
  useEffect(() => {
    setCurrentPage(0);
    setHasMore(true);
    fetchConversations(0, false, true);
  }, [fetchConversations]);

  const updateConversationLocal = useCallback((sessionId: string, data: Partial<Conversation>) => {
    setConversations(currentConversations =>
      currentConversations.map(conv => {
        if (conv.id === sessionId) {
          return { ...conv, ...data };
        }
        return conv;
      })
    );
  }, []);

  return {
    conversations,
    setConversations,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    searching: searching || normalizedSearchTerm !== debouncedSearchTerm,
    updateConversationLastMessage,
    fetchConversations: refreshConversations,
    loadMoreConversations,
    updateConversationLocal
  };
}
