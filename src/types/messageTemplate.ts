export type MessageTemplateCategory =
  | 'whatsapp'
  | 'atendimento'
  | 'lembrete'
  | 'pesquisa'
  | 'personalizado';

export interface MessageTemplate {
  id: string;
  title: string;
  shortcut: string; // Ex: "/boasvindas", "/consultaveterinaria", "/lembrete"
  category: MessageTemplateCategory;
  content: string;
  isDefault?: boolean;
}

export interface CustomMessageTemplateInput {
  title: string;
  shortcut: string;
  content: string;
}
