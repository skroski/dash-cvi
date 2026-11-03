
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage, N8nChatHistory } from '@/types/chat';
import { parseMessage } from '@/utils/chatUtils';
import { buildChatId, findChatMessages, isUazapiConfigured, UazapiChatMessage } from '@/services/uazapi';
import { inferMediaKind } from '@/lib/media';
import {
  indexarMidiasDaConversa,
  indexarMidiasDoHistorico,
  listarMidiasArquivadas,
  solicitarArquivamento,
} from '@/services/conversaMidias';

const isGroupChat = (id: string | null): id is string => !!id && id.includes('@g.us');

// Intervalo do polling de novas mensagens via Uazapi (a Uazapi não tem realtime)
const POLL_INTERVAL_MS = 15_000;

// Quantas mensagens buscar por vez no banco da Uazapi
const UAZAPI_MESSAGE_LIMIT = 200;

let painelMessagesDisponivel = true;

const uazapiToChatMessage = (msg: UazapiChatMessage, includeSender: boolean): ChatMessage => ({
  // 'human' põe a mensagem à esquerda; 'assistant', à direita (enviada por nós)
  role: msg.fromMe ? 'assistant' : 'human',
  content: msg.text,
  timestamp: new Date(msg.timestamp).toISOString(),
  type: msg.mediaType,
  mediaUrl: msg.mediaUrl,
  fileName: msg.fileName,
  senderName: includeSender && !msg.fromMe ? msg.senderName : undefined,
  messageId: msg.id || undefined,
  origem: 'uazapi',
});

type AtendimentoMensagem = {
  id: string;
  direcao: 'entrada' | 'saida_humana' | 'saida_bot';
  conteudo: string | null;
  tipo: string;
  ocorrido_em: string;
  mensagem_externa_id: string;
};

const atendimentoToChatMessage = (message: AtendimentoMensagem): ChatMessage => ({
  role: message.direcao === 'entrada' ? 'human' : 'assistant',
  content: message.conteudo || (message.tipo !== 'texto' ? 'Mídia recebida' : ''),
  timestamp: message.ocorrido_em,
  type: message.tipo,
  messageId: message.mensagem_externa_id || message.id,
  origem: 'atendimento',
});

const sortByTimestampDesc = (a: ChatMessage, b: ChatMessage) =>
  new Date(b.timestamp || '').getTime() - new Date(a.timestamp || '').getTime();

/**
 * Janela de reconciliação de mídia entre as origens.
 *
 * Precisa ser FOLGADA: o horário que o n8n grava e o que a Uazapi devolve para
 * a MESMA mensagem divergem pelo tempo de processamento. Apertar a janela não
 * protege rajada nenhuma (quem faz isso é o pareamento 1:1 abaixo) e cria
 * duplicata permanente sempre que a defasagem passar do limite.
 */
const SAME_MEDIA_WINDOW_MS = 90_000;

/**
 * Considera a mesma mídia quando o tipo bate e os horários estão próximos.
 * Serve para reconciliar o echo otimista (URL local) ou uma cópia no Supabase
 * com a versão canônica hospedada pela Uazapi.
 */
const isSameMedia = (a: ChatMessage, b: ChatMessage): boolean => {
  const dt = Math.abs(
    new Date(a.timestamp || '').getTime() - new Date(b.timestamp || '').getTime(),
  );
  if (dt >= SAME_MEDIA_WINDOW_MS) return false;
  // Compara o tipo REAL, não o campo `type` cru: a mesma foto chega como
  // 'human' pelo n8n e como 'imageMessage' pela Uazapi.
  if (inferMediaKind(a) !== inferMediaKind(b)) return false;
  // Com nome dos dois lados, ele desempata — é o que separa dois documentos
  // enviados no mesmo minuto.
  if (a.fileName && b.fileName) return a.fileName === b.fileName;
  return true;
};

/**
 * Mesma mídia com identidade quando os dois lados têm o id da Uazapi; senão,
 * cai na heurística de horário. Ids iguais são prova; ids diferentes NÃO são
 * prova do contrário — o catálogo grava um id local quando o envio não devolve
 * id, e essa mesma mídia volta do `/message/find` com o id real depois.
 */
const isSameMediaOrId = (a: ChatMessage, b: ChatMessage): boolean =>
  (!!a.messageId && a.messageId === b.messageId) || isSameMedia(a, b);

