export type CategoriaRegra =
  | 'comportamento'
  | 'agendamento'
  | 'servicos'
  | 'informacoes'
  | 'restricoes'
  | 'emergencia'
  | 'personalizadas';

export interface PromptRegra {
  id: string;
  codigo: string;
  titulo: string;
  categoria: CategoriaRegra;
  conteudo: string;
  padrao: boolean;
  ativa: boolean;
  ordem: number;
  criado_por?: string | null;
  atualizado_por?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptVersao {
  id: string;
  conteudo: string;
  versao: number;
  descricao?: string | null;
  autor_nome?: string | null;
  snapshot_regras?: Array<{
    id?: string;
    codigo?: string;
    titulo: string;
    categoria: string;
    conteudo: string;
    padrao?: boolean;
    ativa?: boolean;
    ordem?: number;
  }> | null;
  criado_em: string;
}

export interface PromptCompilado {
  prompt_completo: string;
  total_regras_ativas: number;
}

export interface PromptPrevia {
  texto: string;
  desconhecidas: string[];
  caracteres: number;
  tokens_estimados: number;
}
