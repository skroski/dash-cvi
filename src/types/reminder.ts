import { DADOS_EXEMPLO, renderizarExemplo } from '@/lib/reminderMessage';
import type { ReminderPresetCategory } from '@/config/exampleMessagePresets';

export type ReminderDeliveryStatus =
  | 'pendente'
  | 'processando'
  | 'enviado'
  | 'falha'
  | 'ignorado'
  | 'cancelado';

export type ReminderMessageStatus = ReminderDeliveryStatus;
export type ReminderTrigger = 'automatico' | 'manual' | 'teste';
export type ReminderAppointmentOrigin = 'manual' | 'importacao' | 'integracao';
export type ReminderServiceColor = 'azul' | 'verde' | 'ambar' | 'rosa' | 'roxo' | 'cinza';
export type ReminderEventType =
  | 'planejado'
  | 'enviado'
  | 'falha'
  | 'ignorado'
  | 'cancelado'
  | 'reagendado'
  | 'erro_sistema'
  | 'info';

export interface ReminderConfiguration {
  id: number;
  name: string;
  category?: ReminderPresetCategory;
  enabled: boolean;
  daysInAdvance: number;
  sendTime: string;
  timezone: string;
  /** Legado do contrato com o n8n; substituído pelas frases de exemplo. */
  messageTemplate: string;
  examples: string[];
  useAi: boolean;
  aiModel: string;
  aiInstructions: string | null;
  serviceIds: number[];
  intervalMinSeconds: number;
  intervalMaxSeconds: number;
  sendWindowHours: number;
  /** Só agendamentos com status CONFIRMADO entram na fila. */
  onlyConfirmed: boolean;
  /** Envia 2 botões interativos via Uazapi: [Confirmar] e [Não Confirmar]. */
  botoesConfirmacao: boolean;
  /** Tempo de pausa da IA no Redis após envio em minutos (ex: 1.5 min = 90s). */
  pausaIaMinutos: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderConfigurationInput {
  name: string;
  category?: ReminderPresetCategory;
  enabled: boolean;
  daysInAdvance: number;
  sendTime: string;
  timezone: string;
  examples: string[];
  useAi: boolean;
  aiModel: string;
  aiInstructions: string | null;
  serviceIds: number[];
  intervalMinSeconds: number;
  intervalMaxSeconds: number;
  sendWindowHours: number;
  onlyConfirmed: boolean;
  botoesConfirmacao?: boolean;
  pausaIaMinutos?: number;
}

/** Agendamento da agenda de lembretes (tabela lembrete_envios). */
export interface ReminderDelivery {
  id: number;
  configurationId: number | null;
  configurationName: string;
  appointmentKey: string;
  appointmentDate: string;
  appointmentTime: string | null;
  service: string | null;
  serviceId: number | null;
  /** Texto próprio deste agendamento na mensagem. Vazio: usa o da categoria. */
  serviceText: string | null;
  description: string | null;
  ownerName: string;
  petName: string | null;
  phone: string;
  phoneKey: string | null;
  email: string | null;
  petSize: string | null;
  price: number | null;
  appointmentStatus: string | null;
  scheduledFor: string;
  status: ReminderDeliveryStatus;
  attempts: number;
  providerMessageId: string | null;
  error: string | null;
  sentAt: string | null;
  messageId: number | null;
  origin: ReminderAppointmentOrigin;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderAppointmentInput {
  ownerName: string;
  phone: string;
  petName: string | null;
  serviceId: number | null;
  serviceText: string | null;
  configurationId: number | null;
  appointmentDate: string;
  appointmentTime: string | null;
  description: string | null;
}

export interface ReminderService {
  id: number;
  name: string;
  /** Como o serviço é escrito na frase. Vazio: usa o nome. */
  messageText: string | null;
  color: ReminderServiceColor;
  active: boolean;
  order: number;
}

export interface ReminderMessage {
  id: number;
  configurationId: number | null;
  configurationName: string;
  trigger: ReminderTrigger;
  sendDay: string;
  phone: string;
  ownerName: string;
  petNames: string[];
  services: string[];
  appointmentDate: string;
  appointmentTime: string | null;
  scheduledFor: string;
  status: ReminderMessageStatus;
  attempts: number;
  text: string | null;
  textSource: 'ia' | 'exemplo' | 'manual' | null;
  exampleIndex: number | null;
  aiModel: string | null;
  providerMessageId: string | null;
  error: string | null;
  sentAt: string | null;
  /** Envia 2 botões interativos via Uazapi: [Confirmar] e [Não Confirmar]. */
  botoesConfirmacao?: boolean;
  category?: ReminderPresetCategory;
  pausaIaMinutos?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderEvent {
  id: number;
  messageId: number | null;
  type: ReminderEventType;
  description: string;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface ReminderSettings {
  autoSend: boolean;
  clinicName: string;
  testPhone: string | null;
  pausaIaMinutos: number;
  updatedAt: string;
}

export interface ReminderDiagnostics {
  cronActive: boolean;
  cronLastRun: string | null;
  vaultConfigured: boolean;
  pending: number;
  processing: number;
  openai: boolean | null;
  uazapi: boolean | null;
  cronSecret: boolean | null;
}

export interface ReminderAiPreview {
  texto: string;
  origem: 'ia' | 'exemplo';
  exemplo_indice: number | null;
  aviso: string | null;
}

export const REMINDER_AI_MODELS = [
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini (recomendado)' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
] as const;

export const REMINDER_SERVICE_COLORS: Record<
  ReminderServiceColor,
  { label: string; className: string; dot: string }
> = {
  azul: {
    label: 'Azul',
    className: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  verde: {
    label: 'Verde',
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  ambar: {
    label: 'Âmbar',
    className: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  rosa: {
    label: 'Rosa',
    className: 'border-pink-500/25 bg-pink-500/10 text-pink-700 dark:text-pink-300',
    dot: 'bg-pink-500',
  },
  roxo: {
    label: 'Roxo',
    className: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
  cinza: {
    label: 'Cinza',
    className: 'border-border bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
};

/** Primeira frase padrão, usada como modelo rápido no chat. */
export const DEFAULT_REMINDER_TEMPLATE =
  '🐾 Lembrete da {{clinica}}!\n\nOlá, {{nome_tutor}}! Passando para lembrar do atendimento de {{nome_pet}}: {{servico}} {{quando}}, {{data}}, às {{horario}}.\n\nManter o cuidado em dia é essencial para proteger quem você ama! 🥰\n\nSe precisar confirmar ou remarcar, é só responder esta mensagem. 💚\n\n{{clinica}} — Cuidado em 1º lugar! 🐾';

export function normalizeReminderTime(value: string) {
  return value?.slice(0, 5) || '18:00';
}

export function daysInAdvanceLabel(days: number) {
  if (days === 0) return 'No próprio dia';
  if (days === 1) return '1 dia antes (véspera)';
  return `${days} dias antes`;
}

/** Prévia de uma frase com dados fictícios (mesma regra do envio). */
export function renderReminderPreview(template: string, clinicName = 'C.V.I. - Centro Veterinário Integrado', daysInAdvance = 1) {
  const sendDay = new Date();
  const appointment = new Date(sendDay);
  appointment.setDate(appointment.getDate() + daysInAdvance);
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return renderizarExemplo(template, {
    ...DADOS_EXEMPLO,
    clinica: clinicName,
    diaEnvio: iso(sendDay),
    dataAgendada: iso(appointment),
  });
}