/**
 * A mensagem que acabou de chegar pelo realtime já está na tela?
 *
 * Compara SÓ contra mídia da mesma origem, e por identidade. É deliberado não
 * cruzar com a versão da Uazapi aqui: uma única foto já hospedada casaria pela
 * heurística com as três de uma rajada e engoliria duas. A reconciliação entre
 * origens é trabalho do polling (`midiasSemPar`), que pareia 1:1 e conta
 * certo — no máximo uma duplicata aparece por até 15s.
 */
const jaEstaNaTela = (existentes: ChatMessage[], incoming: ChatMessage): boolean =>
  existentes.some(
    (m) =>
      !!m.mediaUrl &&
      m.origem === incoming.origem &&
      !!m.messageId &&
      m.messageId === incoming.messageId,
  );

/**
 * Devolve as mídias de `candidatas` que NÃO têm equivalente em `jaExibidas`,
 * emparelhando 1 para 1.
 *
 * O 1:1 é o detalhe que importa. Com um `.some()` simples, três fotos numa
 * rajada casavam todas com a ÚNICA que a Uazapi já tivesse indexado, e duas
 * sumiam da tela. Consumindo a correspondência, cada mensagem hospedada
 * absorve no máximo uma candidata e o resto continua visível.
 */
const midiasSemPar = (candidatas: ChatMessage[], jaExibidas: ChatMessage[]): ChatMessage[] => {
  const disponiveis = [...jaExibidas];
  const semPar: ChatMessage[] = [];
  for (const candidata of candidatas) {
    const i = disponiveis.findIndex((exibida) => isSameMediaOrId(candidata, exibida));
    if (i >= 0) disponiveis.splice(i, 1);
    else semPar.push(candidata);
  }
  return semPar;
};

/**
 * Monta a lista de mídia da conversa em camadas de confiança: a versão
 * hospedada pela Uazapi é canônica; o histórico do n8n entra com o que ela
 * ainda não devolveu (o anexo que o cliente acabou de mandar); o catálogo do
 * Supabase fecha com o que nenhuma das duas alcança.
 */
const combinarMidias = (
  uazapiMedia: ChatMessage[],
  midiaHistorico: ChatMessage[],
  arquivadas: ChatMessage[],
): ChatMessage[] => {
  const midias = [...uazapiMedia];
  midias.push(...midiasSemPar(midiaHistorico, midias));
  midias.push(...midiasSemPar(arquivadas, midias));
  return midias;
};

/**
 * Conversa individual: o texto (com atendente/bot) vem do Supabase e a mídia,
 * das três origens combinadas acima.
 */
const mergeIndividual = (
  supabaseMessages: ChatMessage[],
  uazapiMedia: ChatMessage[],
  arquivadas: ChatMessage[] = [],
): ChatMessage[] => {
  const texto = supabaseMessages.filter((m) => !m.mediaUrl);
  const midiaHistorico = supabaseMessages.filter((m) => !!m.mediaUrl);
  return [...texto, ...combinarMidias(uazapiMedia, midiaHistorico, arquivadas)]
    .sort(sortByTimestampDesc);
};

