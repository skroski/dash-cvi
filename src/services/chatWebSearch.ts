import { supabase } from '@/integrations/supabase/client';
import { Conversation, N8nChatHistory } from '@/types/chat';
import { toWhatsappNumber } from '@/lib/formatters';
import { formatMessageTime } from '@/utils/chatUtils';

export interface ChatWebSearchResult {
  found: boolean;
  sessionId: string;
  phone: string;
  name: string;
  firstName: string;
  petName?: string;
  petBreed?: string;
  petSize?: string;
  clientId?: number;
  code: string;
  lastMessage?: string;
  lastMessageDate?: Date;
  conversation: Conversation;
}

/**
 * Gera um código legível e amigável para o ChatWeb (ex: CW-84920 ou CW-7K3M).
 */
export function generateChatWebCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let random = '';
  for (let i = 0; i < 5; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CW-${random}`;
}

/**
 * Normaliza um primeiro nome retirando acentos e espaços.
 */
export function sanitizeFirstName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)[0] || '';
}

/**
 * Constrói um objeto Conversation sintético compatível com os componentes de chat do sistema.
 */
export function buildSyntheticConversation(params: {
  sessionId: string;
  name: string;
  phone: string;
  petName?: string | null;
  petBreed?: string | null;
  petSize?: string | null;
  clientId?: number | null;
  email?: string | null;
  lastMessage?: string;
  lastMessageDate?: Date;
}): Conversation {
  const lastDate = params.lastMessageDate || new Date();
  return {
    id: params.sessionId,
    sessionId: params.sessionId,
    name: params.name,
    phone: params.phone,
    avatar: '',
    lastMessage: params.lastMessage || 'Conversa iniciada via ChatWeb',
    time: formatMessageTime(lastDate),
    lastMessageDate: lastDate,
    unread: 0,
    isGroup: false,
    petName: params.petName || undefined,
    petBreed: params.petBreed || undefined,
    petType: params.petSize || undefined,
    email: params.email || undefined,
    clientData: params.clientId
      ? {
          id: params.clientId,
          nome: params.name,
          telefone: params.phone,
          email: params.email || '',
        }
      : undefined,
  };
}

/**
 * Busca cliente e histórico de conversa pelo telefone e primeiro nome no WhatsApp.
 */
export async function searchConversationByPhoneAndFirstName(
  phoneInput: string,
  firstNameInput: string
): Promise<ChatWebSearchResult> {
  const cleanDigits = phoneInput.replace(/\D/g, '');
  const searchFirstName = sanitizeFirstName(firstNameInput);
  const whatsappNumber = toWhatsappNumber(phoneInput) || cleanDigits;
  const shortDigits = cleanDigits.length >= 8 ? cleanDigits.slice(-8) : cleanDigits;

  // 1. Verificar se já existe uma sessão gravada no chat_web_conversas
  let existingWebCode: string | null = null;
  try {
    const { data: webConv } = await (supabase as any)
      .from('chat_web_conversas')
      .select('id, codigo, nome_tutor, nome_pet, telefone, session_id')
      .or(`telefone.ilike.%${shortDigits}%,session_id.ilike.%${shortDigits}%`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (webConv?.codigo) {
      existingWebCode = webConv.codigo;
    }
  } catch (err) {
    console.warn('Tabela chat_web_conversas não consultada ou sem coluna:', err);
  }

  // 2. Buscar em dados_cliente por telefone
  let matchedClient: any = null;
  try {
    const { data: clientRows } = await supabase
      .from('dados_cliente')
      .select('*')
      .or(`telefone.ilike.%${shortDigits}%,sessionid.ilike.%${shortDigits}%`)
      .limit(10);

    if (clientRows && clientRows.length > 0) {
      // Filtrar pelo primeiro nome se houver coincidência
      const exactMatch = clientRows.find((c) => {
        const clientFirst = sanitizeFirstName(c.nome || '');
        return clientFirst && searchFirstName && (clientFirst === searchFirstName || clientFirst.startsWith(searchFirstName) || searchFirstName.startsWith(clientFirst));
      });
      matchedClient = exactMatch || clientRows[0];
    }
  } catch (err) {
    console.warn('Erro ao consultar dados_cliente:', err);
  }

  // 3. Buscar em n8n_chat_histories para localizar histórico WhatsApp e pushName
  let sessionHistoryId = matchedClient?.sessionid || whatsappNumber;
  let lastMessageText = '';
  let lastMessageDate = new Date();
  let whatsappPushName = '';

  try {
    const { data: historyRows } = await supabase
      .from('n8n_chat_histories')
      .select('id, session_id, message, data')
      .or(`session_id.eq.${whatsappNumber},session_id.ilike.%${shortDigits}%`)
      .order('id', { ascending: false })
      .limit(5);

    if (historyRows && historyRows.length > 0) {
      const top = historyRows[0];
      sessionHistoryId = top.session_id;
      const rawDate = top.data;
      if (rawDate) {
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) lastMessageDate = parsed;
      }

      // Extrair último texto e pushName se disponível
      for (const row of historyRows) {
        let msgObj: any = row.message;
        if (typeof msgObj === 'string') {
          try {
            msgObj = JSON.parse(msgObj);
          } catch {}
        }
        if (msgObj) {
          if (!lastMessageText) {
            lastMessageText = msgObj.content || msgObj.text || '';
          }
          if (!whatsappPushName) {
            whatsappPushName = msgObj.pushName || msgObj.senderName || msgObj.groupName || '';
          }
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao consultar n8n_chat_histories:', err);
  }

  const resolvedName =
    matchedClient?.nome ||
    whatsappPushName ||
    firstNameInput.trim() ||
    `Tutor (${phoneInput})`;

  const resolvedPhone =
    matchedClient?.telefone ||
    whatsappNumber ||
    phoneInput;

  const resolvedPet = matchedClient?.nome_pet || null;
  const resolvedCode = existingWebCode || generateChatWebCode();
  const isFound = !!(matchedClient || lastMessageText || existingWebCode);

  const conversation = buildSyntheticConversation({
    sessionId: sessionHistoryId,
    name: resolvedName,
    phone: resolvedPhone,
    petName: resolvedPet,
    petBreed: matchedClient?.raca_pet,
    petSize: matchedClient?.porte_pet,
    clientId: matchedClient?.id,
    email: matchedClient?.email,
    lastMessage: lastMessageText,
    lastMessageDate,
  });

  return {
    found: isFound,
    sessionId: sessionHistoryId,
    phone: resolvedPhone,
    name: resolvedName,
    firstName: firstNameInput.trim(),
    petName: resolvedPet || undefined,
    petBreed: matchedClient?.raca_pet || undefined,
    petSize: matchedClient?.porte_pet || undefined,
    clientId: matchedClient?.id,
    code: resolvedCode,
    lastMessage: lastMessageText || undefined,
    lastMessageDate,
    conversation,
  };
}

/**
 * Busca uma conversa diretamente pelo código ChatWeb (ex: CW-84920).
 */
export async function searchConversationByCode(
  code: string
): Promise<ChatWebSearchResult | null> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return null;

  try {
    const { data, error } = await (supabase as any)
      .from('chat_web_conversas')
      .select('*')
      .ilike('codigo', cleanCode)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Com o telefone e o nome encontrados na sessão, faz a busca completa
    const phone = data.telefone || data.session_id || '';
    const name = data.nome_tutor || '';
    const firstName = name.split(' ')[0] || '';

    const result = await searchConversationByPhoneAndFirstName(phone, firstName);
    result.code = data.codigo || cleanCode;
    if (data.nome_pet && !result.petName) {
      result.petName = data.nome_pet;
      result.conversation.petName = data.nome_pet;
    }
    return result;
  } catch (err) {
    console.error('Erro ao buscar conversa por código:', err);
    return null;
  }
}

/**
 * Registra ou atualiza a sessão do ChatWeb no Supabase.
 */
export async function persistChatWebSession(session: {
  code: string;
  sessionId: string;
  tutorName: string;
  phone: string;
  petName?: string | null;
}) {
  try {
    const { data: user } = await supabase.auth.getUser();
    await (supabase as any)
      .from('chat_web_conversas')
      .upsert(
        {
          codigo: session.code,
          session_id: session.sessionId,
          nome_tutor: session.tutorName,
          telefone: session.phone,
          nome_pet: session.petName || null,
          status: 'aberta',
          created_by: user?.user?.id || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'codigo' }
      );
  } catch (err) {
    console.warn('Não foi possível persistir sessão do ChatWeb no banco:', err);
  }
}
