import type { GrupoCategoria } from '@/lib/grupos';

/** Aba principal da lista: conversas (tudo) ou somente grupos da Uazapi. */
export type ChatViewMode = 'chats' | 'groups';

/** Ciclo de vida da conversa. Sem registro no banco, a conversa é 'aberta'. */
export type ConversationStatus = 'aberta' | 'fechada' | 'arquivada';

/** Filtro de status da lista de conversas. */
export type ConversationStatusFilter = 'todas' | ConversationStatus;

/**
 * Filtro de atribuição da lista de conversas: somente as atribuídas ao
 * atendente ativo no painel ou todas as conversas.
 */
export type ConversationAssignmentFilter = 'todas' | 'atribuidas';

export interface ConversationStatusInfo {
  sessionId: string;
  status: ConversationStatus;
  fechadaEm: string | null;
  arquivadaEm: string | null;
  reabertaEm: string | null;
}

export interface Client {
  id: number;
  telefone: string;
  nome: string;
  email: string;
  sessionid: string;
  cpf_cnpj?: string;
  nome_pet?: string;
  porte_pet?: string;
  raca_pet?: string;
  servico?: string | null;
  asaas_customer_id?: string | null;
}

export interface ChatMessage {
  role: string;
  content: string;
  timestamp: string;
  type?: string;
  mediaUrl?: string;
  fileName?: string;
  /** Nome de quem enviou (mensagens recebidas em grupos). */
  senderName?: string;
  /**
   * Identidade da mensagem na origem: id da Uazapi, `n8n:<id da linha>` do
   * histórico, ou o message_id do catálogo. Permite deduplicar por identidade
   * em vez de heurística de horário — mas só entre mensagens da MESMA origem,
   * porque os espaços de id são independentes.
   */
  messageId?: string;
  /**
   * De onde esta mensagem veio. A reconciliação de mídia depende disso: a
   * lista da Uazapi é recarregada inteira a cada polling, então as cópias
   * antigas dela precisam ser descartadas em vez de reconciliadas.
   */
  origem?: 'uazapi' | 'historico' | 'atendimento' | 'catalogo' | 'local';
}

export interface N8nChatHistory {
  id: number;
  session_id: string;
  message: any; // This can be various formats, we'll parse it properly
  data: string; // Date in string format
  hora?: string; // This is the field containing the correct time
}

export interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  avatar: string;
  phone: string;
  email: string;
  address?: string;
  petName?: string;
  petType?: string;
  petBreed?: string;
  sessionId: string;
  lastMessageDate?: Date; // Added for sorting conversations by date
  lastMessageSender?: 'human' | 'ai' | 'unknown'; // Added to track who sent the last message
  pausedSince?: Date | null; // Timestamp when bot was paused (from Redis)
  isGroup?: boolean;
  groupParticipants?: number; // Total de participantes (via Uazapi) quando é grupo
  /**
   * Só definido para grupos: `false` quando o grupo só existe pelo histórico
   * salvo (a instância não é mais membro, não aparece no `/group/list` da
   * Uazapi) — nesse caso não há como buscar mensagens novas via `/message/find`.
   */
  isGroupActive?: boolean;
  /** Classificação do grupo pelo nome (ver `src/lib/grupos.ts`). */
  groupCategoria?: GrupoCategoria;
  /** Grupo restrito a admins e não somos admin: não dá para responder. */
  groupSomenteLeitura?: boolean;
  /** Mensagens temporárias em segundos (0 = desligado). */
  groupTimerTemporario?: number;
  clientData?: {
    id: number;
    nome: string;
    email: string;
    telefone: string;
    cpf_cnpj?: string;
    servico?: string;
    asaas_customer_id?: string;
  };
}