export function useChatMessages(selectedChat: string | null, selectedPhone?: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Telefone atual num ref para o polling/reconciliação sem recriar callbacks
  const phoneRef = useRef<string | null | undefined>(selectedPhone);
  phoneRef.current = selectedPhone;

  // Mídia arquivada da conversa aberta. Fica em ref (e não em state) porque só
  // muda ao trocar de conversa: o polling de 15s reaproveita sem reassinar as
  // URLs do Storage a cada volta.
  const arquivadasRef = useRef<{ chatId: string; itens: ChatMessage[] } | null>(null);

  // O histórico anterior permanece legível na tabela legada enquanto a nova
  // fila é lida pela Edge Function autenticada. Assim não há perda visual no
  // dia do corte e o browser não ganha acesso direto às tabelas privadas.
  const loadSupabaseMessages = useCallback(async (conversationId: string): Promise<ChatMessage[]> => {
    if (!conversationId) return [];
    const targetSessionId = buildChatId(conversationId);
    const migratedPromise = painelMessagesDisponivel
      ? supabase.functions
          .invoke('atendimento-painel', {
            body: { action: 'mensagens', session_id: targetSessionId, limit: 100 },
          })
          .then((res) => {
            if (res.error) painelMessagesDisponivel = false;
            return res;
          })
          .catch(() => {
            painelMessagesDisponivel = false;
            return { data: null, error: null };
          })
      : Promise.resolve({ data: null, error: null });

    const [legacy, migrated] = await Promise.all([
      supabase
        .from('n8n_chat_histories')
        .select('id, session_id, message, data')
        .eq('session_id', conversationId)
        .order('id', { ascending: false })
        .limit(100),
      migratedPromise,
    ]);

    if (legacy.error) throw legacy.error;

    let all: ChatMessage[] = [];
    (legacy.data || []).forEach((row: N8nChatHistory) => {
      const parsed = parseMessage(row);
      if (parsed.length > 0) all = [...all, ...parsed];
    });
    if (!migrated.error && !migrated.data?.error) {
      const incoming = (migrated.data?.messages || []) as AtendimentoMensagem[];
      all.push(...incoming.map(atendimentoToChatMessage));
    }
    return all.sort(sortByTimestampDesc);
  }, []);

  // Busca as mensagens da conversa no banco da Uazapi. Degrada para lista
  // vazia em caso de falha — a Uazapi indisponível não pode zerar o chat.
  const loadUazapiRaw = useCallback(async (chatId: string): Promise<UazapiChatMessage[]> => {
    if (!isUazapiConfigured()) return [];
    try {
      return await findChatMessages(chatId, UAZAPI_MESSAGE_LIMIT);
    } catch (err) {
      console.warn('Falha ao buscar mídia da conversa na Uazapi:', err);
      return [];
    }
  }, []);

  const loadUazapiMedia = useCallback(async (idOrPhone: string): Promise<ChatMessage[]> => {
    const raw = await loadUazapiRaw(buildChatId(idOrPhone));
    return raw.filter((m) => !!m.mediaUrl).map((m) => uazapiToChatMessage(m, false));
  }, [loadUazapiRaw]);

  // Catálogo de mídias do Supabase, uma vez por conversa aberta.
  // `listarMidiasArquivadas` nunca lança: sem a migração aplicada, volta vazio
  // e o chat se comporta exatamente como antes.
  const loadArquivadas = useCallback(async (chatId: string): Promise<ChatMessage[]> => {
    if (arquivadasRef.current?.chatId === chatId) return arquivadasRef.current.itens;
    const itens = await listarMidiasArquivadas(chatId);
    arquivadasRef.current = { chatId, itens };
    return itens;
  }, []);

  /**
   * Cataloga no Supabase o que a Uazapi devolveu e, se ainda houver arquivo
   * sem cópia dos bytes, pede o arquivamento à edge function.
   *
   * Só roda na ABERTURA da conversa, nunca no polling: são até 200 mensagens
   * por chamada, e o polling repete a cada 15s por conversa aberta.
   */
  const catalogarMidias = useCallback(async (chatId: string, raw: UazapiChatMessage[]) => {
    const pendentes = await indexarMidiasDaConversa(chatId, phoneRef.current, raw);
    if (pendentes > 0) await solicitarArquivamento(chatId);
  }, []);

  // Carga da conversa individual: Supabase (texto + catálogo) + Uazapi (mídia).
  const fetchIndividualMessages = useCallback(async (sessionId: string, silent = false) => {
    if (!silent) setLoading(true);
    const chatId = buildChatId(phoneRef.current || sessionId);
    try {
      const [supabaseMessages, uazapiRaw, arquivadas] = await Promise.all([
        loadSupabaseMessages(sessionId),
        loadUazapiRaw(chatId),
        loadArquivadas(chatId),
      ]);
      const uazapiMedia = uazapiRaw
        .filter((m) => !!m.mediaUrl)
        .map((m) => uazapiToChatMessage(m, false));
      setMessages(mergeIndividual(supabaseMessages, uazapiMedia, arquivadas));
      if (!silent) {
        void catalogarMidias(chatId, uazapiRaw);
        // O histórico do n8n é a única origem do anexo recebido quando a
        // Uazapi não expõe a URL do arquivo.
        void indexarMidiasDoHistorico(chatId, phoneRef.current, supabaseMessages);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      if (!silent) {
        toast.error('Erro ao carregar mensagens', { description: 'Ocorreu um erro ao carregar as mensagens.' });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [loadSupabaseMessages, loadUazapiRaw, loadArquivadas, catalogarMidias]);

  // Poll só da mídia: preserva o texto (realtime/echo) e reconcilia a mídia com
  // a versão hospedada pela Uazapi — inclusive substituindo o echo local (blob)
  // do que acabou de ser enviado pela URL definitiva.
  const pollIndividualMedia = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    const targetSessionId = buildChatId(sessionId);
    const migratedPromise = painelMessagesDisponivel
      ? supabase.functions
          .invoke('atendimento-painel', {
            body: { action: 'mensagens', session_id: targetSessionId, limit: 100 },
          })
          .then((res) => {
            if (res.error) painelMessagesDisponivel = false;
            return res;
          })
          .catch(() => {
            painelMessagesDisponivel = false;
            return { data: null, error: null };
          })
      : Promise.resolve({ data: null, error: null });

    const [uazapiMedia, migrated] = await Promise.all([
      loadUazapiMedia(phoneRef.current || sessionId),
      migratedPromise,
    ]);
    const atendimento = !migrated.error && !migrated.data?.error
      ? ((migrated.data?.messages || []) as AtendimentoMensagem[]).map(atendimentoToChatMessage)
      : [];
    // Sem retorno do provedor nem da fila nova: mantém o estado atual e não
    // apaga o echo otimista.
    if (uazapiMedia.length === 0 && atendimento.length === 0) return;

    setMessages((prev) => {
      const nonMedia = prev.filter((m) => !m.mediaUrl && m.origem !== 'atendimento');
      // As cópias antigas da própria Uazapi saem fora: `uazapiMedia` é a lista
      // inteira recarregada, então reconciliá-las contra si mesmas só criaria
      // sobra. Candidatas são as outras origens.
      const outrasOrigens = prev.filter((m) => !!m.mediaUrl && m.origem !== 'uazapi');
      // Sem correspondente hospedado: envio recém-feito ainda em blob local,
      // arquivo que só existe no catálogo, ou anexo do cliente que a Uazapi
      // ainda não indexou. O pareamento 1:1 impede que uma rajada seja toda
      // absorvida pela primeira mensagem hospedada que casar.
      const pendingMedia = midiasSemPar(outrasOrigens, uazapiMedia);
      const uniqueAtendimento = atendimento.filter((incoming) => !prev.some((current) =>
        current.origem === 'local' && current.role === incoming.role && current.content === incoming.content &&
          Math.abs(new Date(current.timestamp || '').getTime() - new Date(incoming.timestamp || '').getTime()) < 60_000
      ));
      return [...nonMedia, ...uniqueAtendimento, ...pendingMedia, ...uazapiMedia].sort(sortByTimestampDesc);
    });
  }, [loadUazapiMedia]);

  // Grupos: o Supabase só tem o que o n8n gravou; a Uazapi guarda TODO o
  // histórico que passou pela instância — usa ela como fonte para grupos.
  const fetchGroupMessages = useCallback(async (chatId: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const raw = await findChatMessages(chatId, UAZAPI_MESSAGE_LIMIT);
      const chatMessages = raw.map((m) => uazapiToChatMessage(m, true));
      const arquivadas = await loadArquivadas(chatId);
      const semPar = midiasSemPar(arquivadas, chatMessages.filter((m) => !!m.mediaUrl));
      setMessages([...chatMessages, ...semPar].sort(sortByTimestampDesc));
      if (!silent) void catalogarMidias(chatId, raw);
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
  }, [loadSupabaseMessages, loadArquivadas, catalogarMidias]);

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

          // Arquivo do cliente aparece NA HORA. Antes esta mídia era
          // descartada e o anexo só surgia até 15s depois, pelo polling da
          // Uazapi — e nunca, se a Uazapi não expusesse a URL do arquivo.
          // O polling continua reconciliando: quando a versão hospedada
          // chegar, ela substitui esta (ver pollIndividualMedia).
          if (incoming.mediaUrl) {
            setMessages((prevMessages) =>
              jaEstaNaTela(prevMessages, incoming)
                ? prevMessages
                : [incoming, ...prevMessages].sort(sortByTimestampDesc),
            );
            return;
          }

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
