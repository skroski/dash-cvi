import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MetricsPeriod, getPeriodStart, bucketKey, bucketLabels } from '@/lib/metricsPeriod';
import { fetchAllRows } from '@/lib/fetchAllRows';

/**
 * Métricas operacionais derivadas de atribuições (atendentes/departamentos),
 * ciclo de vida das conversas e tags. Complementa useChatMetrics (que cuida do
 * volume de mensagens e da fila "sem resposta") sem varrer novamente o histórico
 * de mensagens: aqui só lemos as tabelas operacionais, todas pequenas.
 */

export interface NamedCount {
  name: string;
  value: number;
  /** Cor associada (departamento/tag) quando existir. */
  color?: string;
}

export interface AtendimentoTrendPoint {
  bucket: string;
  abertos: number;
  finalizados: number;
  /** Conversas fechadas no bucket — mesma fonte do KPI "Fechados". */
  fechadas: number;
}

/**
 * Um fechamento/arquivamento de conversa já resolvido para exibição.
 * Vem de `conversas_status_eventos` (histórico completo, com autor) quando a
 * migração 20260814100000 estiver aplicada; senão é reconstruído a partir das
 * datas em `conversas_status`.
 */
export interface StatusEvent {
  sessionId: string;
  acao: 'fechada' | 'arquivada';
  em: Date;
  atorNome: string | null;
  atorAtendenteId: number | null;
}

/** Atendimentos de uma sessão, ordenados por abertura (para atribuir autoria). */
export type AtendimentosPorSessao = Map<string, { createdAt: number; atendente: string | null }[]>;

export interface OpenAttendance {
  id: number;
  sessionId: string;
  clientName: string;
  phone: string;
  atendente: string;
  departamento: string;
  departamentoCor?: string;
  createdAt: Date;
  /** Minutos desde a abertura do atendimento (tempo em espera/andamento). */
  waitingMinutes: number;
}

export interface FinalizedAttendance {
  id: number;
  sessionId: string;
  clientName: string;
  phone: string;
  atendente: string;
  departamento: string;
  createdAt: Date;
  finishedAt: Date;
  durationMinutes: number;
}

export interface AtendimentoKPIs {
  /** Atendimentos humanos em andamento agora (status = aberto). */
  emAtendimento: number;
  /**
   * Fechamentos de conversa dentro do período (mesmo sinal do filtro "Fechadas"
   * no painel de conversas). É o sinal amplo: pega tanto quem fechou a conversa
   * pelo ciclo de vida quanto quem encerrou um atendimento atribuído. Contar por
   * `atendimentos.encerrado_em` sozinho leria ~0 se a equipe fecha conversas sem
   * passar pelo fluxo de atribuição.
   *
   * Conta EVENTOS de fechamento, não conversas atualmente fechadas: uma conversa
   * fechada e reaberta no período continua contando (o trabalho aconteceu).
   */
  finalizadosPeriodo: number;
  /** Arquivamentos de conversa no período. */
  arquivadosPeriodo: number;
  /** Transferências entre atendentes/departamentos no período. */
  transferenciasPeriodo: number;
  /** Duração média dos atendimentos encerrados no período (minutos). */
  tempoMedioMinutos: number;
}

export interface AtendimentoMetrics {
  kpis: AtendimentoKPIs;
  porAtendente: NamedCount[];
  porDepartamento: NamedCount[];
  tagsMaisUsadas: NamedCount[];
  /** Fechamentos do período por usuário. Soma sempre = kpis.finalizadosPeriodo. */
  fechadasPorUsuario: NamedCount[];
  /**
   * True quando a autoria dos fechamentos é inferida do atendimento da sessão
   * em vez de vir do histórico com autor (migração 20260814100000 pendente).
   */
  autoriaInferida: boolean;
  tendencia: AtendimentoTrendPoint[];
  emAtendimentoLista: OpenAttendance[];
  finalizadosLista: FinalizedAttendance[];
}

const emptyMetrics: AtendimentoMetrics = {
  kpis: {
    emAtendimento: 0,
    finalizadosPeriodo: 0,
    arquivadosPeriodo: 0,
    transferenciasPeriodo: 0,
    tempoMedioMinutos: 0,
  },
  porAtendente: [],
  porDepartamento: [],
  tagsMaisUsadas: [],
  fechadasPorUsuario: [],
  autoriaInferida: true,
  tendencia: [],
  emAtendimentoLista: [],
  finalizadosLista: [],
};

