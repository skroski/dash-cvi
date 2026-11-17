import {
  CardOrigem,
  CardPrioridade,
  ChecklistItem,
  CrmPipeline,
  CrmPipelineCard,
  CrmPipelineStage,
  PipelineCategoria,
  StageTipo,
} from '@/types/pipeline';
import { toWhatsappNumber } from '@/lib/formatters';

export interface PipelineTemplateStage {
  nome: string;
  descricao: string;
  cor: string;
  tipo: StageTipo;
  slaHoras: number | null;
  checklistPadrao: string[];
}

export interface PipelineTemplate {
  chave: string;
  nome: string;
  descricao: string;
  categoria: PipelineCategoria;
  cor: string;
  padrao?: boolean;
  estagios: PipelineTemplateStage[];
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    chave: 'atendimento_clinico',
    nome: 'Fluxo de Atendimento Clínico',
    descricao:
      'Organiza o atendimento diário da recepção: desde o primeiro contato no WhatsApp até o agendamento confirmado e pós-consulta.',
    categoria: 'atendimento',
    cor: '#0d9488',
    padrao: true,
    estagios: [
      {
        nome: 'Triagem / Novo Contato',
        descricao:
          'Acolher o tutor, identificar nome e espécie do pet, entender o sintoma ou serviço desejado e avaliar se há sinais de urgência.',
        cor: '#0ea5e9',
        tipo: 'entrada',
        slaHoras: 1,
        checklistPadrao: [
          'Identificar tutor e nome do pet',
          'Entender queixa principal ou serviço',
          'Verificar se é urgência/emergência',
        ],
      },
      {
        nome: 'Orçamento & Dúvidas',
        descricao:
          'Informar valores de consulta/exames, explicar preparos necessários (ex.: jejum para exames) e esclarecer dúvidas.',
        cor: '#2563eb',
        tipo: 'andamento',
        slaHoras: 4,
        checklistPadrao: [
          'Informar valor do serviço/consulta',
          'Explicar preparo ou documentos necessários',
          'Oferecer horários disponíveis na agenda',
        ],
      },
      {
        nome: 'Aguardando Confirmação',
        descricao:
          'Horários já foram enviados ao tutor. Realizar follow-up cordial caso ainda não tenha confirmado o horário.',
        cor: '#d97706',
        tipo: 'andamento',
        slaHoras: 12,
        checklistPadrao: [
          'Enviar opções de data e horário',
          'Realizar follow-up se não responder em 4h',
        ],
      },
      {
        nome: 'Agendado / Confirmado',
        descricao:
          'Horário reservado na agenda! Enviar confirmação com endereço da clínica e orientações pré-consulta.',
        cor: '#16a34a',
        tipo: 'ganho',
        slaHoras: 24,
        checklistPadrao: [
          'Registrar agendamento no calendário',
          'Confirmar dados cadastrais do tutor/pet',
          'Enviar confirmação e localização',
        ],
      },
      {
        nome: 'Pós-Consulta & Retorno',
        descricao:
          'Entrar em contato após o atendimento para saber como o pet está evoluindo e lembrar sobre retorno ou exames.',
        cor: '#7c3aed',
        tipo: 'andamento',
        slaHoras: 48,
        checklistPadrao: [
          'Perguntar como o pet está se recuperando',
          'Verificar se precisa agendar retorno',
        ],
      },
      {
        nome: 'Não Agendou / Arquivado',
        descricao:
          'Tutor optou por não agendar no momento. Registrar o motivo para futuras ações de repescagem.',
        cor: '#64748b',
        tipo: 'perdido',
        slaHoras: null,
        checklistPadrao: ['Registrar motivo pelo qual não agendou'],
      },
    ],
  },
  {
    chave: 'captacao_leads',
    nome: 'Captação de Leads & Comercial',
    descricao:
      'Acompanhamento de novos contatos vindos do Instagram, Google Ads, indicações e site até a conversão no primeiro atendimento.',
    categoria: 'leads',
    cor: '#2563eb',
    padrao: false,
    estagios: [
      {
        nome: 'Novo Lead',
        descricao:
          'Contato acabou de chegar por anúncio, Instagram, Google ou indicação. Responder rapidamente para aproveitar o interesse quente.',
        cor: '#0ea5e9',
        tipo: 'entrada',
        slaHoras: 1,
        checklistPadrao: [
          'Responder em até 15 minutos',
          'Registrar origem do lead e nome do pet',
        ],
      },
      {
        nome: 'Qualificação do Pet',
        descricao:
          'Conhecer o perfil do pet (idade, raça, porte, histórico vacinal) e identificar a melhor solução clínica.',
        cor: '#2563eb',
        tipo: 'andamento',
        slaHoras: 4,
        checklistPadrao: [
          'Levantar idade, raça e histórico do pet',
          'Identificar especialidade ou serviço ideal',
        ],
      },
      {
        nome: 'Apresentação & Proposta',
        descricao:
          'Apresentar diferenciais da clínica, pacotes preventivos, check-ups ou valores da especialidade solicitada.',
        cor: '#7c3aed',
        tipo: 'andamento',
        slaHoras: 12,
        checklistPadrao: [
          'Apresentar diferenciais da equipe e estrutura',
          'Enviar proposta/valores e sugerir horários',
        ],
      },
      {
        nome: 'Follow-up / Repescagem',
        descricao:
          'Retomar contato com leads que visualizaram a proposta mas ainda não fecharam o agendamento.',
        cor: '#ea580c',
        tipo: 'andamento',
        slaHoras: 24,
        checklistPadrao: [
          'Primeiro toque de follow-up',
          'Segundo toque oferecendo ajuda com horários',
        ],
      },
      {
        nome: 'Lead Convertido',
        descricao:
          'Lead agendou o primeiro atendimento e virou cliente ativo da clínica!',
        cor: '#16a34a',
        tipo: 'ganho',
        slaHoras: null,
        checklistPadrao: [
          'Cadastrar cliente completo na base',
          'Confirmar agendamento na agenda',
        ],
      },
      {
        nome: 'Lead Perdido',
        descricao:
          'Sem retorno após tentativas ou fora do perfil. Anotar o motivo para análise de marketing.',
        cor: '#dc2626',
        tipo: 'perdido',
        slaHoras: null,
        checklistPadrao: ['Registrar motivo da perda (preço, distância, sem resposta)'],
      },
    ],
  },
  {
    chave: 'marketing_campanhas',
    nome: 'Campanhas de Marketing & Preventivos',
    descricao:
      'Gestão de campanhas ativas (Vacinação em Dia, Check-up Sênior, Mês do Gato/Cão, Profilaxia Dental e Retornos).',
    categoria: 'marketing',
    cor: '#7c3aed',
    padrao: false,
    estagios: [
      {
        nome: 'Público Selecionado',
        descricao:
          'Clientes filtrados por tag, porte ou histórico para receber o convite da campanha preventiva.',
        cor: '#6366f1',
        tipo: 'entrada',
        slaHoras: 24,
        checklistPadrao: [
          'Conferir dados do pet e histórico',
          'Enviar mensagem personalizada da campanha',
        ],
      },
      {
        nome: 'Mensagem Enviada',
        descricao:
          'Comunicado da campanha enviado. Aguardando leitura ou interação do tutor.',
        cor: '#0ea5e9',
        tipo: 'andamento',
        slaHoras: 24,
        checklistPadrao: ['Confirmar entrega da mensagem no WhatsApp'],
      },
      {
        nome: 'Interagiu / Interessado',
        descricao:
          'Tutor respondeu com interesse na campanha! Conduzir para escolha de dia e horário.',
        cor: '#d97706',
        tipo: 'andamento',
        slaHoras: 2,
        checklistPadrao: [
          'Tirar dúvidas sobre o pacote da campanha',
          'Sugerir 2 opções de horário',
        ],
      },
      {
        nome: 'Agendado pela Campanha',
        descricao:
          'Sucesso! Tutor agendou o serviço promocional/preventivo da campanha.',
        cor: '#16a34a',
        tipo: 'ganho',
        slaHoras: null,
        checklistPadrao: ['Confirmar agendamento e aplicar condição da campanha'],
      },
      {
        nome: 'Sem Interesse no Momento',
        descricao:
          'Tutor agradeceu mas não participará desta edição da campanha.',
        cor: '#64748b',
        tipo: 'perdido',
        slaHoras: null,
        checklistPadrao: ['Manter relacionamento cordial para próximas ações'],
      },
    ],
  },
  {
    chave: 'pos_venda_cirurgia',
    nome: 'Pós-Consulta, Exames & Cirurgias',
    descricao:
      'Acompanhamento próximo de pacientes que realizaram exames, procedimentos ou cirurgias e precisam de retorno.',
    categoria: 'pos_venda',
    cor: '#16a34a',
    padrao: false,
    estagios: [
      {
        nome: 'Aguardando Exames / Preparo',
        descricao:
          'Paciente com pedido de exames pré-operatórios ou laboratoriais em andamento.',
        cor: '#0ea5e9',
        tipo: 'entrada',
        slaHoras: 24,
        checklistPadrao: [
          'Orientar preparo e jejum',
          'Confirmar recebimento dos laudos',
        ],
      },
      {
        nome: 'Laudo Liberado / Avaliação',
        descricao:
          'Resultados prontos. Agendar retorno ou comunicar veterinário responsável.',
        cor: '#2563eb',
        tipo: 'andamento',
        slaHoras: 8,
        checklistPadrao: [
          'Avisar veterinário sobre o laudo',
          'Agendar retorno ou procedimento com o tutor',
        ],
      },
      {
        nome: 'Em Recuperação Domiciliar',
        descricao:
          'Monitorar medicação e evolução clínica do pet em casa nas primeiras 48h.',
        cor: '#7c3aed',
        tipo: 'andamento',
        slaHoras: 24,
        checklistPadrao: [
          'Perguntar se está tomando a medicação',
          'Confirmar data de retirada de pontos / alta',
        ],
      },
      {
        nome: 'Alta Clínica Concluída',
        descricao: 'Tratamento e retorno concluídos com sucesso!',
        cor: '#16a34a',
        tipo: 'ganho',
        slaHoras: null,
        checklistPadrao: ['Enviar pesquisa de satisfação'],
      },
    ],
  },
];

