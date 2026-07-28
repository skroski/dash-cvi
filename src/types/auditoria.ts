export interface AuditoriaEvento {
  id: number;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  atorUserId: string | null;
  atorAtendenteId: number | null;
  atorNome: string | null;
  alvoAtendenteId: number | null;
  alvoUserId: string | null;
  atendimentoId: number | null;
  sessionId: string | null;
  dados: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Rótulos das ações registradas pelos triggers do banco. Ações desconhecidas
 * (adicionadas depois no SQL) caem no fallback de `descreverAcao`.
 */
export const ACAO_LABEL: Record<string, string> = {
  'atendimento.atribuido': 'Atendimento atribuído',
  'atendimento.transferido': 'Atendimento transferido',
  'atendimento.encerrado': 'Atendimento encerrado',
  'status.alterado': 'Status alterado',
  'usuario.criado': 'Usuário criado',
  'usuario.papel_alterado': 'Papel alterado',
  'usuario.ativado': 'Usuário ativado',
  'usuario.desativado': 'Usuário desativado',
  'usuario.vinculo_alterado': 'Vínculo de atendente alterado',
};

export const ACOES_FILTRAVEIS = Object.keys(ACAO_LABEL);

export function descreverAcao(acao: string): string {
  return ACAO_LABEL[acao] ?? acao;
}

export interface AuditoriaFiltros {
  acao: string | null;
  atendenteId: number | null;
  de: string | null;
  ate: string | null;
}

export const AUDITORIA_PAGE_SIZE = 25;