/** Rótulo dos fechamentos sem autor conhecido nem atendimento na sessão. */
export const SEM_ATRIBUICAO = 'Sem atribuição';

/**
 * Reconstrói os eventos de fechamento/arquivamento a partir das datas de
 * `conversas_status`. Uma linha pode render dois eventos (fechada e depois
 * arquivada) e a mesma sessão nunca rende mais de um fechamento — é a
 * limitação inerente de guardar só a última data por sessão.
 */
export function eventosDeStatusRows(
  rows: { session_id: string; fechada_em: string | null; arquivada_em: string | null }[],
  periodStart: Date
): StatusEvent[] {
  const eventos: StatusEvent[] = [];
  for (const r of rows) {
    const fechada = r.fechada_em ? new Date(r.fechada_em) : null;
    const arquivada = r.arquivada_em ? new Date(r.arquivada_em) : null;
    // A cláusula .or() traz a linha se QUALQUER uma das datas estiver no
    // período; cada evento ainda precisa ser conferido individualmente.
    if (fechada && fechada >= periodStart) {
      eventos.push({ sessionId: r.session_id, acao: 'fechada', em: fechada, atorNome: null, atorAtendenteId: null });
    }
    if (arquivada && arquivada >= periodStart) {
      eventos.push({ sessionId: r.session_id, acao: 'arquivada', em: arquivada, atorNome: null, atorAtendenteId: null });
    }
  }
  return eventos;
}

/**
 * A quem creditar um fechamento: o autor registrado no histórico quando
 * existir; senão o atendente do último atendimento aberto ANTES do fechamento
 * (um mesmo session_id pode acumular vários atendimentos ao longo do tempo).
 */
export function autorDoFechamento(
  evento: StatusEvent,
  atendimentosPorSessao: AtendimentosPorSessao,
  nomePorAtendenteId: Map<number, string>
): string {
  if (evento.atorAtendenteId != null) {
    const nome = nomePorAtendenteId.get(evento.atorAtendenteId);
    if (nome) return nome; // catálogo de atendentes é a fonte única de nomes
  }
  if (evento.atorNome) return evento.atorNome;

  const lista = atendimentosPorSessao.get(evento.sessionId);
  if (!lista) return SEM_ATRIBUICAO;
  const emMs = evento.em.getTime();
  for (let i = lista.length - 1; i >= 0; i--) {
    if (lista[i].createdAt <= emMs) return lista[i].atendente ?? SEM_ATRIBUICAO;
  }
  return SEM_ATRIBUICAO;
}

/** Duração humana e compacta a partir de minutos: 45min, 3h 12min, 2d 4h. */
export function formatDurationShort(minutes: number): string {
  if (minutes <= 0) return '< 1min';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  return `${mins}min`;
}

/**
 * Fechamentos/arquivamentos do período, com a melhor fonte disponível.
 *
 * `conversas_status_eventos` é a fonte correta: registra um evento por
 * transição, com autor. `conversas_status` guarda só a ÚLTIMA data por sessão
 * (upsert), então em fallback a mesma conversa fechada várias vezes conta uma —
 * e um período passado encolhe se a conversa for fechada de novo depois. O
 * fallback existe porque a migração 20260814100000 pode não ter sido aplicada
 * ainda; mesma degradação graciosa de useActivityMetrics com `profiles`.
 */
