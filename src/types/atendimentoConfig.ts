export type DeteccaoEstado = 'padrao' | 'mensagem_cliente' | 'resposta_assistente' | 'manual';

export interface HorarioFuncionamento {
  /** 0 = domingo ... 6 = sábado */
  dias: number[];
  abre: string;
  fecha: string;
}

export interface AtendimentoConfig {
  id: string;
  nome_empresa: string;
  nome_assistente: string;
  telefone_contato: string | null;
  codigo_pais: string;
  fuso_horario: string;
  modelo_ia: string | null;
  padroes_loop_bot: string[];
  loop_bot_minimo_respostas: number;
  loop_bot_pausa_dias: number;
  endereco: string | null;
  site: string | null;
  instagram: string | null;
  email_contato: string | null;
  chave_pix: string | null;
  planos_aceitos: string[];
  frase_encerramento: string | null;
  estilo_comunicacao: string;
  horario_funcionamento: HorarioFuncionamento[];
  saudacao_bom_dia_inicio: string;
  saudacao_boa_tarde_inicio: string;
  saudacao_boa_noite_inicio: string;
  aviso_fora_horario_inicio: string | null;
  aviso_fora_horario_fim: string | null;
  aviso_fora_horario_texto: string | null;
  pausa_entre_mensagens_ms: number;
  max_caracteres_mensagem: number;
}

export type QuemAgenda = 'assistente' | 'recepcao' | 'sem_agendamento' | 'nao_oferece';

export interface ClinicaServico {
  id: string;
  chave: string;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  preco: number | null;
  preco_observacao: string | null;
  quem_agenda: QuemAgenda;
  tipo_agenda_id: string | null;
  exige_requisicao: boolean;
  aceita_plano: boolean | null;
  observacoes: string | null;
  ordem: number;
  ativo: boolean;
}

export const QUEM_AGENDA: Array<{ chave: QuemAgenda; nome: string; ajuda: string }> = [
  { chave: 'assistente', nome: 'O assistente agenda', ajuda: 'Consulta horários e agenda sozinho. Exige um tipo de agenda.' },
  { chave: 'recepcao', nome: 'Somente a recepção', ajuda: 'O assistente informa valores/horários e encaminha para a equipe agendar.' },
  { chave: 'sem_agendamento', nome: 'Sem agendamento', ajuda: 'Atendido por ordem de chegada ou sob demanda.' },
  { chave: 'nao_oferece', nome: 'Não oferecido', ajuda: 'O assistente informa com gentileza que a empresa não faz.' },
];

export interface AtendimentoEstado {
  id: string;
  chave: string;
  nome: string;
  descricao: string | null;
  deteccao: DeteccaoEstado;
  criterios: string | null;
  frase_gatilho: string | null;
  pausar_bot: boolean;
  pausa_horas: number | null;
  notificar: boolean;
  modelo_notificacao: string | null;
  resumo_instrucao: string | null;
  mensagem_cliente: string | null;
  encerrar_conversa: boolean;
  ativo: boolean;
  padrao: boolean;
  ordem: number;
}

export type EscopoNotificacao = 'global' | 'unidade' | 'profissional' | 'departamento';

export interface NotificacaoDestinatario {
  id: string;
  nome: string;
  telefone: string;
  eventos: string[];
  escopo: EscopoNotificacao;
  unidade: string | null;
  profissional_id: string | null;
  departamento_id: number | null;
  ativo: boolean;
  observacao: string | null;
}

export const EVENTOS_AGENDA = [
  { chave: 'agendamento_criado', nome: 'Agendamento criado' },
  { chave: 'agendamento_reagendado', nome: 'Agendamento remarcado' },
  { chave: 'agendamento_cancelado', nome: 'Agendamento cancelado' },
] as const;

export const OPERACOES_AGENDA = [
  { chave: 'buscar', nome: 'Consultar horários' },
  { chave: 'agendar', nome: 'Agendar' },
  { chave: 'reagendar', nome: 'Reagendar' },
  { chave: 'cancelar', nome: 'Cancelar' },
] as const;

export const CAMPOS_AGENDA = [
  { chave: 'email', nome: 'E-mail do cliente' },
  { chave: 'nome_cliente', nome: 'Nome do tutor' },
  { chave: 'nome_pet', nome: 'Nome do pet' },
  { chave: 'raca_pet', nome: 'Raça do pet' },
  { chave: 'porte_pet', nome: 'Porte do pet' },
] as const;
