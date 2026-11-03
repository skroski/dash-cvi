import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Conversation, N8nChatHistory } from '@/types/chat';
import { formatMessageTime } from '@/utils/chatUtils';
import { getActiveChat } from '@/lib/activeChat';
import { rotuloPreviaMidia } from '@/lib/media';

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

let painelFunctionDisponivel = true;

type AtendimentoConversationRow = {
  session_id: string;
  nome_contato: string | null;
  ultima_mensagem_em: string | null;
  direcao: string | null;
  conteudo: string | null;
  tipo: string | null;
  ocorrido_em: string | null;
  cliente_id: number | null;
  cliente_nome: string | null;
  cliente_email: string | null;
  cliente_telefone: string | null;
  nome_pet: string | null;
  porte_pet: string | null;
  raca_pet: string | null;
  servico: string | null;
  total_count: number | string;
};

export const CONVERSATIONS_PAGE_SIZE = 200;
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
      // Pelo tipo real (nome do arquivo/URL contam), não só pelo campo `type`:
      // uma foto gravada com type 'human' virava "📄 Documento" na lista.
      lastMessage = rotuloPreviaMidia({
        type: messageType,
        mediaUrl,
        fileName: getStringField(parsedMessage, 'fileName'),
      });
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

function toAtendimentoConversation(row: AtendimentoConversationRow): Conversation {
  const isGroup = row.session_id.includes('@g.us');
  const date = new Date(row.ocorrido_em || row.ultima_mensagem_em || Date.now());
  const lastMessageDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const hasClient = row.cliente_id !== null;
  const lastMessage = row.conteudo?.trim()
    || (row.tipo && row.tipo !== 'texto' ? 'Mídia recebida' : 'Sem mensagem');
  return {
    id: row.session_id,
    name: isGroup
      ? row.nome_contato || `Grupo WhatsApp (${row.session_id.split('@')[0]})`
      : row.cliente_nome || row.nome_contato || `Contato (${row.session_id.split('@')[0]})`,
    lastMessage,
    time: formatMessageTime(lastMessageDate),
    unread: 0,
    avatar: '',
    phone: row.cliente_telefone || row.session_id.split('@')[0],
    email: row.cliente_email || (hasClient ? 'Sem email' : ''),
    petName: row.nome_pet || (hasClient ? 'Não informado' : undefined),
    petType: row.porte_pet || (hasClient ? 'Não informado' : undefined),
    petBreed: row.raca_pet || (hasClient ? 'Não informado' : undefined),
    sessionId: row.session_id,
    lastMessageDate,
    lastMessageSender: row.direcao === 'entrada' ? 'human' : row.direcao ? 'ai' : 'unknown',
    isGroup,
    clientData: hasClient
      ? {
          id: row.cliente_id as number,
          nome: row.cliente_nome || 'Cliente sem nome',
          email: row.cliente_email || 'Sem email',
          telefone: row.cliente_telefone || '',
          cpf_cnpj: '',
          servico: row.servico || '',
          asaas_customer_id: '',
        }
      : undefined,
  };
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
        .select('id, session_id, message, data')
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
    const offset = page * CONVERSATIONS_PAGE_SIZE;

    try {
      if (page === 0 && showLoading) {
        setLoading(true);
      } else if (page > 0) {
        setLoadingMore(true);
      }
      if (page === 0 && debouncedSearchTerm) {
        setSearching(true);
      }

      const migratedPromise = painelFunctionDisponivel
        ? supabase.functions
            .invoke('atendimento-painel', {
              body: {
                action: 'conversas',
                search: debouncedSearchTerm || undefined,
                limit: CONVERSATIONS_PAGE_SIZE,
                offset,
              },
            })
            .then((res) => {
              if (res.error) painelFunctionDisponivel = false;
              return res;
            })
            .catch(() => {
              painelFunctionDisponivel = false;
              return { data: null, error: null };
            })
        : Promise.resolve({ data: null, error: null });

      const [legacy, migrated] = await Promise.all([
        supabase.rpc('search_conversations', {
          p_search: debouncedSearchTerm || null,
          p_limit: CONVERSATIONS_PAGE_SIZE,
          p_offset: offset,
        }),
        migratedPromise,
      ]);

      if (legacy.error) throw legacy.error;
      if (requestId !== requestIdRef.current) return;

      const rows = (legacy.data || []) as SearchConversationRow[];
      const legacyConversations = rows.map(toConversation);
      const migratedRows = !migrated.error && !migrated.data?.error
        ? (migrated.data?.conversations || []) as AtendimentoConversationRow[]
        : [];
      const merged = new Map(legacyConversations.map((conversation) => [conversation.sessionId, conversation]));
      for (const conversation of migratedRows.map(toAtendimentoConversation)) {
        const current = merged.get(conversation.sessionId);
        if (!current || (conversation.lastMessageDate?.getTime() || 0) >= (current.lastMessageDate?.getTime() || 0)) {
          merged.set(conversation.sessionId, conversation);
        }
      }
      const pageConversations = Array.from(merged.values()).sort((a, b) =>
        (b.lastMessageDate?.getTime() || 0) - (a.lastMessageDate?.getTime() || 0)
      );
      const legacyTotal = rows.length > 0 ? Number(rows[0].total_count) : 0;
      const migratedTotal = migratedRows.length > 0 ? Number(migratedRows[0].total_count) : 0;
      const resultTotal = legacyTotal || migratedTotal
        ? Math.max(legacyTotal, migratedTotal, pageConversations.length)
        : page === 0
          ? 0
          : null;

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
