export const routeTitles: Record<string, string> = {
  '/dashboard': 'Início',
  '/chats': 'Conversas',
  '/metrics': 'Métricas',
  '/groups': 'Grupos',
  '/clients': 'Clientes',
  '/attendants': 'Atendentes',
  '/users': 'Usuários e auditoria',
  '/schedule': 'Calendário & Agenda',
  '/calendar': 'Calendário & Agenda',
  '/reminders': 'Lembretes',
  '/satisfaction-surveys': 'Pesquisas de Satisfação',
  '/knowledge': 'Base de Conhecimento (RAG)',
  '/evolution': 'Conexão WhatsApp',
  '/uazapi': 'Conexão WhatsApp (UAZAPI)',
  '/configuration': 'Configurações',
  '/agenda-configuracao': 'Regras da agenda',
  '/atendimento-configuracao': 'Configuração do atendimento',
};

export const getRouteTitle = (pathname: string): string =>
  routeTitles[pathname] ?? 'C.V.I. - Centro Veterinário Integrado';
