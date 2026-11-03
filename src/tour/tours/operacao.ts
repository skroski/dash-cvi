import type { TourDef } from '../types';

/** Tours das telas do dia a dia — visíveis para todos os papéis. */

export const tourInicio: TourDef = {
  id: 'dashboard',
  title: 'Tela de Início',
  description: 'Os números do dia, os atalhos rápidos e os clientes recentes.',
  routes: ['/dashboard'],
  steps: [
    {
      id: 'stats',
      title: 'Os números do dia',
      text:
        '<p>Quatro indicadores atualizados a cada carregamento. Todos são clicáveis e levam para a tela correspondente.</p>',
      element: '[data-tour="dashboard-stats"]',
      on: 'bottom',
    },
    {
      id: 'bots-pausados',
      title: 'Bots pausados',
      text:
        '<p>Quantas conversas estão em <strong>atendimento humano</strong> — ou seja, com o bot desligado.</p>' +
        '<p>Se esse número estiver alto, é sinal de que há gente esperando resposta. Clicar aqui abre a lista já filtrada.</p>',
      element: '[data-tour="dashboard-bots-pausados"]',
      on: 'bottom',
    },
    {
      id: 'acoes',
      title: 'Ações rápidas',
      text: '<p>Atalhos para o que mais se faz no dia: ver conversas sem resposta, cadastrar cliente, conectar o WhatsApp, cuidar dos lembretes.</p>',
      element: '[data-tour="dashboard-quick-actions"]',
      on: 'top',
    },
    {
      id: 'recentes',
      title: 'Clientes recentes',
      text: '<p>Os últimos tutores cadastrados. Bom para conferir se um cadastro novo entrou direito.</p>',
      element: '[data-tour="dashboard-recent"]',
      on: 'top',
    },
  ],
};

export const tourConversas: TourDef = {
  id: 'chats',
  title: 'Conversas',
  description: 'Os três painéis, os filtros rápidos, a pausa do bot, modelos de mensagens e ficha do cliente.',
  routes: ['/chats'],
  steps: [
    {
      id: 'visao-geral',
      title: 'Como a tela é organizada',
      text:
        '<p>A tela de Conversas é dividida em três painéis redimensionáveis:</p>' +
        '<ul>' +
        '<li><strong>Esquerda:</strong> lista de contatos e filtros rápidos.</li>' +
        '<li><strong>Centro:</strong> mensagens e histórico do WhatsApp.</li>' +
        '<li><strong>Direita:</strong> ficha cadastral do tutor, dados do pet e pendências.</li>' +
        '</ul>' +
        '<p>Arraste as divisórias para ajustar o espaço de cada área.</p>',
      route: '/chats',
    },
    {
      id: 'lista',
      title: 'Lista de conversas',
      text:
        '<p>Ordenada pelas mensagens mais recentes, com contador de não lidas.</p>' +
        '<p>Você pode <strong>fixar conversas</strong> no topo e usar o atalho <code>Ctrl</code>+<code>K</code> para buscar instantaneamente por tutor, telefone ou pet.</p>',
      element: '[data-tour="chat-panel-list"]',
      on: 'right',
      desktopOnly: true,
    },
    {
      id: 'filtros',
      title: 'Filtros rápidos e visões salvas',
      text:
        '<p>Filtre conversas em um clique: <strong>Sem resposta</strong>, <strong>Pausados</strong> em atendimento humano, <strong>Pendências</strong> em aberto, <strong>Status</strong> e <strong>Tags</strong>.</p>' +
        '<p>Em opções, você pode salvar suas combinações favoritas e limpar filtros facilmente.</p>',
      element: '[data-tour="chat-filter-chips"]',
      on: 'bottom',
    },
    {
      id: 'mensagens',
      title: 'Mensagens e pausa da IA',
      text:
        '<p>Acompanhe o diálogo em tempo real. No topo, controle o status do atendimento, busque palavras no histórico, exporte a conversa e <strong>pause o bot</strong> para assumir o atendimento humano com tranquilidade.</p>',
      element: '[data-tour="chat-panel-thread"]',
      on: 'left',
      desktopOnly: true,
    },
    {
      id: 'envio-modelos',
      title: 'Envio, mídias e respostas rápidas',
      text:
        '<p>Envie mensagens com <code>Enter</code>, anexe fotos e PDFs, ou grave áudios de voz diretamente pelo navegador.</p>' +
        '<p>Digite <code>/</code> para abrir os <strong>modelos de mensagem rápidos</strong> e use o agendamento para programar avisos automáticos.</p>',
      element: '[data-tour="chat-panel-thread"]',
      on: 'left',
      desktopOnly: true,
    },
    {
      id: 'cliente',
      title: 'Dados do tutor, pet e pendências',
      text:
        '<p>O painel direito reúne as informações de contato do tutor, os dados dos pets e pendências em aberto.</p>' +
        '<p>Você pode editar o cadastro em tempo real sem sair da conversa.</p>',
      element: '[data-tour="chat-panel-client"]',
      on: 'left',
      desktopOnly: true,
    },
  ],
};

