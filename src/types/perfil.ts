export type Papel = 'admin' | 'lider' | 'atendente' | 'veterinario' | 'totem';

export interface Perfil {
  id: string;
  nome: string | null;
  email: string | null;
  papel: Papel;
  atendenteId: number | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export const PAPEL_LABEL: Record<Papel, string> = {
  admin: 'Administrador',
  lider: 'Líder',
  atendente: 'Atendente',
  veterinario: 'Veterinário',
  totem: 'Totem',
};

export const PAPEL_DESCRICAO: Record<Papel, string> = {
  admin: 'Enxerga toda a operação, gerencia usuários e consulta a auditoria completa.',
  lider: 'Acompanha a equipe, atribui atendimentos e consulta a auditoria da equipe.',
  atendente: 'Trabalha nos próprios atendimentos e controla o próprio status.',
  veterinario: 'Visão simplificada com foco na agenda e chamada de pacientes no consultório.',
  totem: 'Aparelho de autoatendimento na entrada: só emite senha da fila. O bloqueio dos demais dados é feito por regras no banco (ver a auditoria de segurança da fila).',
};

export const PAPEIS: Papel[] = ['admin', 'lider', 'atendente', 'veterinario', 'totem'];

// ---------------------------------------------------------------------------
// Status operacional
// ---------------------------------------------------------------------------

export type StatusOperacional =
  | 'disponivel'
  | 'em_atendimento'
  | 'almoco'
  | 'pausa'
  | 'reuniao'
  | 'offline';

export interface StatusAtendente {
  atendenteId: number;
  status: StatusOperacional;
  motivo: string | null;
  previsaoRetorno: string | null;
  alteradoEm: string;
  alteradoPor: string | null;
}

export interface StatusHistorico {
  id: number;
  atendenteId: number;
  statusAnterior: StatusOperacional | null;
  status: StatusOperacional;
  motivo: string | null;
  alteradoPor: string | null;
  iniciadoEm: string;
  encerradoEm: string | null;
}

interface StatusMeta {
  label: string;
  /** Se o atendente segue elegível a receber novos atendimentos neste status. */
  recebeAtribuicao: boolean;
  /** Frase curta mostrada ao trocar de status, explicando o efeito prático. */
  efeito: string;
  /** Classes do badge (mesmos tokens do design system). */
  badge: string;
  dot: string;
}

export const STATUS_META: Record<StatusOperacional, StatusMeta> = {
  disponivel: {
    label: 'Disponível',
    recebeAtribuicao: true,
    efeito: 'Você aparece como disponível e pode receber novos atendimentos.',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  em_atendimento: {
    label: 'Em atendimento',
    recebeAtribuicao: true,
    efeito: 'Você segue visível para a equipe como ocupado em um atendimento.',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  almoco: {
    label: 'Almoço',
    recebeAtribuicao: false,
    efeito:
      'Você continuará vendo seus atendimentos atuais, mas não receberá novas atribuições automáticas.',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  pausa: {
    label: 'Pausa',
    recebeAtribuicao: false,
    efeito:
      'Seus atendimentos atuais continuam com você, mas você não receberá novas atribuições automáticas.',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
    dot: 'bg-orange-500',
  },
  reuniao: {
    label: 'Reunião',
    recebeAtribuicao: false,
    efeito:
      'Seus atendimentos atuais continuam com você, mas você não receberá novas atribuições automáticas.',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
  offline: {
    label: 'Indisponível',
    recebeAtribuicao: false,
    efeito: 'Você não aparece como disponível e não recebe novas atribuições.',
    badge: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
};

export const STATUS_ORDEM: StatusOperacional[] = [
  'disponivel',
  'em_atendimento',
  'almoco',
  'pausa',
  'reuniao',
  'offline',
];

export function isStatusOperacional(value: string): value is StatusOperacional {
  return value in STATUS_META;
}

/** Formata a duração no status atual (ex.: "1h 20min"). */
export function formatarTempoNoStatus(desde: string, agora: number = Date.now()): string {
  const inicio = new Date(desde).getTime();
  if (!Number.isFinite(inicio)) return '';
  const minutos = Math.max(0, Math.floor((agora - inicio) / 60_000));
  if (minutos < 1) return 'agora há pouco';
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas < 24) return resto === 0 ? `${horas}h` : `${horas}h ${resto}min`;
  const dias = Math.floor(horas / 24);
  return `${dias}d ${horas % 24}h`;
}
