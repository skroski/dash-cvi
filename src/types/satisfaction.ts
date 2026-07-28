export type SatisfactionDeliveryStatus =
  | 'pendente'
  | 'enviado'
  | 'cadastrado'
  | 'falha';

export interface SatisfactionConfiguration {
  id: number;
  name: string;
  enabled: boolean;
  googleFormId: string;
  googleFormUrl: string;
  googleTokenEntryId: string;
  messageTemplate: string;
  createdAt: string;
  updatedAt: string;
}

export interface SatisfactionConfigurationInput {
  name: string;
  enabled: boolean;
  googleFormId: string;
  googleFormUrl: string;
  googleTokenEntryId: string;
  messageTemplate: string;
}

export interface SatisfactionDelivery {
  id: number;
  configurationId: number;
  configurationName: string;
  clientId: number | null;
  appointmentKey: string | null;
  appointmentDate: string | null;
  appointmentTime: string | null;
  service: string | null;
  petName: string | null;
  ownerName: string;
  phone: string;
  normalizedPhone: string;
  email: string | null;
  status: SatisfactionDeliveryStatus;
  trackingToken: string;
  surveyLink: string | null;
  providerMessageId: string | null;
  error: string | null;
  sentAt: string | null;
  registeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SatisfactionResponse {
  id: number;
  deliveryId: number;
  configurationId: number;
  googleResponseId: string | null;
  submittedAt: string;
  rating: number | null;
  nps: number | null;
  comment: string | null;
  email: string | null;
  phone: string | null;
  answers: Record<string, unknown>;
  createdAt: string;
}

export const DEFAULT_SATISFACTION_TEMPLATE =
  'Olá, {{nome_tutor}}! Queremos saber como foi sua experiência conosco. Sua opinião é muito importante: {{link_pesquisa}}';

export const SATISFACTION_TEMPLATE_VARIABLES = [
  { token: '{{nome_tutor}}', label: 'Nome do tutor' },
  { token: '{{nome_pet}}', label: 'Nome do pet' },
  { token: '{{servico}}', label: 'Serviço' },
  { token: '{{link_pesquisa}}', label: 'Link individual da pesquisa' },
] as const;

export function renderSatisfactionPreview(template: string) {
  return template
    .replaceAll('{{nome_tutor}}', 'Mariana')
    .replaceAll('{{nome_pet}}', 'Luna')
    .replaceAll('{{servico}}', 'consulta')
    .replaceAll('{{link_pesquisa}}', 'https://forms.gle/exemplo-individual');
}