async function fetchStatusEvents(
  periodStartISO: string
): Promise<{ eventos: StatusEvent[]; comAutor: boolean }> {
  try {
    const rows = await fetchAllRows<{
      session_id: string;
      acao: string;
      ocorrido_em: string;
      ator_nome: string | null;
      ator_atendente_id: number | null;
    }>((from, to) =>
      supabase
        .from('conversas_status_eventos')
        .select('session_id, acao, ocorrido_em, ator_nome, ator_atendente_id')
        .in('acao', ['fechada', 'arquivada'])
        .gte('ocorrido_em', periodStartISO)
        .order('id', { ascending: true })
        .range(from, to)
    );

    // Zero linhas é ambíguo: pode ser um período realmente sem fechamentos ou
    // uma tabela recém-criada/invisível por RLS — e nesse caso confiar nela
    // zeraria um KPI que o fallback ainda leria certo. Só a contagem sem
    // filtro distingue "vazio de verdade" de "não dá para usar".
    if (rows.length === 0) {
      const { count, error } = await supabase
        .from('conversas_status_eventos')
        .select('id', { count: 'exact', head: true });
      if (error || !count) throw error ?? new Error('histórico de status vazio');
    }

    return {
      eventos: rows.map((r) => ({
        sessionId: r.session_id,
        acao: r.acao as 'fechada' | 'arquivada',
        em: new Date(r.ocorrido_em),
        atorNome: r.ator_nome,
        atorAtendenteId: r.ator_atendente_id,
      })),
      comAutor: true,
    };
  } catch {
    // Tabela de histórico ainda não criada: reconstrói pelas datas atuais.
    // As aspas no .or() blindam o valor contra a análise do PostgREST, que
    // separa campo/operador/valor por ponto (e o ISO tem `.000Z`).
    const rows = await fetchAllRows<{
      session_id: string;
      fechada_em: string | null;
      arquivada_em: string | null;
    }>((from, to) =>
      supabase
        .from('conversas_status')
        .select('session_id, fechada_em, arquivada_em')
        .or(`fechada_em.gte."${periodStartISO}",arquivada_em.gte."${periodStartISO}"`)
        .order('id', { ascending: true })
        .range(from, to)
    );

    return { eventos: eventosDeStatusRows(rows, new Date(periodStartISO)), comAutor: false };
  }
}

