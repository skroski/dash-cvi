import {
  type AtalhoRotaCopiloto,
  type ContextoOperacionalSnapshot,
  MODELO_COPILOTO_FIXO,
  type ModuloManualSistema,
  type SugestaoCopiloto,
} from '@/types/copilotoOperacional';

export { MODELO_COPILOTO_FIXO };

export const ROTAS_INTERNAS_PERMITIDAS: Record<string, string> = {
  '/dashboard': 'Início',
  '/chats': 'Conversas & Pipelines',
  '/groups': 'Grupos WhatsApp',
  '/clients': 'Clientes & CRM',
  '/reminders': 'Lembretes',
  '/schedule': 'Calendário & Agenda',
  '/prontuario': 'Prontuário IA',
  '/receituario': 'Receituário IA',
  '/web-chat': 'Chat Web',
  '/queue': 'Fila Presencial',
  '/metrics': 'Métricas',
  '/attendants': 'Atendentes',
  '/satisfaction-surveys': 'Pesquisas de Satisfação',
  '/uazapi': 'Conexão WhatsApp',
  '/knowledge': 'Base de Conhecimento (RAG)',
  '/my-prompt': 'Meu Prompt',
  '/agenda-configuracao': 'Regras da Agenda',
  '/atendimento-configuracao': 'Config. do Atendimento',
  '/configuration': 'Configurações',
  '/users': 'Usuários e Auditoria',
};

export const SNAPSHOT_OPERACIONAL_PADRAO: ContextoOperacionalSnapshot = {
  atualizado_em: new Date().toISOString(),
  modelo_copiloto: MODELO_COPILOTO_FIXO,
  empresa: {
    nome_empresa: 'Clínica VetBots',
    nome_assistente: 'Luna',
    telefone_contato: '',
    endereco: '',
    fuso_horario: 'America/Sao_Paulo',
    planos_aceitos: [],
  },
  clientes: {
    total_clientes: 0,
    total_pets: 0,
    novos_clientes_mes: 0,
    ultimos_clientes: [],
  },
  atendimento: {
    conversas_abertas: 0,
    conversas_hoje: 0,
    pausadas_humano: 0,
    atendentes_ativos: 0,
  },
  agenda: {
    agendamentos_hoje: 0,
    agendamentos_proximos_7d: 0,
    especialidades_ativas: [],
    profissionais_ativos: [],
    proximos_agendamentos: [],
  },
  lembretes: {
    agendados: 0,
    enviados_hoje: 0,
    confirmados: 0,
    cancelados: 0,
  },
  pipelines: {
    total_pipelines: 0,
    total_cards: 0,
    cards_urgentes: 0,
    valor_aberto: 0,
  },
  fila_presencial: {
    aguardando: 0,
    em_atendimento: 0,
    atendidos_hoje: 0,
  },
  prompt_ia: {
    versao_ativa: 0,
    regras_ativas: 0,
    total_regras: 0,
  },
  satisfacao: {
    total_avaliacoes: 0,
    media_nota: 0,
  },
};

