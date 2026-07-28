export type ScheduledMessageStatus =
  | 'pendente'
  | 'processando'
  | 'enviado'
  | 'falha'
  | 'cancelado';

export type ScheduledMessageSender = 'cvi';

export interface ScheduledMessage {
  id: number;
  sessionId: string;
  clientId: number | null;
  ownerName: string;
  phone: string;
  message: string;
  scheduledFor: string;
  timezone: string;
  sender: ScheduledMessageSender;
  status: ScheduledMessageStatus;
  attempts: number;
  providerMessageId: string | null;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledMessageInput {
  message: string;
  scheduledFor: string;
  sender: ScheduledMessageSender;
}

export const SCHEDULED_MESSAGE_TIMEZONE = 'America/Sao_Paulo';

