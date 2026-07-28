
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