export const MANUAL_MODULOS_SISTEMA: ModuloManualSistema[] = [
  {
    url: '/dashboard',
    titulo: 'Início (Visão Geral)',
    resumo:
      'Painel executivo inicial com resumo de clientes, pets cadastrados, novos tutores no mês, gráficos de atividade e atalhos rápidos para a operação.',
    comoUsar: [
      'Acompanhe nos cards superiores o total de tutores, pets e o crescimento do mês.',
      'Veja a lista dos últimos clientes cadastrados pela recepção ou pela assistente virtual.',
      'Use os botões de ação rápida para saltar para Conversas, Agenda ou Clientes.',
    ],
    dicasOperacionais: [
      'Confira este painel no início do turno para validar o volume de atendimentos do dia.',
    ],
    palavrasChave: ['inicio', 'dashboard', 'home', 'resumo', 'visao geral', 'indicadores'],
  },
  {
    url: '/chats',
    titulo: 'Conversas & Atendimento WhatsApp',
    resumo:
      'Central de atendimento omnichannel no WhatsApp com pausa inteligente da IA, filtros por departamento/status, envio de áudios/arquivos e visão em Kanban (Pipelines CRM).',
    comoUsar: [
      'Alterne entre a "Lista de Conversas" e os "Pipelines (Kanban)" no topo da tela.',
      'Clique em uma conversa para ler o histórico, enviar mensagens, áudios ou anexos.',
      'Use o botão de Pausar IA quando um atendente humano assumir o caso; a IA retoma automaticamente após o tempo configurado ou quando você reativar.',
      'Vincule o contato diretamente a um card do Pipeline CRM para acompanhar retorno, orçamento ou pós-consulta.',
    ],
    dicasOperacionais: [
      'Mantenha o seletor de Atendente Ativo no cabeçalho sempre atualizado para registrar quem respondeu cada tutor.',
    ],
    palavrasChave: ['conversas', 'chat', 'whatsapp', 'atendimento', 'mensagens', 'pausar ia', 'humano', 'audio'],
  },
  {
    url: '/clients',
    titulo: 'Clientes, Pets & Pipelines CRM',
    resumo:
      'Base completa de tutores e pets da clínica, com busca instantânea, importação/exportação em planilha e quadro Kanban de Pipelines (Atendimento, Leads, Marketing e Pós-Venda).',
    comoUsar: [
      'Use a aba "Lista de Clientes" para pesquisar por nome do tutor, nome do pet ou telefone.',
      'Use a aba "Pipelines (Kanban)" para arrastar cards entre colunas, checar orientações de cada etapa, preencher checklists e monitorar alertas de SLA.',
      'Clique em "Novo Cliente" para cadastrar manualmente ou em "Exportar/Importar" para atualizar dados em lote.',
    ],
    dicasOperacionais: [
      'Nos Pipelines CRM, cada coluna possui um guia "Como conduzir esta etapa" para padronizar o atendimento da recepção.',
    ],
    palavrasChave: ['clientes', 'tutores', 'pets', 'cadastro', 'crm', 'pipeline', 'kanban', 'leads', 'marketing', 'pos-venda', 'funil'],
  },
  {
    url: '/schedule',
    titulo: 'Calendário & Agenda Clínica',
    resumo:
      'Agenda médica integrada com sincronização bidirecional ao Google Calendar, organizada por especialista, tipo de serviço (consulta, vacina, exame, cardiologia, ortopedia) e status.',
    comoUsar: [
      'Filtre a visualização por dia, semana, mês ou por profissional/especialidade.',
      'Clique em um horário livre ou em "Novo Agendamento" para marcar consulta, vacina ou retorno.',
      'Agendamentos feitos pela assistente virtual no WhatsApp aparecem identificados automaticamente.',
    ],
    dicasOperacionais: [
      'Para alterar durações de consulta, horários de funcionamento por médico ou bloqueios de agenda, acesse Regras da Agenda (/agenda-configuracao).',
    ],
    palavrasChave: ['agenda', 'calendario', 'consulta', 'agendamento', 'horario', 'marcar', 'reagendar', 'google calendar', 'especialidades'],
  },
  {
    url: '/reminders',
    titulo: 'Lembretes Automáticos (Vacinas e Retornos)',
    resumo:
      'Motor de disparo programado no WhatsApp para lembretes de consultas, revacinação anual e retornos clínicos com botões interativos de Confirmar e Cancelar.',
    comoUsar: [
      'Consulte a fila de lembretes com status AGENDADO, ENVIADO, CONFIRMADO ou CANCELADO.',
      'Crie regras personalizadas de antecedência (ex.: 24h antes da consulta ou 365 dias após vacina).',
      'Quando o tutor clica em Confirmar ou Cancelar no WhatsApp, o status atualiza sozinho no painel.',
    ],
    dicasOperacionais: [
      'Verifique diariamente os lembretes marcados como Cancelado para oferecer reagendamento ativo ao tutor.',
    ],
    palavrasChave: ['lembretes', 'vacina', 'vacinacao', 'retorno', 'confirmar', 'cancelar', 'disparo', 'notificacao'],
  },
  {
    url: '/prontuario',
    titulo: 'Prontuário Veterinário com IA',
    resumo:
      'Gravação contínua da consulta veterinária em áudio, transcrição com IA, extração fiel (anamnese, exame físico, suspeita diagnóstica, conduta) sem inventar dados e assinatura digital SHA-256.',
    comoUsar: [
      'Selecione ou informe o paciente, confirme o consentimento LGPD e inicie a gravação da consulta.',
      'Ao finalizar o áudio, a IA estrutura os campos clínicos mostrando o trecho exato da fala que originou cada informação.',
      'Revise os campos e clique em Confirmar Prontuário para gravar com hash de integridade SHA-256.',
    ],
    dicasOperacionais: [
      'A IA segue a diretriz "nunca inventar": qualquer parâmetro físico não citado em voz fica em branco para preenchimento humano.',
    ],
    palavrasChave: ['prontuario', 'ficha clinica', 'anamnese', 'exame fisico', 'gravacao', 'transcricao', 'consulta por voz', 'lgpd'],
  },
  {
    url: '/receituario',
    titulo: 'Receituário Inteligente & Bulário com IA',
    resumo:
      'Prescrição veterinária em 3 passos com calculadora posológica determinística (mg/kg), bloqueio estrito de fármacos perigosos por espécie/raça (Hard Rules) e emissão de PDF A4 com QR Code.',
    comoUsar: [
      'Informe espécie (cão, gato, silvestre), peso em kg e raça (detecta automaticamente mutação MDR1 em Collie, Pastor de Shetland, Border Collie, etc.).',
      'Adicione fármacos do bulário ou descreva a conduta para o copiloto posológico calcular doses e frações de comprimido.',
      'Gere o PDF A4 assinado com código público de validação e QR Code verificável em /validar-receita.',
    ],
    dicasOperacionais: [
      'O motor bloqueia automaticamente Paracetamol e Permetrina em gatos e Ivermectina em raças MDR1.',
    ],
    palavrasChave: ['receituario', 'receita', 'prescricao', 'bulario', 'posologia', 'dose', 'calculo', 'medicamento', 'farmaco', 'mdr1', 'pdf'],
  },
  {
    url: '/queue',
    titulo: 'Fila Presencial, Recepção & Painel de TV',
    resumo:
      'Sistema completo de senhas para recepção e triagem, totem touch de autoatendimento (/totem), chamador por consultório (/chamar) e telão de TV com voz e mídia (/tv).',
    comoUsar: [
      'Emita senhas na recepção ou pelo Totem (/totem) escolhendo o serviço e a prioridade.',
      'Chame o próximo tutor selecionando o consultório; o telão (/tv) anuncia com sinal sonoro e voz.',
      'Acompanhe o tempo médio de espera e o histórico de senhas atendidas no dia.',
    ],
    dicasOperacionais: [
      'Você pode personalizar cores, logotipo, salas de atendimento e vídeos da TV nas configurações da fila.',
    ],
    palavrasChave: ['fila', 'presencial', 'senha', 'tv', 'totem', 'recepcao', 'triagem', 'chamar', 'consultorio'],
  },
  {
    url: '/my-prompt',
    titulo: 'Meu Prompt (Regras Modulares da Assistente IA)',
    resumo:
      'Editor modular de regras da assistente virtual com categorias, variáveis dinâmicas {{...}}, prévia em tempo real, histórico de versões estilo Git (Diff) e rollback imediato.',
    comoUsar: [
      'Ative, desative, crie ou edite regras nas categorias: Comportamento, Agendamento, Serviços, Informações, Emergência, Restrições e Personalizadas.',
      'Use variáveis dinâmicas como {{nome_empresa}}, {{endereco}}, {{horarios_semana}} e {{catalogo_servicos}} na aba Variáveis.',
      'Confira o resultado na aba "Prévia Compilada" e clique em "Salvar Nova Versão" para publicar em produção.',
      'Na aba "Histórico & Diff", compare qualquer versão anterior e restaure com 1 clique se necessário.',
    ],
    dicasOperacionais: [
      'Apenas após clicar em "Salvar Nova Versão" as alterações nas regras passam a valer para o atendimento no WhatsApp.',
    ],
    palavrasChave: ['meu prompt', 'prompt', 'regras', 'assistente', 'luna', 'bot', 'variaveis', 'versao', 'rollback', 'diff'],
  },
  {
    url: '/knowledge',
    titulo: 'Base de Conhecimento (RAG)',
    resumo:
      'Repositório de documentos, protocolos e perguntas frequentes indexados vetorialmente (pgvector) para consulta semântica pela assistente virtual.',
    comoUsar: [
      'Adicione documentos com orientações de preparo de exames, convênios, procedimentos e políticas da clínica.',
      'Mantenha textos objetivos e bem divididos por assunto para máxima precisão na busca semântica.',
    ],
    dicasOperacionais: [
      'Use o Meu Prompt para regras obrigatórias de comportamento e a Base RAG para conteúdos extensos ou tabelas de preparo.',
    ],
    palavrasChave: ['rag', 'base de conhecimento', 'documentos', 'conhecimento', 'arquivos', 'memoria', 'embeddings'],
  },
  {
    url: '/uazapi',
    titulo: 'Conexão WhatsApp (QR Code / Pair Code)',
    resumo:
      'Painel de conexão e diagnóstico da instância do WhatsApp da clínica via leitura de QR Code ou código de pareamento, com verificação em tempo real.',
    comoUsar: [
      'Verifique se o status aparece como Conectado com o número de telefone da clínica.',
      'Caso precise reconectar, clique em Gerar QR Code e escaneie pelo WhatsApp em Aparelhos Conectados.',
    ],
    dicasOperacionais: [
      'Se o WhatsApp desconectar por troca de aparelho, basta gerar novo QR Code nesta tela sem perder conversas nem configurações.',
    ],
    palavrasChave: ['uazapi', 'qrcode', 'qr code', 'conexao', 'conectar whatsapp', 'instancia', 'parear'],
  },
  {
    url: '/agenda-configuracao',
    titulo: 'Regras da Agenda',
    resumo:
      'Configuração de médicos-veterinários, calendários do Google, especialidades, durações de consulta/retorno e janelas de atendimento.',
    comoUsar: [
      'Cadastre ou edite profissionais e vincule às respectivas agendas.',
      'Defina a duração padrão de cada especialidade, intervalo entre slots e campos exigidos no agendamento.',
    ],
    dicasOperacionais: [
      'Qualquer alteração aqui atualiza imediatamente as variáveis {{catalogo_servicos}} e {{horarios_agenda}} usadas pela assistente.',
    ],
    palavrasChave: ['regras da agenda', 'configurar agenda', 'profissionais', 'especialidades', 'duracao', 'slots'],
  },
  {
    url: '/atendimento-configuracao',
    titulo: 'Configuração do Atendimento',
    resumo:
      'Cadastro central dos dados da clínica: nome da empresa, nome da assistente virtual, endereço, telefone, chave PIX, planos de saúde aceitos e horários de funcionamento.',
    comoUsar: [
      'Atualize endereço, PIX, planos aceitos ou horários de expediente comercial.',
      'Configure o aviso automático fora de horário e os destinatários de notificações da equipe.',
    ],
    dicasOperacionais: [
      'Ao alterar dados nesta tela, você não precisa editar o texto do Meu Prompt — as variáveis dinâmicas já puxam os novos valores automaticamente.',
    ],
    palavrasChave: ['configuracao do atendimento', 'dados da clinica', 'endereco', 'pix', 'planos', 'horario de funcionamento', 'fora de horario'],
  },
  {
    url: '/metrics',
    titulo: 'Métricas e Indicadores',
    resumo:
      'Painel analítico de volume de mensagens, atendimentos por período, taxa de resolução da IA e produtividade da equipe.',
    comoUsar: [
      'Selecione o período desejado (hoje, 7 dias, 30 dias) para comparar a evolução de atendimentos.',
      'Analise os horários de pico para dimensionar sua equipe de recepção.',
    ],
    dicasOperacionais: [
      'Compare o total de conversas resolvidas pela IA com as transferidas para humano para identificar novas regras úteis no Meu Prompt.',
    ],
    palavrasChave: ['metricas', 'relatorios', 'estatisticas', 'graficos', 'desempenho', 'volume'],
  },
  {
    url: '/satisfaction-surveys',
    titulo: 'Pesquisas de Satisfação (NPS)',
    resumo:
      'Monitoramento das avaliações de satisfação enviadas pelos tutores após o atendimento ou consulta.',
    comoUsar: [
      'Acompanhe a nota média da clínica e leia os comentários individuais dos tutores.',
      'Identifique rapidamente avaliações baixas para realizar contato ativo de pós-venda.',
    ],
    dicasOperacionais: [
      'Você pode criar um card no Pipeline de Pós-Venda (/clients) para tratar feedbacks que exigem acompanhamento.',
    ],
    palavrasChave: ['satisfacao', 'pesquisa', 'nps', 'avaliacao', 'nota', 'feedback'],
  },
];

