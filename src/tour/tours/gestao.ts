import type { TourDef } from '../types';

/** Tours das telas de acompanhamento e administração. */

export const tourMetricas: TourDef = {
  id: 'metrics',
  title: 'Métricas',
  description: 'O seletor de período e as quatro abas de indicadores.',
  routes: ['/metrics'],
  papeis: ['admin', 'lider'],
  steps: [
    {
      id: 'periodo',
      title: 'Período e atualização',
      text:
        '<p>O seletor de período vale para <strong>toda</strong> a tela: mudar aqui recalcula todos os gráficos e cartões.</p>' +
        '<p>O botão Atualizar força uma nova consulta ao banco.</p>',
      element: '[data-tour="metrics-header-actions"]',
      on: 'bottom',
    },
    {
      id: 'abas',
      title: 'Quatro recortes',
      text:
        '<ul>' +
        '<li><strong>Clientes:</strong> crescimento da base, pets e serviços.</li>' +
        '<li><strong>Chats & Bot:</strong> volume de mensagens, horários de pico e desempenho do bot.</li>' +
        '<li><strong>Atendimentos:</strong> produção da equipe, tempo médio e uso de tags.</li>' +
        '<li><strong>Atividade:</strong> tempo de uso do painel por pessoa.</li>' +
        '</ul>' +
        '<p>Os dados de cada aba só são buscados quando você a abre — por isso a primeira troca demora um instante.</p>',
      element: '[data-tour="metrics-tabs"]',
      on: 'bottom',
    },
    {
      id: 'atividade',
      title: 'Aba Atividade',
      text:
        '<p>Mede o tempo com o painel <strong>aberto e em primeiro plano</strong>. Não é ponto eletrônico nem mede produtividade — serve para entender o uso da ferramenta.</p>',
      element: '[data-tour="metrics-tab-atividade"]',
      on: 'bottom',
    },
  ],
};

export const tourAtendentes: TourDef = {
  id: 'attendants',
  title: 'Atendentes e Departamentos',
  description: 'A equipe, os departamentos e os atendimentos em curso.',
  routes: ['/attendants'],
  papeis: ['admin', 'lider'],
  steps: [
    {
      id: 'stats',
      title: 'Resumo da equipe',
      text: '<p>Quantas pessoas ativas, quantos departamentos, quantos atendimentos estão rolando agora e quantas transferências houve recentemente.</p>',
      element: '[data-tour="attendants-stats"]',
      on: 'bottom',
    },
    {
      id: 'equipe',
      title: 'Status ao vivo',
      text: '<p>Quem está disponível, em pausa, almoço ou reunião neste momento — o mesmo status que cada pessoa escolhe na barra superior.</p>',
      element: '[data-tour="attendants-status-panel"]',
      on: 'bottom',
    },
    {
      id: 'departamentos',
      title: 'Departamentos',
      text:
        '<p>Cada cartão é um departamento com a sua equipe. Dá para editar ou remover uma pessoa direto na linha.</p>' +
        '<p>O botão <strong>Departamentos</strong>, no topo, cria e renomeia os departamentos.</p>',
      element: '[data-tour="attendants-departments"]',
      on: 'top',
    },
    {
      id: 'acoes',
      title: 'Cadastrar e organizar',
      text: '<p><strong>Novo atendente</strong> cadastra alguém na equipe. Cadastrar aqui é o que permite vincular a pessoa a um usuário do painel, na tela de Usuários.</p>',
      element: '[data-tour="attendants-header-actions"]',
      on: 'bottom',
    },
  ],
};

export const tourPesquisas: TourDef = {
  id: 'surveys',
  title: 'Pesquisas de Satisfação',
  description: 'Controle de envios, resultados e a integração com o Google Forms.',
  routes: ['/satisfaction-surveys'],
  papeis: ['admin', 'lider'],
  steps: [
    {
      id: 'stats',
      title: 'Como está a pesquisa',
      text: '<p>Quantos tutores estão sob controle, quantos já receberam, quantos responderam (com a taxa de conversão) e a nota média.</p>',
      element: '[data-tour="surveys-stats"]',
      on: 'bottom',
      timeoutMs: 6000,
    },
    {
      id: 'abas',
      title: 'Três abas',
      text:
        '<ul>' +
        '<li><strong>Controle de envios:</strong> quem entrou na campanha e em que pé está.</li>' +
        '<li><strong>Resultados:</strong> NPS, distribuição das notas e comentários.</li>' +
        '<li><strong>Integração:</strong> as campanhas e o endpoint do Google Forms.</li>' +
        '</ul>',
      element: '[data-tour="surveys-tabs"]',
      on: 'bottom',
    },
    {
      id: 'busca',
      title: 'Encontrar um tutor',
      text: '<p>Busca por nome, telefone ou e-mail. O mesmo telefone não entra duas vezes na mesma campanha — a duplicidade é barrada no cadastro.</p>',
      element: '#survey-search',
      on: 'bottom',
    },
    {
      id: 'acoes',
      title: 'Campanhas e planilhas',
      text:
        '<p><strong>Nova campanha</strong> cria uma pesquisa. <strong>Importar</strong> traz as respostas do Google Forms; <strong>Exportar Excel</strong> leva os dados para fora.</p>',
      element: '[data-tour="surveys-header-actions"]',
      on: 'bottom',
    },
  ],
};

