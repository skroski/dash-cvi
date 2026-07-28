export const routeTitles: Record<string, string> = {
  '/dashboard': 'Início',
  '/chats': 'Conversas',
  '/metrics': 'Métricas',
  '/groups': 'Grupos',
  '/clients': 'Clientes',
  '/attendants': 'Atendentes',
  '/users': 'Usuários e auditoria',
  '/schedule': 'Agenda',
  '/reminders': 'Lembretes',
  '/satisfaction-surveys': 'Pesquisas de Satisfação',
  '/knowledge': 'Conhecimento',
  '/evolution': 'Conexão WhatsApp',
  '/configuration': 'Configurações',
};

export const getRouteTitle = (pathname: string): string =>
  routeTitles[pathname] ?? 'VetBots';