function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizarSnapshotOperacional(raw: unknown): ContextoOperacionalSnapshot {
  if (!raw || typeof raw !== 'object') {
    return { ...SNAPSHOT_OPERACIONAL_PADRAO, atualizado_em: new Date().toISOString() };
  }
  const r = raw as Record<string, unknown>;
  const emp = (r.empresa as Record<string, unknown>) || {};
  const cli = (r.clientes as Record<string, unknown>) || {};
  const ate = (r.atendimento as Record<string, unknown>) || {};
  const age = (r.agenda as Record<string, unknown>) || {};
  const lem = (r.lembretes as Record<string, unknown>) || {};
  const pip = (r.pipelines as Record<string, unknown>) || {};
  const fil = (r.fila_presencial as Record<string, unknown>) || {};
  const pro = (r.prompt_ia as Record<string, unknown>) || {};
  const sat = (r.satisfacao as Record<string, unknown>) || {};

  return {
    atualizado_em: typeof r.atualizado_em === 'string' ? r.atualizado_em : new Date().toISOString(),
    modelo_copiloto: MODELO_COPILOTO_FIXO,
    empresa: {
      nome_empresa: String(emp.nome_empresa || 'Clínica VetBots'),
      nome_assistente: String(emp.nome_assistente || 'Luna'),
      telefone_contato: String(emp.telefone_contato || ''),
      endereco: String(emp.endereco || ''),
      fuso_horario: String(emp.fuso_horario || 'America/Sao_Paulo'),
      planos_aceitos: Array.isArray(emp.planos_aceitos)
        ? emp.planos_aceitos.map((p) => String(p))
        : [],
    },
    clientes: {
      total_clientes: Number(cli.total_clientes) || 0,
      total_pets: Number(cli.total_pets) || 0,
      novos_clientes_mes: Number(cli.novos_clientes_mes) || 0,
      ultimos_clientes: Array.isArray(cli.ultimos_clientes)
        ? cli.ultimos_clientes.slice(0, 5).map((item) => {
            const c = (item as Record<string, unknown>) || {};
            return {
              nome: String(c.nome || 'Cliente'),
              nome_pet: String(c.nome_pet || ''),
              created_at: typeof c.created_at === 'string' ? c.created_at : undefined,
            };
          })
        : [],
    },
    atendimento: {
      conversas_abertas: Number(ate.conversas_abertas) || 0,
      conversas_hoje: Number(ate.conversas_hoje) || 0,
      pausadas_humano: Number(ate.pausadas_humano) || 0,
      atendentes_ativos: Number(ate.atendentes_ativos) || 0,
    },
    agenda: {
      agendamentos_hoje: Number(age.agendamentos_hoje) || 0,
      agendamentos_proximos_7d: Number(age.agendamentos_proximos_7d) || 0,
      especialidades_ativas: Array.isArray(age.especialidades_ativas)
        ? age.especialidades_ativas.map((e) => String(e))
        : [],
      profissionais_ativos: Array.isArray(age.profissionais_ativos)
        ? age.profissionais_ativos.map((p) => String(p))
        : [],
      proximos_agendamentos: Array.isArray(age.proximos_agendamentos)
        ? age.proximos_agendamentos.slice(0, 5).map((item) => {
            const a = (item as Record<string, unknown>) || {};
            return {
              titulo: String(a.titulo || 'Consulta'),
              cliente_nome: String(a.cliente_nome || ''),
              pet_nome: String(a.pet_nome || ''),
              inicio: String(a.inicio || ''),
            };
          })
        : [],
    },
    lembretes: {
      agendados: Number(lem.agendados) || 0,
      enviados_hoje: Number(lem.enviados_hoje) || 0,
      confirmados: Number(lem.confirmados) || 0,
      cancelados: Number(lem.cancelados) || 0,
    },
    pipelines: {
      total_pipelines: Number(pip.total_pipelines) || 0,
      total_cards: Number(pip.total_cards) || 0,
      cards_urgentes: Number(pip.cards_urgentes) || 0,
      valor_aberto: Number(pip.valor_aberto) || 0,
    },
    fila_presencial: {
      aguardando: Number(fil.aguardando) || 0,
      em_atendimento: Number(fil.em_atendimento) || 0,
      atendidos_hoje: Number(fil.atendidos_hoje) || 0,
    },
    prompt_ia: {
      versao_ativa: Number(pro.versao_ativa) || 0,
      regras_ativas: Number(pro.regras_ativas) || 0,
      total_regras: Number(pro.total_regras) || 0,
    },
    satisfacao: {
      total_avaliacoes: Number(sat.total_avaliacoes) || 0,
      media_nota: Number(sat.media_nota) || 0,
    },
  };
}

