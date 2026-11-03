export type QueueStatus = 'aguardando' | 'chamado' | 'em_atendimento' | 'finalizado' | 'ausente' | 'cancelado';
export type QueuePriority = 'normal' | 'prioridade' | 'emergencia';
export type QueueOrigin = 'balcao' | 'totem' | 'whatsapp' | 'agenda' | 'web';

export interface ChatCategoryOption { id: string; label: string; perguntas: string[] }
export interface ChatCategory { id: string; chave: string; rotulo: string; icone: string | null; opcoes: ChatCategoryOption[]; ordem: number }
export interface WebConversation {
  id: string;
  code?: string | null;
  sessionId?: string | null;
  tutorName: string;
  petName: string | null;
  phone: string | null;
  status: string;
  categoryId: string | null;
  updatedAt: string;
  createdAt: string;
}
export interface WebMessage { id: string; conversationId: string; content: string; direction: 'recebida' | 'enviada'; categoryId: string | null; optionKey: string | null; createdAt: string }
export interface QueueService { id: string; name: string; prefix: string; active: boolean; order?: number; nome?: string; prefixo?: string; ativo?: boolean }
export interface QueueRoom { id: string; name: string; active: boolean; nome?: string; ativa?: boolean }
export interface QueueItem {
  id: string;
  ticket: string;
  serviceId: string;
  roomId: string | null;
  tutorName: string;
  petName: string | null;
  veterinarianName: string | null;
  priority: QueuePriority;
  status: QueueStatus;
  arrivedAt: string;
  calledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  clienteId?: number | null;
  petId?: string | null;
  motivoResumido?: string | null;
  chamadoPor?: string | null;
  iniciadoPor?: string | null;
  finalizadoPor?: string | null;
  ausenteEm?: string | null;
  ausentePor?: string | null;
  canceladoEm?: string | null;
  canceladoPor?: string | null;
  historicoTransferencias?: any[];
  /** Telefone do tutor (só dígitos, com DDI) usado nos avisos por WhatsApp. */
  phone?: string | null;
  origin?: QueueOrigin;
  /** Dia (ou 'continuo') a que a senha pertence. */
  cycle?: string;
  /** Avisos já enfileirados por WhatsApp: evento -> horário. */
  notices?: Record<string, string>;
}

export const QUEUE_ORIGIN_LABEL: Record<QueueOrigin, string> = {
  balcao: 'Balcão',
  totem: 'Totem',
  whatsapp: 'WhatsApp',
  agenda: 'Agenda',
  web: 'Chat web',
};

export const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
  aguardando: 'Aguardando',
  chamado: 'Chamado',
  em_atendimento: 'Em atendimento',
  finalizado: 'Finalizado',
  ausente: 'Não compareceu',
  cancelado: 'Cancelado',
};

export const QUEUE_PRIORITY_LABEL: Record<QueuePriority, string> = {
  normal: 'Normal',
  prioridade: 'Preferencial',
  emergencia: 'Urgente',
};
