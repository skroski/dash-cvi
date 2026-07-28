
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage, N8nChatHistory } from '@/types/chat';
import { parseMessage } from '@/utils/chatUtils';
import { findChatMessages, isUazapiConfigured, UazapiChatMessage } from '@/services/uazapi';

const isGroupChat = (id: string | null): id is string => !!id && id.includes('@g.us');

// Intervalo do polling de novas mensagens via Uazapi (a Uazapi não tem realtime)
const POLL_INTERVAL_MS = 15_000;

// Quantas mensagens buscar por vez no banco da Uazapi
const UAZAPI_MESSAGE_LIMIT = 200;

/**
 * Monta o chatid (JID) que a Uazapi usa para uma conversa individual a partir
 * do telefone ou do session_id (que costuma ser o próprio número).
 */
const buildIndividualChatId = (idOrPhone: string): string => {
  if (idOrPhone.includes('@')) return idOrPhone;
  const digits = idOrPhone.replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
};

const uazapiToChatMessage = (msg: UazapiChatMessage, includeSender: boolean): ChatMessage => ({
  // 'human' põe a mensagem à esquerda; 'assistant', à direita (enviada por nós)
  role: msg.fromMe ? 'assistant' : 'human',
  content: msg.text,
  timestamp: new Date(msg.timestamp).toISOString(),
  type: msg.mediaType,
  mediaUrl: msg.mediaUrl,
  fileName: msg.fileName,
  senderName: includeSender && !msg.fromMe ? msg.senderName : undefined,
});

const sortByTimestampDesc = (a: ChatMessage, b: ChatMessage) =>
  new Date(b.timestamp || '').getTime() - new Date(a.timestamp || '').getTime();

/**
 * Considera a mesma mídia quando o tipo bate e os horários estão próximos.
 * Serve para reconciliar o echo otimista (URL local) ou uma eventual cópia no
 * Supabase com a versão canônica hospedada pela Uazapi.
 */
const isSameMedia = (a: ChatMessage, b: ChatMessage): boolean => {
  const dt = Math.abs(
    new Date(a.timestamp || '').getTime() - new Date(b.timestamp || '').getTime(),
  );
  return dt < 90_000 && (a.type || '') === (b.type || '');
};

/**
 * Conversa individual: o texto (com atendente/bot) vem do Supabase e a mídia,
 * do banco da Uazapi. Descarta a mídia do Supabase que já veio da Uazapi para
 * não duplicar, mantendo a versão hospedada como canônica.
 */
const mergeIndividual = (supabaseMessages: ChatMessage[], uazapiMedia: ChatMessage[]): ChatMessage[] => {
  const kept = supabaseMessages.filter(
    (sm) => !sm.mediaUrl || !uazapiMedia.some((um) => isSameMedia(sm, um)),
  );
  return [...kept, ...uazapiMedia].sort(sortByTimestampDesc);
};

