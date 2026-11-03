/**
 * Motor de horários da agenda (puro, sem I/O): gera os horários livres de uma ou
 * mais agendas a partir da jornada cadastrada, descontando almoço/pausas,
 * feriados, eventos já existentes no calendário, passado e antecedência mínima.
 * Todo o cálculo é feito no fuso da empresa — nada de `-03:00` fixo.
 */
import {
  dataKeyDoInstante, diaDaSemana, diferencaDias, formatarDataBR, horaTexto, instanteLocal, isoLocal,
  minutoDoDiaNoFuso, nomeDiaSemana, somarDias,
} from './fuso.ts';
import { gerarHorarios, horaMinutos } from './agenda_slots.ts';

export interface JanelaMotor {
  dia_semana: number;
  inicio: string;
  fim: string;
  ultimo_inicio?: string | null;
  recorrencia?: string | null;
  ancora_quinzenal?: string | null;
}

export interface IntervaloMotor {
  dia_semana?: number | null;
  data_especifica?: string | null;
  inicio: string;
  fim: string;
  ativo?: boolean | null;
}

export interface FeriadoMotor {
  data: string;
  dia_inteiro: boolean;
  inicio?: string | null;
  fim?: string | null;
  regra_id?: string | null;
}

export interface EventoOcupado {
  id?: string;
  inicioMs: number;
  fimMs: number;
}

export interface AgendaMotor {
  regraId: string;
  profissionalId: string | null;
  profissionalNome: string;
  /** Minutos de cada atendimento. */
  duracao: number;
  /** De quanto em quanto tempo um horário é oferecido. */
  passo: number;
  antecedenciaMin: number;
  capacidade: number;
  janelas: JanelaMotor[];
  intervalos: IntervaloMotor[];
  feriados: FeriadoMotor[];
  ocupados: EventoOcupado[];
}

export interface SlotMotor {
  data: string;
  inicio: string;
  fim: string;
  inicioMin: number;
  fimMin: number;
  inicioMs: number;
  fimMs: number;
  dateStart: string;
  dateFinish: string;
  regraId: string;
  profissionalId: string | null;
  profissional: string;
}

export interface ContextoMotor {
  fuso: string;
  agoraMs: number;
  /** Ignora este evento ao checar conflito (remarcação do próprio evento). */
  ignorarEventoId?: string;
}

/** Segunda-feira da semana de `dataKey` (semanas começam na segunda). */
export function segundaDaSemana(dataKey: string): string {
  return somarDias(dataKey, -((diaDaSemana(dataKey) + 6) % 7));
}

/** A jornada vale nesta data? (dia da semana + recorrência quinzenal com âncora) */
export function janelaAplica(janela: JanelaMotor, dataKey: string): boolean {
  if (janela.dia_semana !== diaDaSemana(dataKey)) return false;
  if ((janela.recorrencia ?? 'semanal') !== 'quinzenal') return true;
  if (!janela.ancora_quinzenal) return false;
  const semanas = diferencaDias(segundaDaSemana(dataKey), segundaDaSemana(janela.ancora_quinzenal.slice(0, 10))) / 7;
  return Math.round(semanas) % 2 === 0;
}

