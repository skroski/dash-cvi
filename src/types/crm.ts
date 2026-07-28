
export type PendenciaStatus = 'pendente' | 'concluida';

export interface PendenciaTipo {
  id: number;
  nome: string;
}

export interface ClientPendencia {
  id: number;
  clientId: number;
  tipoId: number | null;
  descricao: string;
  observacao: string | null;
  status: PendenciaStatus;
  createdAt: string;
  concluidaEm: string | null;
}

export interface Tag {
  id: number;
  nome: string;
  cor: string;
}

export interface ClientTag {
  id: number;
  clientId: number;
  tagId: number;
}

// Paleta de cores sugeridas para novas tags (teal primeiro, seguindo o design system)
export const TAG_COLORS = [
  '#0d9488',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#ea580c',
  '#d97706',
  '#16a34a',
  '#475569',
];
