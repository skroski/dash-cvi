import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { N8nChatHistory } from '@/types/chat';
import { getActiveChat } from '@/lib/activeChat';
import { formatPhone } from '@/lib/formatters';
import { rotuloPreviaMidia } from '@/lib/media';
import { stripHtmlAndFormatting } from '@/utils/formatMessage';
import { getNotificationSettings, playNotificationChime } from '@/lib/notificationSound';

interface IncomingMessageInfo {
  isHuman: boolean;
  preview: string;
  senderName: string;
}

// O formato do payload de mensagem do n8n varia (string JSON, objeto, lote)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawMessagePayload = any;

/** Extrai origem (cliente/bot), texto e nome do contato do payload bruto do n8n. */
function extractIncomingMessage(history: N8nChatHistory): IncomingMessageInfo {
  let parsed: RawMessagePayload = null;

  if (typeof history.message === 'string') {
    try {
      parsed = JSON.parse(history.message);
    } catch {
      parsed = { content: history.message };
    }
  } else {
    parsed = history.message;
  }

  // Formato em lote: considera a última mensagem, preservando metadados do lote
  if (parsed && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
    parsed = { ...parsed, ...parsed.messages[parsed.messages.length - 1] };
  }

  const isHuman = parsed?.type === 'human' || parsed?.role === 'user';

  let preview =
    typeof parsed?.content === 'string' && parsed.content.trim()
      ? stripHtmlAndFormatting(parsed.content)
      : '';
  if (!preview && parsed?.mediaUrl) {
    // Pelo tipo real: o campo `type` frequentemente traz o papel de quem falou
    // ('human'), e aí toda foto virava "📄 Documento" na notificação.
    preview = rotuloPreviaMidia({
      type: parsed.type,
      mediaUrl: parsed.mediaUrl,
      fileName: parsed.fileName,
    });
  }
  if (!preview) preview = 'Nova mensagem';
  if (preview.length > 120) preview = `${preview.slice(0, 117)}…`;

  const senderName =
    parsed?.groupName || parsed?.chatName || parsed?.pushName || parsed?.senderName || '';

  return { isHuman, preview, senderName };
}

// Cache de nome/telefone por sessão para não repetir a consulta ao Supabase
const contactCache = new Map<string, { name: string; phone: string }>();

/**
 * Resolve nome e telefone formatado do contato: usa o nome do payload quando
 * houver, senão busca no cadastro de clientes (dados_cliente); nunca expõe o
 * session id cru.
 */
async function resolveContact(
  sessionId: string,
  payloadName: string
): Promise<{ title: string; phoneLabel: string }> {
  const isGroup = sessionId.includes('@g.us');
  const rawNumber = sessionId.split('@')[0];

  if (isGroup) {
    return { title: payloadName || 'Grupo do WhatsApp', phoneLabel: '' };
  }

  let cached = contactCache.get(sessionId);
  if (!cached) {
    let name = '';
    let phone = rawNumber;
    try {
      const { data } = await supabase
        .from('dados_cliente')
        .select('nome, telefone')
        .eq('sessionid', sessionId)
        .limit(1);
      if (data && data.length > 0) {
        name = data[0].nome || '';
        phone = data[0].telefone || rawNumber;
      }
    } catch (err) {
      console.error('Erro ao buscar contato para notificação:', err);
    }
    cached = { name, phone };
    contactCache.set(sessionId, cached);
  }

  const phoneLabel = formatPhone(cached.phone) || formatPhone(rawNumber);
  const name = payloadName || cached.name;
  return {
    title: name || phoneLabel || 'Novo contato',
    phoneLabel: name ? phoneLabel : '',
  };
}

/**
 * Listener global de novas mensagens: toca o sinal sonoro, mostra toast com
 * atalho para abrir a conversa e, com a aba em segundo plano, dispara
 * notificação nativa do navegador e contador no título da aba.
 *
 * Montado no AppShell para funcionar em qualquer página do dashboard.
 */
const GlobalMessageNotifications = () => {
  const navigate = useNavigate();
  // Ref evita recriar a subscription realtime a cada navegação
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const baseTitleRef = useRef(document.title);
  const unseenCountRef = useRef(0);

  // Ao voltar para a aba, zera o contador do título
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        unseenCountRef.current = 0;
        document.title = baseTitleRef.current;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('global-message-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'n8n_chat_histories' },
        (payload) => {
          const history = payload.new as N8nChatHistory;
          const { isHuman, preview, senderName } = extractIncomingMessage(history);

          // Só avisa mensagens recebidas de clientes (não respostas do bot/atendente)
          if (!isHuman) return;

          const sessionId = history.session_id;
          const isTabVisible = document.visibilityState === 'visible';

          // Conversa já aberta na tela: o usuário está lendo, não precisa de aviso
          if (isTabVisible && getActiveChat() === sessionId) return;

          playNotificationChime('message');

          // Grupos abrem na página de grupos; conversas na de conversas
          const targetPath = sessionId.includes('@g.us') ? '/groups' : '/chats';
          const openConversation = () =>
            navigateRef.current(`${targetPath}?select=${encodeURIComponent(sessionId)}`);

          void resolveContact(sessionId, senderName).then(({ title, phoneLabel }) => {
            const description = phoneLabel ? `${phoneLabel} · ${preview}` : preview;

            toast.info(`Nova mensagem de ${title}`, {
              id: `nova-mensagem-${sessionId}`, // agrupa avisos da mesma conversa
              description,
              action: {
                label: 'Abrir conversa',
                onClick: openConversation,
              },
            });

            if (!isTabVisible) {
              unseenCountRef.current += 1;
              document.title = `(${unseenCountRef.current}) ${baseTitleRef.current}`;

              const { browserEnabled } = getNotificationSettings();
              if (
                browserEnabled &&
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
                try {
                  const notification = new Notification(
                    phoneLabel ? `${title} · ${phoneLabel}` : title,
                    {
                      body: preview,
                      tag: `cvi-chat-${sessionId}`, // substitui o aviso anterior da mesma conversa
                      icon: '/favicon.ico',
                    }
                  );
                  notification.onclick = () => {
                    window.focus();
                    openConversation();
                    notification.close();
                  };
                } catch (err) {
                  console.error('Erro ao exibir notificação do navegador:', err);
                }
              }
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
};

export default GlobalMessageNotifications;