export const tourGrupos: TourDef = {
  id: 'groups',
  title: 'Grupos',
  description: 'A mesma tela de Conversas, mas listando os grupos de WhatsApp.',
  routes: ['/groups'],
  steps: [
    {
      id: 'intro',
      title: 'Grupos de WhatsApp',
      text:
        '<p>Esta tela usa o mesmo formato das Conversas, só que listando os <strong>grupos</strong> em vez das conversas individuais.</p>' +
        '<p>Os filtros de segmento e de status não se aplicam aqui.</p>',
    },
    {
      id: 'lista',
      title: 'Lista de grupos',
      text: '<p>Selecione um grupo para ver o histórico e responder, exatamente como em uma conversa comum.</p>',
      element: '[data-tour="chat-panel-list"]',
      on: 'right',
      desktopOnly: true,
    },
    {
      id: 'mensagens',
      title: 'Mensagens do grupo',
      text: '<p>O envio funciona igual ao das conversas individuais.</p>',
      element: '[data-tour="chat-panel-thread"]',
      on: 'left',
      desktopOnly: true,
    },
  ],
};

export const tourClientes: TourDef = {
  id: 'clients',
  title: 'Clientes',
  description: 'Cadastro de tutores e pets, filtros, tags e pendências.',
  routes: ['/clients'],
  steps: [
    {
      id: 'acoes',
      title: 'Buscar e cadastrar',
      text:
        '<p>A busca procura por nome, telefone ou e-mail.</p>' +
        '<p><strong>Tags</strong> e <strong>Pendências</strong> abrem o cadastro dos tipos — é lá que você cria as etiquetas e os tipos de pendência usados no resto do sistema.</p>',
      element: '[data-tour="clients-actions"]',
      on: 'bottom',
    },
    {
      id: 'filtros',
      title: 'Seis filtros combináveis',
      text:
        '<p>Status, posse de pet, porte, raça, pendências e tag. Eles se somam: dá para achar, por exemplo, todos os tutores ativos de porte grande com pendência em aberto.</p>',
      element: '[data-tour="clients-filters"]',
      on: 'bottom',
    },
    {
      id: 'tabela',
      title: 'A lista',
      text:
        '<p>Clique no cabeçalho de uma coluna para ordenar. Em cada linha há ações de ver detalhes, editar, mandar mensagem e excluir.</p>',
      element: '[data-tour="clients-table"]',
      on: 'top',
    },
    {
      id: 'paginacao',
      title: 'Paginação e limpeza',
      text:
        '<p>A lista vem em páginas de 25, 50 ou 100. O contador mostra o total que bate com os filtros ativos.</p>' +
        '<p>O botão <strong>Limpar Filtros</strong> aparece assim que algum filtro está ligado.</p>',
      element: '[data-tour="clients-pagination"]',
      on: 'top',
    },
  ],
};