export function useChatMessages(selectedChat: string | null, selectedPhone?: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Telefone atual num ref para o polling/reconciliação sem recriar callbacks
  const phoneRef = useRef<string | null | undefined>(selectedPhone);
  phoneRef.current = selectedPhone;

  // Lê e converte o histórico de texto gravado pelo n8n no Supabase.
  const loadSupabaseMessages = useCallback(async (conversationId: string): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
      .from('n8n_chat_histories')
      .select('*')
      .eq('session_id', conversationId)
      .order('id', { ascending: false });

    if (error) throw error;

    let all: ChatMessage[] = [];
    (data || []).forEach((row: N8nChatHistory) => {
      const parsed = parseMessage(row);
      if (parsed.length > 0) all = [...all, ...parsed];
    });
    return all;
  }, []);

  // Busca a mídia da conversa direto no banco da Uazapi (persistente entre
  // recarregamentos e dispositivos). Degrada para lista vazia em caso de falha.
  const loadUazapiMedia = useCallback(async (idOrPhone: string): Promise<ChatMessage[]> => {
    if (!isUazapiConfigured()) return [];
    try {
      const raw = await findChatMessages(buildIndividualChatId(idOrPhone), UAZAPI_MESSAGE_LIMIT);
      return raw
        .filter((m) => !!m.mediaUrl)
        .map((m) => uazapiToChatMessage(m, false));
    } catch (err) {
      console.warn('Falha ao buscar mídia da conversa na Uazapi:', err);
      return [];
    }
  }, []);

  // Carga da conversa individual: Supabase (texto) + Uazapi (mídia).
  const fetchIndividualMessages = useCallback(async (sessionId: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [supabaseMessages, uazapiMedia] = await Promise.all([
        loadSupabaseMessages(sessionId),
        loadUazapiMedia(phoneRef.current || sessionId),
      ]);
      setMessages(mergeIndividual(supabaseMessages, uazapiMedia));
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      if (!silent) {
        toast.error('Erro ao carregar mensagens', { description: 'Ocorreu um erro ao carregar as mensagens.' });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [loadSupabaseMessages, loadUazapiMedia]);

  // Poll só da mídia: preserva o texto (realtime/echo) e reconcilia a mídia com
  // a versão hospedada pela Uazapi — inclusive substituindo o echo local (blob)
  // do que acabou de ser enviado pela URL definitiva.
  const pollIndividualMedia = useCallback(async (sessionId: string) => {
    const uazapiMedia = await loadUazapiMedia(phoneRef.current || sessionId);
    // Sem retorno (nada ainda ou falha): mantém o estado atual e não apaga o echo
    if (uazapiMedia.length === 0) return;

    setMessages((prev) => {
      const nonMedia = prev.filter((m) => !m.mediaUrl);
      // Mídia local ainda sem correspondente hospedado (ex.: envio recém-feito)
      const pendingMedia = prev.filter(
        (m) => m.mediaUrl && !uazapiMedia.some((um) => isSameMedia(m, um)),
      );
      return [...nonMedia, ...pendingMedia, ...uazapiMedia].sort(sortByTimestampDesc);
    });
  }, [loadUazapiMedia]);

  // Grupos: o Supabase só tem o que o n8n gravou; a Uazapi guarda TODO o
  // histórico que passou pela instância — usa ela como fonte para grupos.
  const fetchGroupMessages = useCallback(async (chatId: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const raw = await findChatMessages(chatId, UAZAPI_MESSAGE_LIMIT);
      const chatMessages = raw.map((m) => uazapiToChatMessage(m, true)).sort(sortByTimestampDesc);
      setMessages(chatMessages);
    } catch (error) {
      console.error('Erro ao buscar mensagens do grupo via Uazapi:', error);
      if (!silent) {
        // Fallback: mostra ao menos o histórico gravado no Supabase
        try {
          setMessages((await loadSupabaseMessages(chatId)).sort(sortByTimestampDesc));
        } catch {
          /* ignora: já logamos o erro da Uazapi acima */
        }
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [loadSupabaseMessages]);

  // Polling da Uazapi enquanto um chat está aberto.
  // Grupos: recarrega todo o histórico. Individuais: atualiza só a mídia.
  useEffect(() => {
    if (!selectedChat || !isUazapiConfigured()) return;
    const group = isGroupChat(selectedChat);
    const interval = setInterval(() => {
      if (group) {
        fetchGroupMessages(selectedChat, true);
      } else {
        pollIndividualMedia(selectedChat);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [selectedChat, fetchGroupMessages, pollIndividualMedia]);

  // Realtime do Supabase para o texto do chat individual atual.
  useEffect(() => {
    if (!selectedChat) return;
    // Grupos são atualizados pelo polling da Uazapi acima
    if (isGroupChat(selectedChat) && isUazapiConfigured()) return;

    const subscription = supabase
      .channel(`chat_messages_${selectedChat}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'n8n_chat_histories',
          filter: `session_id=eq.${selectedChat}`,
        },
        (payload) => {
          const chatHistory = payload.new as N8nChatHistory;
          const newMessages = parseMessage(chatHistory);
          if (newMessages.length === 0) return;

          const incoming = newMessages[0];
          // Mídia é servida pela Uazapi (polling); ignora eventual cópia no
          // Supabase para não duplicar com a versão hospedada.
          if (incoming.mediaUrl && isUazapiConfigured()) return;

          setMessages((prevMessages) => {
            // Dedupe contra o echo otimista: mesma origem + mesmo conteúdo em até 60s
            const incomingTime = new Date(incoming.timestamp || '').getTime();
            const isDuplicate = prevMessages.some((msg) => {
              if (msg.role !== 'assistant' && msg.type !== 'ai') return false;
              if ((msg.content || '') !== (incoming.content || '')) return false;
              const msgTime = new Date(msg.timestamp || '').getTime();
              return Math.abs(incomingTime - msgTime) < 60_000;
            });
            if (isDuplicate && (incoming.role === 'assistant' || incoming.type === 'ai')) {
              return prevMessages;
            }

            return [incoming, ...prevMessages].sort(sortByTimestampDesc);
          });
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedChat]);

  // Recarrega ao trocar de conversa.
  useEffect(() => {
    if (selectedChat) {
      if (isGroupChat(selectedChat) && isUazapiConfigured()) {
        fetchGroupMessages(selectedChat);
      } else {
        fetchIndividualMessages(selectedChat);
      }
    } else {
      setMessages([]);
      setLoading(false);
    }
  }, [selectedChat, fetchIndividualMessages, fetchGroupMessages]);

  // Echo otimista: mostra a mensagem enviada na hora, sem esperar o realtime.
  const handleNewMessage = (message: ChatMessage) => {
    setMessages((currentMessages) =>
      [message, ...currentMessages].sort(sortByTimestampDesc),
    );
  };

  return { messages, loading, handleNewMessage, fetchMessages: fetchIndividualMessages };
}