export const tourUsuarios: TourDef = {
  id: 'users',
  title: 'Usuários e auditoria',
  description: 'Liberação de contas, papéis e o histórico de ações.',
  routes: ['/users'],
  papeis: ['admin'],
  steps: [
    {
      id: 'abas',
      title: 'Usuários e Auditoria',
      text:
        '<p><strong>Usuários</strong>: quem tem acesso ao painel e com qual papel.</p>' +
        '<p><strong>Auditoria</strong>: o histórico do que foi feito, por quem e quando.</p>',
      element: '[data-tour="users-tabs"]',
      on: 'bottom',
    },
    {
      id: 'liberacao',
      title: 'Liberar uma conta nova',
      text:
        '<p>Quem cria conta entra como <strong>Aguardando liberação</strong> e não consegue usar o painel até um administrador clicar em <strong>Liberar</strong>.</p>' +
        '<p>Na mesma linha você define o papel e vincula a pessoa a um atendente cadastrado.</p>',
      element: '[data-tour="users-list"]',
      on: 'top',
    },
    {
      id: 'papeis',
      title: 'O que cada papel vê',
      text:
        '<ul>' +
        '<li><strong>Atendente:</strong> Início, Conversas, Grupos, Clientes, Lembretes e Agenda.</li>' +
        '<li><strong>Líder:</strong> tudo isso mais Métricas, Atendentes e Pesquisas.</li>' +
        '<li><strong>Administrador:</strong> tudo, incluindo Conexão WhatsApp, Conhecimento, Configurações e esta tela.</li>' +
        '</ul>' +
        '<p>Esconder um menu é conveniência de interface; quem protege os dados de fato é a RLS do banco.</p>',
    },
    {
      id: 'auditoria',
      title: 'Filtros da auditoria',
      text: '<p>Na aba Auditoria dá para filtrar por ação, por atendente e por intervalo de datas. Útil para entender o que mudou em um dia específico.</p>',
      element: '#auditoria-de',
      on: 'bottom',
    },
  ],
};

export const tourWhatsApp: TourDef = {
  id: 'evolution',
  title: 'Conexão WhatsApp',
  description: 'Consultar o estado da instância UAZ usada pelo atendimento.',
  routes: ['/evolution'],
  papeis: ['admin'],
  steps: [
    {
      id: 'intro',
      title: 'Conexão gerenciada',
      text:
        '<p>O painel consulta a instância UAZ que já foi configurada com segurança no Supabase.</p>' +
        '<p>Para trocar ou parear o número, faça a ação no painel da UAZ e volte aqui para atualizar o status. Tokens e webhook não aparecem nesta tela.</p>',
      element: '[data-tour="evolution-card"]',
      on: 'bottom',
    },
  ],
};

export const tourConfiguracoes: TourDef = {
  id: 'configuration',
  title: 'Configurações',
  description: 'Visão das integrações protegidas do sistema.',
  routes: ['/configuration'],
  papeis: ['admin'],
  steps: [
    {
      id: 'intro',
      title: 'Integrações do sistema',
      text:
        '<p>As credenciais, URLs de provedores e secrets ficam no Supabase, não neste navegador.</p>' +
        '<p>Aqui você acompanha os módulos e acessa as configurações operacionais, como regras de agenda.</p>',
      element: '[data-tour="config-groups"]',
      on: 'top',
    },
  ],
};

export const tourConhecimento: TourDef = {
  id: 'knowledge',
  title: 'Conhecimento',
  description: 'A base de documentos que o bot consulta para responder.',
  routes: ['/knowledge'],
  papeis: ['admin'],
  steps: [
    {
      id: 'intro',
      title: 'A memória do bot',
      text: '<p>Os documentos enviados aqui são o que a inteligência artificial consulta para responder aos tutores: tabela de preços, horários, políticas da clínica.</p>',
      element: '[data-tour="knowledge-toolbar"]',
      on: 'bottom',
    },
    {
      id: 'documentos',
      title: 'Os documentos',
      text:
        '<p>Cada cartão é um documento indexado. Remover um documento faz o bot deixar de saber aquele conteúdo na hora.</p>' +
        '<p>O botão de limpar tudo apaga a base inteira — não tem desfazer.</p>',
      element: '[data-tour="knowledge-grid"]',
      on: 'top',
    },
  ],
};
