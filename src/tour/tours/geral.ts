import type { TourDef } from '../types';

/**
 * Único tour que muda de rota. Regra que o runtime depende: todo passo que
 * troca de página é centralizado (sem `element`), porque o `showOn` do Shepherd
 * é avaliado antes da navegação acontecer.
 */
export const tourGeral: TourDef = {
  id: 'geral',
  title: 'Visão geral do sistema',
  description: 'Um passeio de ponta a ponta pelo painel: menu, barra superior e as telas principais.',
  routes: [],
  steps: [
    {
      id: 'boas-vindas',
      title: 'Bem-vindo ao painel',
      text:
        '<p>Este tour mostra onde fica cada coisa. Leva cerca de dois minutos.</p>' +
        '<p>Use <strong>Próximo</strong> e <strong>Voltar</strong>, ou as setas do teclado. Para sair a qualquer momento, aperte <code>Esc</code>.</p>',
      route: '/dashboard',
    },
    {
      id: 'menu-lateral',
      title: 'Menu lateral',
      text:
        '<p>Todas as áreas do sistema ficam aqui. O que aparece depende do seu perfil — atendente, líder ou administrador.</p>' +
        '<p>Você pode recolher o menu no botão à esquerda do título, ou com <code>Ctrl</code>+<code>B</code>.</p>',
      element: '[data-sidebar="content"]',
      on: 'right',
      requireSidebar: true,
      route: '/dashboard',
    },
    {
      id: 'nav-conversas',
      title: 'Conversas',
      text: '<p>É onde o dia acontece: todas as conversas de WhatsApp com os tutores, em um formato parecido com o próprio aplicativo.</p>',
      element: '[data-tour="nav:/chats"]',
      on: 'right',
      requireSidebar: true,
      route: '/dashboard',
    },
    {
      id: 'header-status',
      title: 'Seu status',
      text:
        '<p>Avisa o resto da equipe se você está <strong>Disponível</strong>, em almoço, pausa ou reunião.</p>' +
        '<p>Quem é líder ou administrador vê esse quadro consolidado na tela de Atendentes.</p>',
      element: '[aria-label^="Seu status"]',
      on: 'bottom',
      route: '/dashboard',
    },
    {
      id: 'header-atendente',
      title: 'Atendente em uso no painel',
      text: '<p>Define em nome de quem o painel está operando. É o que liga as conversas atribuídas a você e assina as mensagens enviadas.</p>',
      element: '[aria-label="Atendente em uso no painel"]',
      on: 'bottom',
      route: '/dashboard',
    },
    {
      id: 'header-notificacoes',
      title: 'Notificações',
      text: '<p>Mensagens novas e avisos do sistema chegam aqui, com um contador de não lidas.</p>',
      element: '[aria-label^="Notificações"]',
      on: 'bottom',
      route: '/dashboard',
    },
    {
      id: 'header-tema',
      title: 'Tema claro ou escuro',
      text: '<p>Escolha entre claro, escuro ou seguir a configuração do seu computador. A preferência fica salva neste navegador.</p>',
      element: '[aria-label="Alterar tema"]',
      on: 'bottom',
      route: '/dashboard',
    },
    {
      id: 'inicio',
      title: 'Tela de Início',
      text: '<p>O resumo do dia: números principais, atalhos para as ações mais comuns e os clientes cadastrados recentemente.</p>',
      element: '[data-tour="dashboard-stats"]',
      on: 'bottom',
      route: '/dashboard',
    },
    {
      id: 'ir-conversas',
      title: 'Agora, as Conversas',
      text: '<p>Vamos abrir a tela de Conversas para ver como ela é organizada.</p>',
      route: '/chats',
    },
    {
      id: 'conversas-paineis',
      title: 'Três painéis',
      text:
        '<ul>' +
        '<li><strong>Esquerda:</strong> a lista de conversas e os filtros.</li>' +
        '<li><strong>Centro:</strong> as mensagens da conversa aberta.</li>' +
        '<li><strong>Direita:</strong> os dados do tutor, do pet e as pendências.</li>' +
        '</ul>' +
        '<p>As divisórias podem ser arrastadas para você dar mais espaço ao painel que quiser.</p>',
      element: '[data-tour="chat-panel-list"]',
      on: 'right',
      desktopOnly: true,
      route: '/chats',
      timeoutMs: 6000,
    },
    {
      id: 'ir-clientes',
      title: 'A base de clientes',
      text: '<p>Por último, a tela de Clientes — o cadastro dos tutores e dos pets.</p>',
      route: '/clients',
    },
    {
      id: 'clientes-tabela',
      title: 'Cadastro de tutores',
      text: '<p>Busca, filtros e a lista completa. É daqui que saem as informações que aparecem no painel direito das Conversas.</p>',
      element: '[data-tour="clients-filters"]',
      on: 'bottom',
      route: '/clients',
      timeoutMs: 6000,
    },
    {
      id: 'fim',
      title: 'Pronto!',
      text:
        '<p>Sempre que precisar, clique no botão <strong>Ajuda</strong> no canto superior direito.</p>' +
        '<p>Além deste passeio geral, cada tela tem um tour próprio explicando os detalhes dela.</p>',
      route: '/clients',
    },
  ],
};