export function criarChecklistDeTextos(textos: string[]): ChecklistItem[] {
  return textos
    .map((t) => t.trim())
    .filter(Boolean)
    .map((texto, idx) => ({
      id: `chk-${idx}-${Math.random().toString(36).slice(2, 8)}`,
      texto,
      concluido: false,
    }));
}

export interface SlaAvaliacao {
  horasNaEtapa: number;
  rotuloTempo: string;
  atrasado: boolean;
  alertaProximo: boolean;
}

export function avaliarSlaCard(
  movidoEm: string | null | undefined,
  slaHoras: number | null | undefined,
  stageTipo?: StageTipo,
  agoraMs: number = Date.now()
): SlaAvaliacao {
  const ts = movidoEm ? Date.parse(movidoEm) : NaN;
  const diffMs = Number.isNaN(ts) ? 0 : Math.max(0, agoraMs - ts);
  const horas = diffMs / (1000 * 60 * 60);
  const minutos = Math.floor(diffMs / (1000 * 60));

  let rotuloTempo = 'Agora mesmo';
  if (minutos >= 1 && minutos < 60) {
    rotuloTempo = `Há ${minutos} min`;
  } else if (horas >= 1 && horas < 24) {
    rotuloTempo = `Há ${Math.floor(horas)}h`;
  } else if (horas >= 24) {
    const dias = Math.floor(horas / 24);
    rotuloTempo = `Há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  }

  // Etapas finais (ganho/perdido) não disparam alerta de atraso
  if (stageTipo === 'ganho' || stageTipo === 'perdido' || !slaHoras || slaHoras <= 0) {
    return {
      horasNaEtapa: horas,
      rotuloTempo,
      atrasado: false,
      alertaProximo: false,
    };
  }

  const atrasado = horas >= slaHoras;
  const alertaProximo = !atrasado && horas >= slaHoras * 0.75;

  return {
    horasNaEtapa: horas,
    rotuloTempo,
    atrasado,
    alertaProximo,
  };
}

export interface PipelineMetricas {
  totalCards: number;
  valorTotal: number;
  emAndamentoCount: number;
  ganhosCount: number;
  valorGanho: number;
  perdidosCount: number;
  taxaConversao: number;
  atrasadosSlaCount: number;
  followUpPendenteCount: number;
}

export function calcularMetricasPipeline(
  cards: CrmPipelineCard[],
  stages: CrmPipelineStage[],
  agoraMs: number = Date.now()
): PipelineMetricas {
  const stageById = new Map(stages.map((s) => [s.id, s]));
  let valorTotal = 0;
  let emAndamentoCount = 0;
  let ganhosCount = 0;
  let valorGanho = 0;
  let perdidosCount = 0;
  let atrasadosSlaCount = 0;
  let followUpPendenteCount = 0;

  for (const card of cards) {
    const stage = stageById.get(card.stageId);
    const tipo = stage?.tipo ?? 'andamento';
    const valor = Number(card.valorEstimado) || 0;
    valorTotal += valor;

    if (tipo === 'ganho') {
      ganhosCount += 1;
      valorGanho += valor;
    } else if (tipo === 'perdido') {
      perdidosCount += 1;
    } else {
      emAndamentoCount += 1;
    }

    const sla = avaliarSlaCard(card.movidoEm, stage?.slaHoras, tipo, agoraMs);
    if (sla.atrasado) {
      atrasadosSlaCount += 1;
    }

    if (card.proximaAcaoEm && tipo !== 'ganho' && tipo !== 'perdido') {
      const acaoTs = Date.parse(card.proximaAcaoEm);
      if (!Number.isNaN(acaoTs) && acaoTs <= agoraMs) {
        followUpPendenteCount += 1;
      }
    }
  }

  const totalCards = cards.length;
  const taxaConversao =
    totalCards > 0 ? Math.round((ganhosCount / totalCards) * 100) : 0;

  return {
    totalCards,
    valorTotal,
    emAndamentoCount,
    ganhosCount,
    valorGanho,
    perdidosCount,
    taxaConversao,
    atrasadosSlaCount,
    followUpPendenteCount,
  };
}

export function montarLinkConversa(card: {
  sessionId?: string | null;
  telefone?: string | null;
  nomeContato?: string | null;
}): string {
  const session = card.sessionId?.trim();
  const phoneDigits = toWhatsappNumber(card.telefone);
  const selectTarget = session || phoneDigits;
  const searchTarget = card.telefone?.trim() || card.nomeContato?.trim() || '';

  const params = new URLSearchParams();
  if (selectTarget) {
    params.set('select', selectTarget);
  }
  if (searchTarget) {
    params.set('search', searchTarget);
  }
  const qs = params.toString();
  return qs ? `/chats?${qs}` : '/chats';
}

export function montarLinkProntuario(card: {
  clientId?: number | null;
  nomeContato: string;
  nomePet?: string | null;
  telefone?: string | null;
}): string {
  const params = new URLSearchParams();
  if (card.clientId) {
    params.set('clientId', String(card.clientId));
  }
  if (card.nomeContato) {
    params.set('tutor', card.nomeContato);
  }
  if (card.nomePet) {
    params.set('pet', card.nomePet);
  }
  if (card.telefone) {
    params.set('telefone', card.telefone);
  }
  return `/prontuario?${params.toString()}`;
}

export interface FiltrosPipeline {
  busca: string;
  prioridade: CardPrioridade | 'todas';
  origem: CardOrigem | 'todas';
  atendenteId: number | 'todos' | 'sem_atendente';
  tagId: number | 'todas';
  apenasAtrasados: boolean;
}

export function filtrarCardsPipeline(
  cards: CrmPipelineCard[],
  stages: CrmPipelineStage[],
  filtros: FiltrosPipeline,
  tagsPorCliente?: Map<number, { id: number; nome: string; cor: string }[]>,
  agoraMs: number = Date.now()
): CrmPipelineCard[] {
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const termo = filtros.busca.trim().toLowerCase();

  return cards.filter((card) => {
    if (termo) {
      const campos = [
        card.titulo,
        card.nomeContato,
        card.telefone,
        card.email,
        card.nomePet,
        card.racaPet,
        card.portePet,
        card.servicoInteresse,
        card.campanha,
        card.observacoes,
        card.cpfCnpj,
        card.asaasCustomerId,
        card.ultimaMensagem,
        ...(card.tagsCustom || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!campos.includes(termo)) return false;
    }

    if (filtros.prioridade !== 'todas' && card.prioridade !== filtros.prioridade) {
      return false;
    }

    if (filtros.origem !== 'todas' && card.origem !== filtros.origem) {
      return false;
    }

    if (filtros.atendenteId === 'sem_atendente') {
      if (card.atendenteId !== null) return false;
    } else if (filtros.atendenteId !== 'todos') {
      if (card.atendenteId !== filtros.atendenteId) return false;
    }

    if (filtros.tagId !== 'todas') {
      if (!card.clientId) return false;
      const tagsCliente = tagsPorCliente?.get(card.clientId) || [];
      if (!tagsCliente.some((t) => t.id === filtros.tagId)) return false;
    }

    if (filtros.apenasAtrasados) {
      const stage = stageById.get(card.stageId);
      const sla = avaliarSlaCard(card.movidoEm, stage?.slaHoras, stage?.tipo, agoraMs);
      const acaoVencida =
        card.proximaAcaoEm &&
        stage?.tipo !== 'ganho' &&
        stage?.tipo !== 'perdido' &&
        Date.parse(card.proximaAcaoEm) <= agoraMs;
      if (!sla.atrasado && !acaoVencida) return false;
    }

    return true;
  });
}

export function gerarEstadoInicialFallback(): {
  pipelines: CrmPipeline[];
  stages: CrmPipelineStage[];
  cards: CrmPipelineCard[];
} {
  const agora = new Date().toISOString();
  const pipelines: CrmPipeline[] = [];
  const stages: CrmPipelineStage[] = [];

  PIPELINE_TEMPLATES.slice(0, 3).forEach((tpl, pIdx) => {
    const pipelineId = `local-pipe-${tpl.chave}`;
    pipelines.push({
      id: pipelineId,
      nome: tpl.nome,
      descricao: tpl.descricao,
      categoria: tpl.categoria,
      cor: tpl.cor,
      padrao: Boolean(tpl.padrao),
      ativo: true,
      ordem: pIdx,
      createdAt: agora,
      updatedAt: agora,
    });

    tpl.estagios.forEach((st, sIdx) => {
      stages.push({
        id: `local-stage-${tpl.chave}-${sIdx}`,
        pipelineId,
        nome: st.nome,
        descricao: st.descricao,
        cor: st.cor,
        tipo: st.tipo,
        slaHoras: st.slaHoras,
        checklistPadrao: st.checklistPadrao,
        ordem: sIdx,
        createdAt: agora,
        updatedAt: agora,
      });
    });
  });

  return { pipelines, stages, cards: [] };
}
