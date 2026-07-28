export type ReminderDeliveryStatus =
  | 'pendente'
  | 'processando'
  | 'enviado'
  | 'falha'
  | 'ignorado';

export interface ReminderConfiguration {
  id: number;
  name: string;
  enabled: boolean;
  daysInAdvance: 1;
  sendTime: string;
  timezone: string;
  messageTemplate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderConfigurationInput {
  name: string;
  enabled: boolean;
  sendTime: string;
  timezone: string;
  messageTemplate: string;
}

export interface ReminderDelivery {
  id: number;
  configurationId: number | null;
  configurationName: string;
  appointmentKey: string;
  appointmentDate: string;
  appointmentTime: string | null;
  service: string | null;
  description: string | null;
  ownerName: string;
  petName: string | null;
  phone: string;
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
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_REMINDER_TEMPLATE =
  'Olá, {{nome_tutor}}! Passando para lembrar que {{nome_pet}} tem {{servico}} agendado para amanhã, {{data}}, às {{horario}}.\n\nSe precisar ajustar o horário, responda esta mensagem.';

export const REMINDER_TEMPLATE_VARIABLES = [
  { token: '{{nome_tutor}}', label: 'Tutor' },
  { token: '{{nome_pet}}', label: 'Pet' },
  { token: '{{servico}}', label: 'Serviço' },
  { token: '{{data}}', label: 'Data' },
  { token: '{{horario}}', label: 'Horário' },
] as const;

export function normalizeReminderTime(value: string) {
  return value?.slice(0, 5) || '18:00';
}

export function renderReminderPreview(template: string) {
  const previewValues: Record<string, string> = {
    '{{nome_tutor}}': 'Mariana',
    '{{nome_pet}}': 'Bento',
    '{{servico}}': 'consulta veterinária',
    '{{data}}': '17/07/2026',
    '{{horario}}': '10:30',
  };

  return Object.entries(previewValues).reduce(
    (message, [token, value]) => message.split(token).join(value),
    template
  );
}
