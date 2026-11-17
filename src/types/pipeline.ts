export type PipelineCategoria = 'atendimento' | 'leads' | 'marketing' | 'pos_venda' | 'outros';

export type StageTipo = 'entrada' | 'andamento' | 'ganho' | 'perdido';

export type CardPrioridade = 'baixa' | 'media' | 'alta' | 'urgente';

export type CardOrigem =
  | 'whatsapp'
  | 'instagram'
  | 'google_ads'
  | 'indicacao'
  | 'site'
  | 'presencial'
  | 'telefone'
  | 'campanha'
  | 'outros';

export type ActivityTipo = 'criacao' | 'movimentacao' | 'nota' | 'edicao' | 'mensagem' | 'tarefa';

export interface ChecklistItem {
  id: string;
  texto: string;
  concluido: boolean;
}

export interface CrmPipeline {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: PipelineCategoria;
  cor: string;
  padrao: boolean;
  ativo: boolean;
  ordem: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrmPipelineStage {
  id: string;
  pipelineId: string;
  nome: string;
  /** Roteiro/dica operacional para ajudar o atendente a se guiar nesta etapa. */
  descricao: string | null;
  cor: string;
  tipo: StageTipo;
  slaHoras: number | null;
  checklistPadrao: string[];
  ordem: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrmPipelineCard {
  id: string;
  pipelineId: string;
  stageId: string;
  clientId: number | null;
  sessionId: string | null;
  titulo: string;
  nomeContato: string;
  telefone: string | null;
  email: string | null;
  nomePet: string | null;
  especiePet: string | null;
  racaPet: string | null;
  portePet: string | null;
  servicoInteresse: string | null;
  valorEstimado: number;
  prioridade: CardPrioridade;
  origem: CardOrigem;
  campanha: string | null;
  atendenteId: number | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  observacoes: string | null;
  checklist: ChecklistItem[];
  tagsCustom: string[];
  motivoPerda: string | null;
  ordem: number;
  movidoEm: string;
  createdAt: string;
  updatedAt: string;
  /** Dados enriquecidos da tela de Clientes (dados_cliente) e Conversas (search_conversations) */
  cpfCnpj?: string | null;
  asaasCustomerId?: string | null;
  endereco?: string | null;
  clienteAtivo?: boolean;
  ultimaMensagem?: string | null;
  ultimoContatoEm?: string | null;
  ultimoContatoRotulo?: string | null;
  latestMessageId?: number;
  virtualFromConversation?: boolean;
}

export interface CrmPipelineActivity {
  id: string;
  cardId: string;
  tipo: ActivityTipo;
  descricao: string;
  deStageId: string | null;
  paraStageId: string | null;
  autorNome: string | null;
  createdAt: string;
}

export const PIPELINE_CATEGORIA_LABELS: Record<PipelineCategoria, string> = {
  atendimento: 'Atendimento Clínico',
  leads: 'Captação de Leads',
  marketing: 'Marketing & Campanhas',
  pos_venda: 'Pós-Consulta & Retorno',
  outros: 'Personalizado',
};

export const STAGE_TIPO_LABELS: Record<StageTipo, string> = {
  entrada: 'Entrada / Triagem',
  andamento: 'Em Andamento',
  ganho: 'Ganho / Convertido',
  perdido: 'Perdido / Arquivado',
};

export const CARD_PRIORIDADE_LABELS: Record<CardPrioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const CARD_ORIGEM_LABELS: Record<CardOrigem, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  google_ads: 'Google Ads',
  indicacao: 'Indicação',
  site: 'Site / Landing Page',
  presencial: 'Balcão / Presencial',
  telefone: 'Ligação Telefônica',
  campanha: 'Campanha Ativa',
  outros: 'Outros',
};

export const PIPELINE_COLORS = [
  '#0d9488', // Teal
  '#0ea5e9', // Sky
  '#2563eb', // Blue
  '#6366f1', // Indigo
  '#7c3aed', // Violet
  '#db2777', // Pink
  '#dc2626', // Red
  '#ea580c', // Orange
  '#d97706', // Amber
  '#16a34a', // Green
  '#475569', // Slate
];

export const SERVICOS_SUGERIDOS = [
  'Consulta Clínica Geral',
  'Consulta Especializada',
  'Vacinação / Protocolo Vacinal',
  'Check-up Preventivo',
  'Exames Laboratoriais / Imagem',
  'Cirurgia / Castração',
  'Profilaxia Dental (Tártaro)',
  'Retorno / Acompanhamento',
  'Emergência / Pronto Atendimento',
];
