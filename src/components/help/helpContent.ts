export interface HelpGuideModule {
  id: string;
  title: string;
  category: 'operacao' | 'atendimento' | 'gestao' | 'config';
  icon: string;
  summary: string;
  steps: { title: string; description: string }[];
  tips: string[];
  route?: string;
  tourId?: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface ShortcutItem {
  keys: string[];
  description: string;
  context: string;
}

export const SHORTCUTS: ShortcutItem[] = [
  { keys: ['Ctrl', 'K'], description: 'Buscar conversas e clientes', context: 'Conversas e Grupos' },
  { keys: ['Ctrl', 'B'], description: 'Recolher ou expandir a barra lateral', context: 'Geral' },
  { keys: ['←', '→'], description: 'Avançar e voltar entre os passos do tour', context: 'Tours Guiados' },
  { keys: ['Esc'], description: 'Fechar tour, modal ou janela aberta', context: 'Geral' },
  { keys: ['Enter'], description: 'Enviar mensagem no chat', context: 'Conversas' },
  { keys: ['Shift', 'Enter'], description: 'Adicionar nova linha no campo de mensagem', context: 'Conversas' },
];

export const HELP_MODULES: HelpGuideModule[] = [
  {
    id: 'fila',
    title: 'Fila de Atendimento & Recepção',
    category: 'operacao',
    icon: 'Users',
    summary: 'Gerencie o fluxo de chegada dos tutores, emissão de senhas, triagem clínica e chamada nos consultórios.',
    route: '/queue',
    tourId: 'queue',
    steps: [
      {
        title: '1. Emissão de Senha na Recepção',
        description: 'Ao chegar um tutor, clique em "Emitir Senha". Selecione o tipo de atendimento (Consulta, Vacina, Exame, Emergência) e a prioridade (Normal, Preferencial ou Emergência).',
      },
      {
        title: '2. Triagem e Classificação de Risco',
        description: 'A equipe de enfermagem ou recepção pode clicar no card para registrar dados vitais básicos, queixa principal e nível de gravidade.',
      },
      {
        title: '3. Encaminhamento para Consultório',
        description: 'Mova o card para a coluna "Aguardando Atendimento" e vincule ao consultório e veterinário responsável.',
      },
      {
        title: '4. Chamada na TV da Sala de Espera',
        description: 'O botão "Chamar" reproduz o sinal sonoro e projeta na tela da TV (/tv) o nome do pet, tutor e número da sala.',
      },
    ],
    tips: [
      'Deixe a rota /tv aberta em tela cheia na televisão da sala de espera.',
      'Veterinários podem utilizar a rota /chamar diretamente no computador do consultório para chamadas rápidas.',
    ],
  },
  {
    id: 'conversas',
    title: 'Conversas no WhatsApp',
    category: 'atendimento',
    icon: 'MessageSquare',
    summary: 'Centralize todos os diálogos de WhatsApp, pause ou retome a IA, use modelos rápidos (/), envie áudios e consulte dados do tutor.',
    route: '/chats',
    tourId: 'chats',
    steps: [
      {
        title: '1. Localizar e Filtrar Conversas',
        description: 'Use a busca (Ctrl+K) ou os chips de filtro rápido (Sem resposta, Pausados, Pendências, Status e Tags) para organizar o dia.',
      },
      {
        title: '2. Pausar ou Ativar a IA',
        description: 'Ao responder manualmente, pause o bot para que a IA não responda em paralelo. Quando o atendimento humano terminar, reative o bot.',
      },
      {
        title: '3. Envio de Mídias e Modelos Rápidos',
        description: 'Envie PDFs, imagens e áudios de voz gravados direto no navegador. Digite uma barra (/) para abrir os modelos de mensagens rápidas.',
      },
      {
        title: '4. Ficha Cadastral do Tutor e Pet',
        description: 'No lado direito, visualize e edite telefone, e-mail, pets cadastrados e pendências financeiras ou cadastrais sem sair do chat.',
      },
    ],
    tips: [
      'Fixe conversas prioritárias no topo clicando no ícone de alfinete.',
      'Use as Visões Salvas para guardar combinações de filtros que você usa sempre.',
      'Programe lembretes ou retornos com o recurso de mensagens agendadas.',
    ],
  },
  {
    id: 'lembretes',
    title: 'Lembretes Automáticos',
    category: 'operacao',
    icon: 'Bell',
    summary: 'Avisos automáticos enviados no dia anterior para tutores com consultas, vacinas ou exames agendados.',
    route: '/reminders',
    tourId: 'reminders',
    steps: [
      {
        title: '1. Criar Regras de Disparo',
        description: 'Defina o horário diário de envio (ex: 18h) e para quais categorias de serviços os lembretes devem ser disparados.',
      },
      {
        title: '2. Importação de Agenda',
        description: 'Importe planilhas de agendamentos para abastecer os envios da semana.',
      },
      {
        title: '3. Acompanhamento de Disparos',
        description: 'Acompanhe na aba Histórico quais mensagens foram entregues, respondidas ou falharam.',
      },
    ],
    tips: [
      'O n8n processa os disparos automaticamente sem duplicar notificações para o mesmo cliente no mesmo dia.',
    ],
  },
  {
    id: 'clientes',
    title: 'Gestão de Clientes & Pets',
    category: 'operacao',
    icon: 'UserCheck',
    summary: 'Cadastro completo de tutores, múltiplos pets, controle de pendências e etiquetas personalizadas.',
    route: '/clients',
    tourId: 'clients',
    steps: [
      {
        title: '1. Cadastrar Tutor e Pets',
        description: 'Registre nome, CPF, WhatsApp, endereço e associe todos os pets com porte, raça, espécie e idade.',
      },
      {
        title: '2. Aplicação de Tags e Pendências',
        description: 'Atribua etiquetas como "Cliente VIP", "Castração Pendente" ou "Vacina Atrasada" para segmentação.',
      },
      {
        title: '3. Busca Avançada',
        description: 'Combine múltiplos filtros para encontrar clientes específicos em segundos.',
      },
    ],
    tips: [
      'O cadastro de tags é compartilhado com os filtros de conversas do WhatsApp.',
    ],
  },
  {
    id: 'agenda',
    title: 'Agenda & Atendimentos',
    category: 'operacao',
    icon: 'Calendar',
    summary: 'Sincronização em tempo real com o Google Calendar, filtros por veterinários ou salas e visualização retrátil.',
    route: '/schedule',
    tourId: 'schedule',
    steps: [
      {
        title: '1. Conexão e Sincronização Google',
        description: 'Conecte sua conta do Google Agenda, sincronize eventos em tempo real e escolha quais calendários da clínica ficam ativos.',
      },
      {
        title: '2. Filtrar por Agendas e Profissionais',
        description: 'Filtre compromissos por veterinário, sala ou procedimento específico utilizando as cores oficiais do Google.',
      },
      {
        title: '3. Navegação por Datas',
        description: 'Selecione qualquer dia no calendário lateral para listar compromissos. O painel é retrátil para dar mais espaço à lista.',
      },
      {
        title: '4. Visualização em Linha do Tempo e Tabela',
        description: 'Alterne entre visualização em cards ou tabela, filtre bloqueios de agenda e abra os detalhes com link direto no Google.',
      },
    ],
    tips: [
      'Use o filtro "Ocultar bloqueios" para visualizar apenas agendamentos reais de pacientes.',
      'Clique no botão Imprimir para gerar a programação do dia para a recepção ou equipe clínica.',
    ],
  },
  {
    id: 'metricas',
    title: 'Métricas & Desempenho',
    category: 'gestao',
    icon: 'BarChart3',
    summary: 'Indicadores de volume de mensagens, tempo médio de resposta, conversão de IA e produção da equipe.',
    route: '/metrics',
    tourId: 'metrics',
    steps: [
      {
        title: '1. Selecionar Período',
        description: 'Escolha entre Hoje, Últimos 7 dias, Mês Atual ou Período Customizado.',
      },
      {
        title: '2. Analisar Eficiência da IA',
        description: 'Veja quantas conversas foram resolvidas 100% pelo bot sem intervenção humana.',
      },
      {
        title: '3. Produção dos Atendentes',
        description: 'Monitore mensagens enviadas por atendente e tempo médio de espera.',
      },
    ],
    tips: [
      'A aba Atividade mede o tempo que cada atendente permaneceu com o painel em primeiro plano.',
    ],
  },
  {
    id: 'ia-conhecimento',
    title: 'IA, Prompt & Base de Conhecimento',
    category: 'config',
    icon: 'Sparkles',
    summary: 'Alimente a inteligência artificial com tabelas de preços, horários de funcionamento e regras da clínica.',
    route: '/knowledge',
    tourId: 'knowledge',
    steps: [
      {
        title: '1. Enviar Documentos (RAG)',
        description: 'Em Conhecimento (/knowledge), faça upload de manuais, tabela de valores e políticas em PDF/TXT.',
      },
      {
        title: '2. Ajustar Instruções (Meu Prompt)',
        description: 'Em Meu Prompt (/my-prompt), defina a personalidade, proibições e tom de voz da cvi.',
      },
      {
        title: '3. Histórico de Versões',
        description: 'Todas as alterações de prompt são versionadas, permitindo restaurar versões anteriores.',
      },
    ],
    tips: [
      'Evite enviar dados sensíveis ou senhas nos documentos da base de conhecimento.',
    ],
  },
];

export const FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'WhatsApp & Bot',
    question: 'Como pausar a IA quando eu for conversar com o tutor?',
    answer: 'Na tela de Conversas (/chats), abra o diálogo desejado e clique no botão "Pausar Bot" no topo da área de mensagens. Isso garante que a IA não envie respostas automáticas enquanto você estiver interagindo.',
  },
  {
    id: 'faq-2',
    category: 'WhatsApp & Bot',
    question: 'O que fazer se o WhatsApp for desconectado?',
    answer: 'Acesse Conexão WhatsApp (/evolution) para consultar o status da instância UAZ. Para trocar ou parear o número, use o painel da UAZ e depois atualize o status no sistema.',
  },
  {
    id: 'faq-3',
    category: 'Fila de Atendimento',
    question: 'Como funciona o painel de chamada na TV da recepção?',
    answer: 'Basta abrir a rota "/tv" em qualquer computador ou Smart TV conectado à televisão da sala de espera. Quando um atendente ou veterinário clica em "Chamar" na fila ou no consultório, o áudio toca e a senha é exibida na tela.',
  },
  {
    id: 'faq-4',
    category: 'Lembretes',
    question: 'Os lembretes podem ser disparados duas vezes para o mesmo cliente?',
    answer: 'Não. O sistema possui controle de idempotência e verifica no banco de dados se o lembrete daquela data/serviço já foi registrado antes de efetuar o envio.',
  },
  {
    id: 'faq-5',
    category: 'Acessos & Permissões',
    question: 'Por que um novo atendente não consegue ver o menu de Métricas ou Configurações?',
    answer: 'O sistema utiliza controle de papéis (Atendente, Líder e Administrador). As telas de gestão e configurações são restritas por perfil para segurança dos dados.',
  },
  {
    id: 'faq-6',
    category: 'Tours & Ajuda',
    question: 'Como reiniciar um tour guiado que já terminei?',
    answer: 'Abra o botão de Ajuda no topo direito, acesse a aba "Tours Guiados" e clique no tour desejado. Você pode refazer qualquer tour quantas vezes quiser.',
  },
];