export function extrairAtalhosDeRota(texto: string): AtalhoRotaCopiloto[] {
  const encontrados = new Map<string, string>();

  // 1. Padrão Markdown [Label](/rota)
  const regexMd = /\[([^\]]+)\]\((\/[a-z0-9-]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = regexMd.exec(texto)) !== null) {
    const label = match[1].trim();
    const url = match[2].trim();
    if (ROTAS_INTERNAS_PERMITIDAS[url] && !encontrados.has(url)) {
      encontrados.set(url, label || ROTAS_INTERNAS_PERMITIDAS[url]);
    }
  }

  // 2. Rotas avulsas citadas no texto (ex.: /schedule, /chats)
  for (const [rota, nomePadrao] of Object.entries(ROTAS_INTERNAS_PERMITIDAS)) {
    if (!encontrados.has(rota) && texto.includes(rota)) {
      encontrados.set(rota, `Abrir ${nomePadrao}`);
    }
  }

  return Array.from(encontrados.entries())
    .slice(0, 4)
    .map(([url, label]) => ({ url, label }));
}

export function obterModuloPorRota(pathname: string): ModuloManualSistema {
  const limpo = pathname.split('?')[0] || '/dashboard';
  const direto = MANUAL_MODULOS_SISTEMA.find((m) => m.url === limpo);
  if (direto) return direto;
  if (limpo === '/calendar') {
    return MANUAL_MODULOS_SISTEMA.find((m) => m.url === '/schedule') || MANUAL_MODULOS_SISTEMA[0];
  }
  if (limpo === '/evolution') {
    return MANUAL_MODULOS_SISTEMA.find((m) => m.url === '/uazapi') || MANUAL_MODULOS_SISTEMA[0];
  }
  return MANUAL_MODULOS_SISTEMA[0];
}