export const tourLembretes: TourDef = {
  id: 'reminders',
  title: 'Lembretes',
  description: 'As regras de aviso da véspera e o histórico de envios do n8n.',
  routes: ['/reminders'],
  steps: [
    {
      id: 'stats',
      title: 'Situação dos lembretes',
      text: '<p>Quantas regras estão ativas, qual é o próximo disparo (horário de Brasília), quantos avisos saíram hoje e quantos falharam.</p>',
      element: '[data-tour="reminders-stats"]',
      on: 'bottom',
      timeoutMs: 6000,
    },
    {
      id: 'fluxo',
      title: 'Como funciona',
      text:
        '<p>O n8n roda sozinho todo dia: lê a regra ativa, filtra quem tem serviço marcado para <strong>amanhã</strong> e dispara a mensagem, registrando o resultado sem duplicar.</p>',
      element: '[data-tour="reminders-flow"]',
      on: 'bottom',
    },
    {
      id: 'abas',
      title: 'Regras e histórico',
      text:
        '<p><strong>Regras e horários</strong>: o que é enviado, para qual agenda e a que hora.</p>' +
        '<p><strong>Histórico de envios</strong>: o que já saiu, com o status de cada envio. Atualiza sozinho a cada 30 segundos.</p>',
      element: '[data-tour="reminders-tabs"]',
      on: 'bottom',
    },
    {
      id: 'acoes',
      title: 'Criar, importar e exportar',
      text:
        '<p><strong>Novo lembrete</strong> cria uma regra. Cada regra tem um interruptor para pausar sem precisar apagar.</p>' +
        '<p><strong>Importar</strong> aceita uma planilha da agenda; <strong>Exportar Excel</strong> baixa o que está na tela.</p>',
      element: '[data-tour="reminders-header-actions"]',
      on: 'bottom',
    },
  ],
};

export const tourAgenda: TourDef = {
  id: 'schedule',
  title: 'Agenda',
  description: 'Integração Google Agenda, filtros por profissional, calendário retrátil e lista de atendimentos.',
  routes: ['/schedule'],
  steps: [
    {
      id: 'conexao',
      title: 'Conexão com Google Agenda',
      text:
        '<p>Integração em tempo real com a API do Google Calendar.</p>' +
        '<p>No botão <strong>Gerenciar Agendas</strong> você escolhe quais calendários da clínica ficam visíveis, e em <strong>Sincronizar</strong> você atualiza os eventos instantaneamente.</p>',
      element: '[data-tour="schedule-connect"]',
      on: 'bottom',
      route: '/schedule',
    },
    {
      id: 'calendarios',
      title: 'Filtro por agendas',
      text:
        '<p>Alterne entre <strong>Todas as Agendas</strong> ou filtre por veterinário, sala ou procedimento específico.</p>' +
        '<p>Cada agenda exibe sua cor original do Google e a contagem de agendamentos ativos.</p>',
      element: '[data-tour="schedule-calendars"]',
      on: 'bottom',
    },
    {
      id: 'calendario',
      title: 'Navegação por datas',
      text:
        '<p>Escolha qualquer data no calendário lateral para listar os atendimentos daquele dia.</p>' +
        '<p>O painel é retrátil: use o botão <strong>Recolher Calendário</strong> quando quiser mais espaço para a lista de compromissos.</p>',
      element: '[data-tour="schedule-calendar"]',
      on: 'right',
    },
    {
      id: 'eventos',
      title: 'Atendimentos e compromissos',
      text:
        '<p>Acompanhe os agendamentos nos modos <strong>Cards</strong> ou <strong>Tabela</strong>.</p>' +
        '<p>Use a busca por tutor, pet ou serviço, oculte bloqueios de agenda e clique no compromisso para ver detalhes e abrir no Google Agenda.</p>',
      element: '[data-tour="schedule-events"]',
      on: 'left',
    },
  ],
};
