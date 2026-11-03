/** Seleção de destinatários de notificação por evento e escopo. */
export interface Destinatario {
  id?: string;
  nome?: string;
  telefone: string;
  eventos: string[];
  escopo: 'global' | 'unidade' | 'profissional' | 'departamento';
  unidade?: string | null;
  profissional_id?: string | null;
  departamento_id?: number | null;
  ativo: boolean;
}

export interface ContextoNotificacao {
  profissionalId?: string | null;
  unidade?: string | null;
  departamentoId?: number | null;
}

const norm = (valor: unknown) => String(valor ?? '').trim().toLowerCase();

export function selecionarDestinatarios(
  todos: Destinatario[],
  evento: string,
  contexto: ContextoNotificacao = {},
): Destinatario[] {
  const vistos = new Set<string>();
  const resultado: Destinatario[] = [];
  for (const item of todos) {
    if (!item.ativo || !item.eventos.includes(evento)) continue;
    const casa =
      item.escopo === 'global' ||
      (item.escopo === 'profissional' && !!contexto.profissionalId && item.profissional_id === contexto.profissionalId) ||
      (item.escopo === 'unidade' && !!contexto.unidade && norm(item.unidade) === norm(contexto.unidade)) ||
      (item.escopo === 'departamento' && contexto.departamentoId != null && item.departamento_id === contexto.departamentoId);
    if (!casa || vistos.has(item.telefone)) continue;
    vistos.add(item.telefone);
    resultado.push(item);
  }
  return resultado;
}

/** Idempotência: o mesmo evento da mesma conversa não notifica o mesmo número duas vezes. */
export function chaveDedupeNotificacao(parte: string, evento: string, telefone: string): string {
  return `notif:${parte}:${evento}:${telefone}`;
}

export type EventoAgenda = 'agendamento_criado' | 'agendamento_reagendado' | 'agendamento_cancelado';

const TITULO_EVENTO_AGENDA: Record<EventoAgenda, string> = {
  agendamento_criado: '📅 Novo agendamento',
  agendamento_reagendado: '🔁 Agendamento remarcado',
  agendamento_cancelado: '❌ Agendamento cancelado',
};

export function textoEventoAgenda(
  evento: EventoAgenda,
  dados: { servico: string; profissional?: string | null; inicio?: string | null; telefoneCliente?: string | null },
): string {
  return [
    TITULO_EVENTO_AGENDA[evento],
    `Serviço: ${dados.servico}`,
    dados.profissional ? `Profissional: ${dados.profissional}` : '',
    dados.inicio ? `Quando: ${dados.inicio}` : '',
    dados.telefoneCliente ? `Cliente: wa.me/${dados.telefoneCliente}` : '',
  ].filter(Boolean).join('\n');
}
