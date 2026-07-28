export type AtendimentoStatus = 'aberto' | 'encerrado';

export type NotificacaoTipo = 'atribuicao' | 'transferencia' | 'encerramento';

export interface Departamento {
  id: number;
  nome: string;
  cor: string;
}

export interface Atendente {
  id: number;
  nome: string;
  cargo: string;
  telefone: string | null;
  departamentoId: number | null;
  ativo: boolean;
}

export interface Atendimento {
  id: number;
  sessionId: string;
  clientId: number | null;
  atendenteId: number | null;
  departamentoId: number | null;
  status: AtendimentoStatus;
  createdAt: string;
  updatedAt: string;
  encerradoEm: string | null;
}

export interface AtendimentoTransferencia {
  id: number;
  atendimentoId: number;
  deAtendenteId: number | null;
  paraAtendenteId: number | null;
  deDepartamentoId: number | null;
  paraDepartamentoId: number | null;
  motivo: string | null;
  createdAt: string;
}

export interface Notificacao {
  id: number;
  tipo: NotificacaoTipo;
  titulo: string;
  descricao: string | null;
  sessionId: string | null;
  atendimentoId: number | null;
  atendenteId: number | null;
  departamentoId: number | null;
  lida: boolean;
  createdAt: string;
}

// Cargos sugeridos ao cadastrar um novo membro da equipe (campo permanece livre)
export const CARGOS_SUGERIDOS = [
  'Atendente',
  'Veterinário',
];
