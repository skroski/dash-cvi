import { ChatMessage, N8nChatHistory } from '@/types/chat';



export const formatToBrazilTime = (input?: string | Date): string => {
  if (!input) return '';

  try {
    const date = new Date(input);
    if (isNaN(date.getTime())) return '';

    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });

    const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const time = formatter.format(date);
    const formattedDate = dateFormatter.format(date);

    const now = new Date();
    const today = dateFormatter.format(now);

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayFormatted = dateFormatter.format(yesterday);

    if (formattedDate === today) return `Hoje ${time}`;
    if (formattedDate === yesterdayFormatted) return `Ontem ${time}`;

    const weekDay = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
    }).format(date);

    return `${weekDay}, ${formattedDate.slice(0, 5)} ${time}`;
  } catch {
    return String(input);
  }
};

/**
 * Compatibilidade
 */
export const extractHourFromTimestamp = formatToBrazilTime;
export const formatMessageTime = formatToBrazilTime;
/**
 * Parser de mensagens
 */
export const parseMessage = (chat: N8nChatHistory): ChatMessage[] => {
  try {
    const timestamp = new Date(chat.hora || chat.data || new Date()).toISOString();

    const normalize = (msg: any): ChatMessage[] =>
      msg?.role && (msg?.content !== undefined || msg?.mediaUrl)
        ? [{ 
            role: msg.role, 
            content: msg.content || '', 
            timestamp,
            type: msg.type,
            mediaUrl: msg.mediaUrl,
            fileName: msg.fileName
          }]
        : [];

    if (typeof chat.message === 'string') {
      try {
        const parsed = JSON.parse(chat.message);
        if (parsed?.type || parsed?.content || parsed?.mediaUrl) {
          return [{
            role: parsed.role || (parsed.type === 'human' ? 'user' : 'assistant'),
            type: parsed.type,
            content: parsed.content || '',
            timestamp,
            mediaUrl: parsed.mediaUrl,
            fileName: parsed.fileName
          }];
        }
      } catch {
        return [{ role: 'unknown', content: chat.message, timestamp }];
      }
    }

    if (Array.isArray(chat.message?.messages)) {
      return chat.message.messages.flatMap(normalize);
    }

    if (chat.message?.type || chat.message?.content || chat.message?.mediaUrl) {
      return [{
        role: chat.message.role || (chat.message.type === 'human' ? 'user' : 'assistant'),
        type: chat.message.type,
        content: chat.message.content || '',
        timestamp,
        mediaUrl: chat.message.mediaUrl,
        fileName: chat.message.fileName
      }];
    }

    return normalize(chat.message);
  } catch (err) {
    console.error('Error parsing message:', err, chat);
    return [];
  }
};