export function obterSugestoesContextuais(pathname: string): SugestaoCopiloto[] {
  const moduloAtual = obterModuloPorRota(pathname);
  return [
    {
      id: 'op-resumo-hoje',
      titulo: 'Resumo da operação hoje',
      pergunta: 'Como está a minha operação hoje? Me dê um panorama geral dos indicadores.',
      categoria: 'operacao',
    },
    {
      id: 'tela-atual-ajuda',
      titulo: `Como usar: ${moduloAtual.titulo.split(' (')[0]}`,
      pergunta: `Como funciona a tela ${moduloAtual.titulo} (${moduloAtual.url}) e quais as melhores práticas aqui?`,
      categoria: 'tela_atual',
    },
    {
      id: 'op-agenda-conversas',
      titulo: 'Agenda e conversas ativas',
      pergunta: 'Quantos agendamentos e conversas abertas temos neste momento?',
      categoria: 'operacao',
    },
    {
      id: 'op-pipelines-lembretes',
      titulo: 'Pipelines CRM e Lembretes',
      pergunta: 'Qual a situação atual dos nossos Pipelines CRM e dos lembretes de vacina/consulta?',
      categoria: 'operacao',
    },
    {
      id: 'sis-prompt-ia',
      titulo: 'Regras e versão do Meu Prompt',
      pergunta: 'Quantas regras estão ativas no Meu Prompt e como editar o comportamento da assistente?',
      categoria: 'sistema',
    },
  ];
}