export function slotsDoDia(agenda: AgendaMotor, dataKey: string, ctx: ContextoMotor): SlotMotor[] {
  const doDia = agenda.janelas.filter((janela) => janelaAplica(janela, dataKey));
  if (!doDia.length) return [];

  const feriados = agenda.feriados.filter((f) => f.data === dataKey && (!f.regra_id || f.regra_id === agenda.regraId));
  if (feriados.some((f) => f.dia_inteiro)) return [];

  const weekday = diaDaSemana(dataKey);
  const bloqueios: Array<[number, number]> = [
    ...agenda.intervalos
      .filter((i) => i.ativo !== false && (i.data_especifica ? i.data_especifica.slice(0, 10) === dataKey : i.dia_semana === weekday))
      .map((i) => [horaMinutos(i.inicio), horaMinutos(i.fim)] as [number, number]),
    ...feriados.filter((f) => !f.dia_inteiro && f.inicio && f.fim).map((f) => [horaMinutos(f.inicio!), horaMinutos(f.fim!)] as [number, number]),
  ];

  const limiteMs = ctx.agoraMs + agenda.antecedenciaMin * 60_000;
  const resultado: SlotMotor[] = [];
  const vistos = new Set<number>();

  for (const janela of doDia) {
    const horarios = gerarHorarios({
      inicio: horaMinutos(janela.inicio),
      fim: horaMinutos(janela.fim),
      ultimoInicio: janela.ultimo_inicio ? horaMinutos(janela.ultimo_inicio) : null,
      duracao: agenda.duracao,
      passo: agenda.passo,
      bloqueios,
    });
    for (const horario of horarios) {
      if (vistos.has(horario.inicio)) continue;
      const inicioMs = instanteLocal(ctx.fuso, dataKey, horario.inicio).getTime();
      const fimMs = instanteLocal(ctx.fuso, dataKey, horario.fim).getTime();
      if (inicioMs <= limiteMs) continue;
      const sobrepostos = agenda.ocupados.filter((e) =>
        e.id !== ctx.ignorarEventoId && inicioMs < e.fimMs && fimMs > e.inicioMs).length;
      if (sobrepostos >= Math.max(1, agenda.capacidade)) continue;
      vistos.add(horario.inicio);
      resultado.push({
        data: dataKey,
        inicio: horaTexto(horario.inicio),
        fim: horaTexto(horario.fim),
        inicioMin: horario.inicio,
        fimMin: horario.fim,
        inicioMs,
        fimMs,
        dateStart: isoLocal(ctx.fuso, dataKey, horario.inicio),
        dateFinish: isoLocal(ctx.fuso, dataKey, horario.fim),
        regraId: agenda.regraId,
        profissionalId: agenda.profissionalId,
        profissional: agenda.profissionalNome,
      });
    }
  }
  return resultado.sort((a, b) => a.inicioMs - b.inicioMs);
}

export interface OpcoesBusca {
  /** Data (AAAA-MM-DD) a partir da qual (ou em torno da qual) buscar; vazio = hoje. */
  dataReferencia?: string | null;
  horizonteDias: number;
  maxDiasComVaga: number;
  maxHorariosPorDia: number;
  ordem: 'proximos' | 'em_torno_da_data';
}

export interface DiaComVagas {
  data: string;
  diaSemana: string;
  horarios: SlotMotor[];
}

/** Datas candidatas na ordem de busca (nunca antes de hoje). */
export function datasParaBuscar(hoje: string, opcoes: Pick<OpcoesBusca, 'dataReferencia' | 'horizonteDias' | 'ordem'>): string[] {
  const horizonte = Math.max(1, opcoes.horizonteDias);
  const referencia = opcoes.dataReferencia && opcoes.dataReferencia > hoje ? opcoes.dataReferencia : hoje;
  const candidatas: string[] = [];
  if (opcoes.ordem === 'em_torno_da_data' && opcoes.dataReferencia) {
    candidatas.push(opcoes.dataReferencia);
    for (let d = 1; d < horizonte; d++) {
      candidatas.push(somarDias(opcoes.dataReferencia, d), somarDias(opcoes.dataReferencia, -d));
    }
  } else {
    for (let d = 0; d < horizonte; d++) candidatas.push(somarDias(referencia, d));
  }
  return [...new Set(candidatas)].filter((data) => data >= hoje);
}

export function buscarHorarios(agendas: AgendaMotor[], ctx: ContextoMotor, opcoes: OpcoesBusca): DiaComVagas[] {
  const hoje = dataKeyDoInstante(ctx.agoraMs, ctx.fuso);
  const dias: DiaComVagas[] = [];
  for (const data of datasParaBuscar(hoje, opcoes)) {
    if (dias.length >= opcoes.maxDiasComVaga) break;
    const horarios = agendas
      .flatMap((agenda) => slotsDoDia(agenda, data, ctx))
      .sort((a, b) => a.inicioMs - b.inicioMs || a.profissional.localeCompare(b.profissional))
      .slice(0, opcoes.maxHorariosPorDia);
    if (horarios.length) dias.push({ data, diaSemana: nomeDiaSemana(diaDaSemana(data)), horarios });
  }
  // No modo "em torno da data" a lista final sai em ordem cronológica.
  return opcoes.ordem === 'em_torno_da_data' ? dias.sort((a, b) => a.data.localeCompare(b.data)) : dias;
}