async function fetchAtendimentoMetrics(period: MetricsPeriod): Promise<AtendimentoMetrics> {
  const periodStart = getPeriodStart(period);
  const periodStartISO = periodStart.toISOString();

  // ── Tabelas operacionais. atendentes/departamentos/tags são catálogos
  // pequenos (dezenas de linhas) e não precisam paginar; atendimentos,
  // ── Busca de dados principais com filtros de período para não baixar
  // histórico antigo desnecessariamente nem a base inteira de 10k clientes ──
  const [
    atendimentos,
    atendentesRes,
    departamentosRes,
    tagsRes,
    clientTags,
    transferenciasRes,
    statusEventos,
  ] = await Promise.all([
    fetchAllRows<{
      id: number;
      session_id: string;
      client_id: number | null;
      atendente_id: number | null;
      departamento_id: number | null;
      status: string;
      created_at: string;
      encerrado_em: string | null;
    }>((from, to) =>
      supabase
        .from('atendimentos')
        .select('id, session_id, client_id, atendente_id, departamento_id, status, created_at, encerrado_em')
        .or(`created_at.gte.${periodStartISO},status.eq.aberto`)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    supabase.from('atendentes').select('id, nome'),
    supabase.from('departamentos').select('id, nome, cor'),
    supabase.from('tags').select('id, nome, cor'),
    fetchAllRows<{ tag_id: number }>((from, to) =>
      supabase.from('client_tags').select('tag_id').order('tag_id', { ascending: true }).range(from, to)
    ),
    supabase
      .from('atendimento_transferencias')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', periodStartISO),
    // Ciclo de vida das conversas: fechamentos e arquivamentos do período.
    fetchStatusEvents(periodStartISO),
  ]);

  const atendentesById = new Map((atendentesRes.data ?? []).map((a) => [a.id, a.nome]));
  const departamentosById = new Map(
    (departamentosRes.data ?? []).map((d) => [d.id, { nome: d.nome, cor: d.cor }])
  );
  const tagsById = new Map((tagsRes.data ?? []).map((t) => [t.id, { nome: t.nome, cor: t.cor }]));

  // ── Busca pontual APENAS dos clientes presentes nos atendimentos retornados ──
  // Antes baixava 10.000 clientes da tabela inteira via fetchAllRows gerando pico de Egress.
  const relevantClientIds = Array.from(new Set(atendimentos.map((a) => a.client_id).filter((id): id is number => id != null)));
  const relevantSessionIds = Array.from(new Set(atendimentos.map((a) => a.session_id).filter(Boolean)));

  const clientById = new Map<number, { nome: string | null; telefone: string | null }>();
  const clientBySession = new Map<string, { nome: string | null; telefone: string | null }>();

  if (relevantClientIds.length > 0 || relevantSessionIds.length > 0) {
    try {
      let query = supabase.from('dados_cliente').select('id, sessionid, nome, telefone');
      if (relevantClientIds.length > 0) {
        query = query.in('id', relevantClientIds.slice(0, 200));
      } else {
        query = query.in('sessionid', relevantSessionIds.slice(0, 200));
      }
      const { data: clientesData } = await query;
      (clientesData || []).forEach((c) => {
        clientById.set(c.id, { nome: c.nome, telefone: c.telefone });
        if (c.sessionid) clientBySession.set(c.sessionid, { nome: c.nome, telefone: c.telefone });
      });
    } catch (err) {
      console.warn('Falha ao resolver dados pontuais de clientes de atendimentos:', err);
    }
  }

  const resolveClient = (clientId: number | null, sessionId: string) => {
    const byId = clientId != null ? clientById.get(clientId) : undefined;
    const bySession = clientBySession.get(sessionId);
    return {
      nome: byId?.nome ?? bySession?.nome ?? 'Desconhecido',
      telefone: byId?.telefone ?? bySession?.telefone ?? sessionId,
    };
  };

  const now = Date.now();
  const emAtendimentoLista: OpenAttendance[] = [];
  const finalizadosLista: FinalizedAttendance[] = [];
  const porAtendenteMap = new Map<string, number>();
  const porDepartamentoMap = new Map<number, number>();

  // Atendimentos por sessão (ordenados por abertura) para atribuir um
  // fechamento de conversa a quem estava atendendo naquele momento.
  const atendimentosPorSessao: AtendimentosPorSessao = new Map();

  const labels = bucketLabels(period);
  const trendAbertos: Record<string, number> = {};
  const trendFinalizados: Record<string, number> = {};
  const trendFechadas: Record<string, number> = {};
  labels.forEach((l) => {
    trendAbertos[l] = 0;
    trendFinalizados[l] = 0;
    trendFechadas[l] = 0;
  });

  let durSum = 0;
  let durCount = 0;

  for (const a of atendimentos) {
    const createdAt = new Date(a.created_at);
    const inPeriodCreated = createdAt >= periodStart;
    const client = resolveClient(a.client_id, a.session_id);
    const atendenteNome =
      a.atendente_id != null ? atendentesById.get(a.atendente_id) ?? 'Sem atendente' : 'Sem atendente';
    const dept = a.departamento_id != null ? departamentosById.get(a.departamento_id) : undefined;
    const deptNome = dept?.nome ?? 'Sem departamento';

    const daSessao = atendimentosPorSessao.get(a.session_id) ?? [];
    daSessao.push({
      createdAt: createdAt.getTime(),
      atendente: a.atendente_id != null ? atendentesById.get(a.atendente_id) ?? null : null,
    });
    atendimentosPorSessao.set(a.session_id, daSessao);

    // Distribuição por atendente/departamento: atendimentos abertos no período
    if (inPeriodCreated) {
      porAtendenteMap.set(atendenteNome, (porAtendenteMap.get(atendenteNome) ?? 0) + 1);
      const deptKey = a.departamento_id ?? -1;
      porDepartamentoMap.set(deptKey, (porDepartamentoMap.get(deptKey) ?? 0) + 1);
      const bk = bucketKey(createdAt, period);
      if (bk in trendAbertos) trendAbertos[bk]++;
    }

    if (a.status === 'aberto') {
      emAtendimentoLista.push({
        id: a.id,
        sessionId: a.session_id,
        clientName: client.nome,
        phone: client.telefone,
        atendente: atendenteNome,
        departamento: deptNome,
        departamentoCor: dept?.cor,
        createdAt,
        waitingMinutes: Math.max(0, Math.floor((now - createdAt.getTime()) / 60000)),
      });
    } else if (a.status === 'encerrado' && a.encerrado_em) {
      // "Finalizados" conta por encerrado_em no período (a tabela de atendimentos
      // não sofre reabertura automática como conversas_status, então é confiável).
      const finishedAt = new Date(a.encerrado_em);
      if (finishedAt >= periodStart) {
        const durationMinutes = Math.max(0, Math.floor((finishedAt.getTime() - createdAt.getTime()) / 60000));
        durSum += durationMinutes;
        durCount++;
        finalizadosLista.push({
          id: a.id,
          sessionId: a.session_id,
          clientName: client.nome,
          phone: client.telefone,
          atendente: atendenteNome,
          departamento: deptNome,
          createdAt,
          finishedAt,
          durationMinutes,
        });
        const bk = bucketKey(finishedAt, period);
        if (bk in trendFinalizados) trendFinalizados[bk]++;
      }
    }
  }

  // Tabelas ordenadas por tempo: fila mais antiga primeiro; finalizados, o mais
  // recente primeiro.
  emAtendimentoLista.sort((a, b) => b.waitingMinutes - a.waitingMinutes);
  finalizadosLista.sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime());

  // Gráficos categóricos ordenados por volume (desc).
  const porAtendente = [...porAtendenteMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const porDepartamento = [...porDepartamentoMap.entries()]
    .map(([id, value]) => {
      const d = id === -1 ? undefined : departamentosById.get(id);
      return { name: d?.nome ?? 'Sem departamento', value, color: d?.cor };
    })
    .sort((a, b) => b.value - a.value);

  const tagCount = new Map<number, number>();
  clientTags.forEach((ct) =>
    tagCount.set(ct.tag_id, (tagCount.get(ct.tag_id) ?? 0) + 1)
  );
  const tagsMaisUsadas = [...tagCount.entries()]
    .map(([tagId, value]) => {
      const t = tagsById.get(tagId);
      return { name: t?.nome ?? `Tag ${tagId}`, value, color: t?.cor };
    })
    .sort((a, b) => b.value - a.value);

  // ── Ciclo de vida das conversas ──
  // `autorDoFechamento` depende da ordem cronológica dentro de cada sessão.
  atendimentosPorSessao.forEach((lista) => lista.sort((x, y) => x.createdAt - y.createdAt));

  const fechadasPorUsuarioMap = new Map<string, number>();
  let fechadasPeriodo = 0;
  let arquivadasPeriodo = 0;

  for (const evento of statusEventos.eventos) {
    if (evento.acao === 'arquivada') {
      arquivadasPeriodo++;
      continue;
    }
    fechadasPeriodo++;
    const autor = autorDoFechamento(evento, atendimentosPorSessao, atendentesById);
    fechadasPorUsuarioMap.set(autor, (fechadasPorUsuarioMap.get(autor) ?? 0) + 1);
    const bk = bucketKey(evento.em, period);
    // A soma da série bate com o KPI, salvo um caso improvável: `fechada_em` é
    // gravado com o relógio do navegador, então um cliente adiantado pode gerar
    // um evento com data futura, fora dos buckets. Ele conta no KPI e some da
    // linha — preferível a inventar um bucket que não existe no eixo.
    if (bk in trendFechadas) trendFechadas[bk]++;
  }

  // "Sem atribuição" sempre por último: é ruído de dado, não desempenho de
  // ninguém, e no topo da barra horizontal roubaria a leitura do ranking.
  const fechadasPorUsuario = [...fechadasPorUsuarioMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => {
      if (a.name === SEM_ATRIBUICAO) return 1;
      if (b.name === SEM_ATRIBUICAO) return -1;
      return b.value - a.value;
    });

  const tendencia = labels.map((bucket) => ({
    bucket,
    abertos: trendAbertos[bucket],
    finalizados: trendFinalizados[bucket],
    fechadas: trendFechadas[bucket],
  }));

  return {
    kpis: {
      emAtendimento: emAtendimentoLista.length,
      finalizadosPeriodo: fechadasPeriodo,
      arquivadosPeriodo: arquivadasPeriodo,
      transferenciasPeriodo: transferenciasRes.count ?? 0,
      tempoMedioMinutos: durCount > 0 ? Math.round(durSum / durCount) : 0,
    },
    porAtendente,
    porDepartamento,
    tagsMaisUsadas,
    fechadasPorUsuario,
    autoriaInferida: !statusEventos.comAutor,
    tendencia,
    emAtendimentoLista,
    finalizadosLista,
  };
}

export function useAtendimentoMetrics(period: MetricsPeriod = '30d', enabled = true) {
  const query = useQuery({
    queryKey: ['metrics', 'atendimentos', period],
    queryFn: () => fetchAtendimentoMetrics(period),
    staleTime: 60_000,
    enabled,
  });

  return {
    metrics: query.data ?? emptyMetrics,
    loading: query.isPending && enabled,
    error: query.error ? 'Não foi possível carregar as métricas de atendimento.' : null,
    fetchAtendimentoMetrics: query.refetch,
  };
}