export function responderCopilotoDeterministico(
  pergunta: string,
  snapshot: ContextoOperacionalSnapshot,
  rotaAtual = '/dashboard'
): { resposta: string; atalhosRota: AtalhoRotaCopiloto[] } {
  const q = normalizarTexto(pergunta);
  const moduloAtual = obterModuloPorRota(rotaAtual);

  // 1. Pergunta sobre a tela atual ("esta tela", "aqui", "como funciona a tela")
  if (
    q.includes('esta tela') ||
    q.includes('nessa tela') ||
    q.includes('nesta tela') ||
    q.includes('fazer aqui') ||
    (q.includes('como funciona') && q.includes(normalizarTexto(moduloAtual.url.replace('/', '')))) ||
    (q.includes('como funciona') && q.includes(normalizarTexto(moduloAtual.titulo.split(' ')[0])))
  ) {
    const passos = moduloAtual.comoUsar.map((p, i) => `${i + 1}. ${p}`).join('\n');
    const dicas = moduloAtual.dicasOperacionais.map((d) => `• ${d}`).join('\n');
    const resposta = [
      `**📍 ${moduloAtual.titulo}** (${moduloAtual.url})`,
      moduloAtual.resumo,
      '',
      '**Como utilizar passo a passo:**',
      passos,
      '',
      '**Dica operacional:**',
      dicas,
    ].join('\n');

    return {
      resposta,
      atalhosRota: [{ url: moduloAtual.url, label: `Ir para ${moduloAtual.titulo.split(' (')[0]}` }],
    };
  }

  // 2. Pergunta de panorama / resumo geral da operação ("operação hoje", "panorama", "resumo da clínica", "como estamos")
  if (
    q.includes('operacao') ||
    q.includes('panorama') ||
    q.includes('resumo') ||
    q.includes('visao geral') ||
    q.includes('como estamos') ||
    (q.includes('hoje') && !q.includes('agenda') && !q.includes('conversa') && !q.includes('fila'))
  ) {
    const valorFormatado = snapshot.pipelines.valor_aberto.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const resposta = [
      `**📊 Panorama em Tempo Real — ${snapshot.empresa.nome_empresa}**`,
      `Assistente ativa: **${snapshot.empresa.nome_assistente}** (Prompt v${snapshot.prompt_ia.versao_ativa} com ${snapshot.prompt_ia.regras_ativas} regras ativas)`,
      '',
      `• **Atendimento WhatsApp:** ${snapshot.atendimento.conversas_abertas} conversas abertas (${snapshot.atendimento.pausadas_humano} com humano) e ${snapshot.atendimento.conversas_hoje} movimentadas hoje.`,
      `• **Agenda Clínica:** ${snapshot.agenda.agendamentos_hoje} agendamentos hoje e ${snapshot.agenda.agendamentos_proximos_7d} nos próximos 7 dias.`,
      `• **Base de Clientes:** ${snapshot.clientes.total_clientes} tutores e ${snapshot.clientes.total_pets} pets (${snapshot.clientes.novos_clientes_mes} novos neste mês).`,
      `• **Pipelines CRM (Kanban):** ${snapshot.pipelines.total_cards} cards em ${snapshot.pipelines.total_pipelines} pipelines (${snapshot.pipelines.cards_urgentes} urgentes/alta prioridade · ${valorFormatado} em aberto).`,
      `• **Lembretes:** ${snapshot.lembretes.agendados} na fila, ${snapshot.lembretes.enviados_hoje} enviados hoje e ${snapshot.lembretes.confirmados} confirmados.`,
      `• **Fila Presencial:** ${snapshot.fila_presencial.aguardando} aguardando, ${snapshot.fila_presencial.em_atendimento} em consultório e ${snapshot.fila_presencial.atendidos_hoje} finalizados hoje.`,
      '',
      'Use os atalhos abaixo para abrir qualquer área da operação: [Abrir Conversas](/chats) [Abrir Agenda](/schedule) [Ver Clientes & CRM](/clients)',
    ].join('\n');

    return {
      resposta,
      atalhosRota: extrairAtalhosDeRota(resposta),
    };
  }

  // 3. Perguntas sobre Agenda / Consultas / Especialidades / Profissionais
  if (
    q.includes('agenda') ||
    q.includes('consulta') ||
    q.includes('especialidade') ||
    q.includes('profissiona') ||
    q.includes('veterinari') ||
    q.includes('horario')
  ) {
    const esp =
      snapshot.agenda.especialidades_ativas.length > 0
        ? snapshot.agenda.especialidades_ativas.join(', ')
        : 'Clínica Geral, Vacinação, Exames';
    const profs =
      snapshot.agenda.profissionais_ativos.length > 0
        ? snapshot.agenda.profissionais_ativos.join(', ')
        : 'Equipe Clínica';
    const prox =
      snapshot.agenda.proximos_agendamentos.length > 0
        ? snapshot.agenda.proximos_agendamentos
            .map(
              (a) =>
                `• **${a.titulo}** — ${a.cliente_nome || 'Tutor'}${a.pet_nome ? ` (Pet: ${a.pet_nome})` : ''}`
            )
            .join('\n')
        : '• Nenhum compromisso futuro imediato listado no cache atual.';

    const resposta = [
      '**📅 Situação da Agenda & Especialidades**',
      `• **Agendamentos hoje:** ${snapshot.agenda.agendamentos_hoje}`,
      `• **Próximos 7 dias:** ${snapshot.agenda.agendamentos_proximos_7d}`,
      `• **Profissionais ativos:** ${profs}`,
      `• **Especialidades ativas:** ${esp}`,
      '',
      '**Próximos compromissos:**',
      prox,
      '',
      'Para gerenciar horários ou criar bloqueios: [Abrir Calendário & Agenda](/schedule) [Configurar Regras da Agenda](/agenda-configuracao)',
    ].join('\n');

    return {
      resposta,
      atalhosRota: extrairAtalhosDeRota(resposta),
    };
  }

  // 4. Perguntas sobre Conversas / Atendimento / WhatsApp
  if (
    q.includes('conversa') ||
    q.includes('atendimento') ||
    q.includes('whatsapp') ||
    q.includes('pausad') ||
    q.includes('atendente')
  ) {
    const resposta = [
      '**💬 Atendimento & Conversas no WhatsApp**',
      `• **Conversas abertas agora:** ${snapshot.atendimento.conversas_abertas}`,
      `• **Conversas com movimentação hoje:** ${snapshot.atendimento.conversas_hoje}`,
      `• **Assumidas por humano (IA pausada):** ${snapshot.atendimento.pausadas_humano}`,
      `• **Atendentes ativos na equipe:** ${snapshot.atendimento.atendentes_ativos}`,
      '',
      '**Como operar:**',
      '1. Em **Conversas** (`/chats`), você acompanha todas as sessões em tempo real e pode alternar para a visão de **Pipelines (Kanban)**.',
      '2. Para pausar a assistente em um cliente específico, clique em **Pausar IA** no topo do chat.',
      '3. Para reconectar o aparelho do WhatsApp via QR Code, acesse **Conexão WhatsApp** (`/uazapi`).',
      '',
      '[Abrir Conversas](/chats) [Conexão WhatsApp](/uazapi) [Gerenciar Atendentes](/attendants)',
    ].join('\n');

    return {
      resposta,
      atalhosRota: extrairAtalhosDeRota(resposta),
    };
  }

  // 5. Perguntas sobre Pipelines CRM / Kanban / Leads / Funil
  if (
    q.includes('pipeline') ||
    q.includes('kanban') ||
    q.includes('crm') ||
    q.includes('funil') ||
    q.includes('lead') ||
    q.includes('card')
  ) {
    const valorFormatado = snapshot.pipelines.valor_aberto.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const resposta = [
      '**🗂️ Pipelines CRM (Kanban)**',
      `• **Pipelines ativos:** ${snapshot.pipelines.total_pipelines} (Atendimento, Captação de Leads, Marketing e Pós-Venda)`,
      `• **Total de cards em andamento:** ${snapshot.pipelines.total_cards}`,
      `• **Cards com prioridade Alta/Urgente:** ${snapshot.pipelines.cards_urgentes}`,
      `• **Valor total estimado nos funis:** ${valorFormatado}`,
      '',
      '**Como usar o módulo de Pipelines:**',
      '1. Acesse **Clientes** (`/clients`) ou **Conversas** (`/chats`) e clique na aba **Pipelines (Kanban)**.',
      '2. Arraste os cards entre as etapas ou clique sobre qualquer card para abrir a gaveta lateral com **Checklist Operacional**, **Próxima Ação** e **Histórico de Movimentações**.',
      '3. Clique em **Gerenciar Pipelines** para criar novos funis ou personalizar colunas e metas de SLA.',
      '',
      '[Abrir Clientes & Pipelines](/clients) [Abrir Conversas & Kanban](/chats)',
    ].join('\n');

    return {
      resposta,
      atalhosRota: extrairAtalhosDeRota(resposta),
    };
  }

  // 6. Perguntas sobre Clientes e Pets
  if (q.includes('cliente') || q.includes('tutor') || q.includes('pet') || q.includes('cadastr')) {
    const ultimos =
      snapshot.clientes.ultimos_clientes.length > 0
        ? snapshot.clientes.ultimos_clientes
            .map((c) => `• **${c.nome}**${c.nome_pet ? ` (Pet: ${c.nome_pet})` : ''}`)
            .join('\n')
        : '• Nenhum cliente listado recentemente.';

    const resposta = [
      '**🐾 Base de Clientes e Pets**',
      `• **Total de tutores cadastrados:** ${snapshot.clientes.total_clientes}`,
      `• **Total de pets vinculados:** ${snapshot.clientes.total_pets}`,
      `• **Novos tutores cadastrados neste mês:** ${snapshot.clientes.novos_clientes_mes}`,
      '',
      '**Últimos clientes registrados:**',
      ultimos,
      '',
      '[Abrir Clientes](/clients)',
    ].join('\n');

    return {
      resposta,
      atalhosRota: extrairAtalhosDeRota(resposta),
    };
  }

  // 7. Perguntas sobre Lembretes (Vacinas / Retornos)
  if (q.includes('lembrete') || q.includes('vacina') || q.includes('retorno')) {
    const resposta = [
      '**🔔 Lembretes Automáticos (Vacinas, Retornos e Consultas)**',
      `• **Agendados na fila:** ${snapshot.lembretes.agendados}`,
      `• **Enviados hoje:** ${snapshot.lembretes.enviados_hoje}`,
      `• **Confirmados pelos tutores:** ${snapshot.lembretes.confirmados}`,
      `• **Cancelados:** ${snapshot.lembretes.cancelados}`,
      '',
      'Os lembretes são enviados via WhatsApp com botões interativos de **Confirmar** e **Cancelar**, atualizando o status automaticamente no painel.',
      '',
      '[Abrir Lembretes](/reminders)',
    ].join('\n');

    return {
      resposta,
      atalhosRota: extrairAtalhosDeRota(resposta),
    };
  }

  // 8. Perguntas sobre Prompt / Regras da IA / Assistente Virtual / RAG
  if (
    q.includes('prompt') ||
    q.includes('regra') ||
    q.includes('variave') ||
    q.includes('luna') ||
    q.includes('assistente') ||
    q.includes('rag') ||
    q.includes('conhecimento')
  ) {
    const resposta = [
      `**✨ Configuração da Assistente (${snapshot.empresa.nome_assistente}) & Meu Prompt**`,
      `• **Versão ativa em produção:** v${snapshot.prompt_ia.versao_ativa}`,
      `• **Regras ativas no compilador:** ${snapshot.prompt_ia.regras_ativas} de ${snapshot.prompt_ia.total_regras} regras cadastradas`,
      '',
      '**Onde ajustar cada comportamento:**',
      '1. **Meu Prompt** (`/my-prompt`): regras modulares por categoria, variáveis dinâmicas `{{...}}`, prévia do texto e histórico de versões com Rollback.',
      '2. **Config. do Atendimento** (`/atendimento-configuracao`): endereço, horários, PIX e planos aceitos (atualiza as variáveis sem precisar reeditar regras).',
      '3. **Base de Conhecimento RAG** (`/knowledge`): manuais e orientações clínicas extensas.',
      '',
      '[Abrir Meu Prompt](/my-prompt) [Config. do Atendimento](/atendimento-configuracao) [Base RAG](/knowledge)',
    ].join('\n');

    return {
      resposta,
      atalhosRota: extrairAtalhosDeRota(resposta),
    };
  }

  // 9. Perguntas sobre Fila Presencial / Senhas / TV / Totem
  if (q.includes('fila') || q.includes('senha') || q.includes('totem') || q.includes('tv') || q.includes('triagem')) {
    const resposta = [
      '**🎫 Fila Presencial & Chamador de Consultório**',
      `• **Aguardando atendimento hoje:** ${snapshot.fila_presencial.aguardando}`,
      `• **Em atendimento nos consultórios:** ${snapshot.fila_presencial.em_atendimento}`,
      `• **Finalizados hoje:** ${snapshot.fila_presencial.atendidos_hoje}`,
      '',
      'Você pode gerenciar a recepção em `/queue`, abrir o painel da TV em `/tv` e o quiosque de senhas em `/totem`.',
      '',
      '[Abrir Fila Presencial](/queue)',
    ].join('\n');

    return {
      resposta,
      atalhosRota: extrairAtalhosDeRota(resposta),
    };
  }

  // 10. Perguntas sobre Prontuário IA ou Receituário IA
  if (
    q.includes('prontuario') ||
    q.includes('receituario') ||
    q.includes('receita') ||
    q.includes('prescricao') ||
    q.includes('bulario') ||
    q.includes('posologia')
  ) {
    const resposta = [
      '**🩺 Módulos Clínicos Veterinários com IA**',
      '• **Prontuário IA (`/prontuario`):** grava a consulta em áudio, transcreve e preenche anamnese, exame físico e diagnóstico sem inventar dados, com revisão humana e assinatura SHA-256.',
      '• **Receituário IA (`/receituario`):** calcula doses exatas em mg/kg por espécie e peso, aplica Hard Rules de segurança (bloqueio de Paracetamol/Permetrina em gatos e Ivermectina em raças MDR1) e gera PDF A4 com QR Code.',
      '',
      '[Abrir Prontuário IA](/prontuario) [Abrir Receituário IA](/receituario)',
    ].join('\n');

    return {
      resposta,
      atalhosRota: extrairAtalhosDeRota(resposta),
    };
  }

  // 11. Busca por palavras-chave nos módulos do manual
  for (const mod of MANUAL_MODULOS_SISTEMA) {
    const bateu = mod.palavrasChave.some((kw) => q.includes(normalizarTexto(kw)));
    if (bateu) {
      const passos = mod.comoUsar.map((p, i) => `${i + 1}. ${p}`).join('\n');
      const resposta = [
        `**📘 ${mod.titulo}** (${mod.url})`,
        mod.resumo,
        '',
        '**Como usar:**',
        passos,
        '',
        `[Abrir ${mod.titulo.split(' (')[0]}](${mod.url})`,
      ].join('\n');

      return {
        resposta,
        atalhosRota: extrairAtalhosDeRota(resposta),
      };
    }
  }

  // 12. Resposta padrão contextualizada com operação + tela atual
  const resposta = [
    `**🤖 Copiloto da Operação (${MODELO_COPILOTO_FIXO})**`,
    `Você está na tela **${moduloAtual.titulo}** (\`${moduloAtual.url}\`).`,
    '',
    '**Resumo rápido da sua operação agora:**',
    `• **Conversas abertas:** ${snapshot.atendimento.conversas_abertas} (${snapshot.atendimento.conversas_hoje} hoje)`,
    `• **Agendamentos de hoje:** ${snapshot.agenda.agendamentos_hoje} (${snapshot.agenda.agendamentos_proximos_7d} nos próximos 7 dias)`,
    `• **Clientes & Pets:** ${snapshot.clientes.total_clientes} tutores e ${snapshot.clientes.total_pets} pets`,
    `• **Pipelines CRM:** ${snapshot.pipelines.total_cards} cards ativos (${snapshot.pipelines.cards_urgentes} urgentes)`,
    `• **Lembretes agendados:** ${snapshot.lembretes.agendados}`,
    '',
    'Você pode me perguntar coisas como:',
    '• *"Como está minha operação hoje?"*',
    '• *"Quantos agendamentos temos hoje e quais os próximos?"*',
    '• *"Como funciona esta tela?"*',
    '• *"Como editar regras no Meu Prompt ou pausar a IA no WhatsApp?"*',
    '',
    '[Início](/dashboard) [Conversas](/chats) [Agenda](/schedule) [Meu Prompt](/my-prompt)',
  ].join('\n');

  return {
    resposta,
    atalhosRota: extrairAtalhosDeRota(resposta),
  };
}