/** Slot que começa exatamente em `inicioMs`; com vários profissionais livres, o menos ocupado no dia. */
export function escolherSlot(
  agendas: AgendaMotor[],
  ctx: ContextoMotor,
  inicioMs: number,
  profissionalPedido?: string | null,
): SlotMotor | undefined {
  const data = dataKeyDoInstante(inicioMs, ctx.fuso);
  const pedido = (profissionalPedido ?? '').trim().toLowerCase();
  const candidatos = agendas
    .filter((agenda) => !pedido || agenda.regraId === pedido || agenda.profissionalNome.toLowerCase() === pedido)
    .map((agenda) => ({
      agenda,
      slot: slotsDoDia(agenda, data, ctx).find((s) => s.inicioMs === inicioMs),
    }))
    .filter((item): item is { agenda: AgendaMotor; slot: SlotMotor } => !!item.slot);
  const carga = (agenda: AgendaMotor) => agenda.ocupados.filter((e) => {
    const dia = dataKeyDoInstante(e.inicioMs, ctx.fuso);
    return dia === data;
  }).length;
  candidatos.sort((a, b) => carga(a.agenda) - carga(b.agenda) || a.agenda.profissionalNome.localeCompare(b.agenda.profissionalNome));
  return candidatos[0]?.slot;
}

// ---------------------------------------------------------------------------
// Eventos do Google Calendar -> intervalos ocupados
// ---------------------------------------------------------------------------

interface EventoGoogle {
  id?: string;
  status?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/**
 * Converte os itens da API do Google em intervalos ocupados. Evento de dia inteiro bloqueia
 * o dia todo no fuso da empresa (o fim do Google é exclusivo); cancelado ou marcado como
 * "livre" não bloqueia.
 */
export function eventosOcupados(itens: unknown, fuso: string): EventoOcupado[] {
  if (!Array.isArray(itens)) return [];
  const resultado: EventoOcupado[] = [];
  for (const bruto of itens as EventoGoogle[]) {
    if (bruto?.status === 'cancelled' || bruto?.transparency === 'transparent') continue;
    const inicio = bruto?.start?.dateTime ?? bruto?.start?.date;
    const fim = bruto?.end?.dateTime ?? bruto?.end?.date;
    if (!inicio) continue;
    const diaInteiro = !bruto?.start?.dateTime;
    const inicioMs = diaInteiro ? instanteLocal(fuso, inicio.slice(0, 10), 0).getTime() : Date.parse(inicio);
    let fimMs = fim
      ? (diaInteiro ? instanteLocal(fuso, fim.slice(0, 10), 0).getTime() : Date.parse(fim))
      : inicioMs + 60_000;
    if (!Number.isFinite(inicioMs)) continue;
    if (!Number.isFinite(fimMs) || fimMs <= inicioMs) fimMs = inicioMs + 60_000;
    resultado.push({ id: bruto.id, inicioMs, fimMs });
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// Texto para o cliente (WhatsApp)
// ---------------------------------------------------------------------------

export interface TextoHorarios {
  servicoNome: string;
  dias: DiaComVagas[];
  duracaoMinutos: number;
  mostrarProfissional: boolean;
  /** Quantas datas / horários por data compor na mensagem. */
  maxDatas: number;
  maxHorarios: number;
  /** A data pedida não tinha vaga: as demais são alternativas. */
  dataSolicitada?: string | null;
  dataSolicitadaIndisponivel?: boolean;
  horizonteDias: number;
}

export function mensagemHorarios(opcoes: TextoHorarios): string {
  if (!opcoes.dias.length) {
    return opcoes.dataSolicitada
      ? `⚠️ Não encontrei horários disponíveis para ${opcoes.servicoNome} próximos de ${formatarDataBR(opcoes.dataSolicitada)}.`
      : `⚠️ Não encontrei horários disponíveis para ${opcoes.servicoNome} nos próximos ${opcoes.horizonteDias} dias.`;
  }
  const blocos = opcoes.dias.slice(0, opcoes.maxDatas).map((dia) => {
    const linhas = dia.horarios.slice(0, opcoes.maxHorarios).map((h) =>
      `🕒 ${h.inicio} às ${h.fim}${opcoes.mostrarProfissional ? ` — ${h.profissional}` : ''}`);
    return `📅 *${dia.diaSemana}, ${formatarDataBR(dia.data)}*\n${linhas.join('\n')}`;
  });
  const titulo = opcoes.dataSolicitadaIndisponivel && opcoes.dataSolicitada
    ? `O horário solicitado (${formatarDataBR(opcoes.dataSolicitada)}) está indisponível. Confira os horários que temos disponíveis`
    : `Próximos horários disponíveis — ${opcoes.servicoNome}`;
  return `✅ *${titulo}:*\n\n${blocos.join('\n\n')}\n\n⏰ Duração do atendimento: ${opcoes.duracaoMinutos} minutos.`;
}

/** Minuto do dia (no fuso) de um instante — usado para detectar "data com hora". */
export const minutoLocal = minutoDoDiaNoFuso;
