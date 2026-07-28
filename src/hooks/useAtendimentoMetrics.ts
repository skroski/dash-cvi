import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MetricsPeriod, getPeriodStart, bucketKey, bucketLabels } from '@/lib/metricsPeriod';

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
}

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
   * Conversas finalizadas no período — contadas por `conversas_status.fechada_em`
   * (mesmo sinal do filtro "Fechadas" no painel de conversas). É o sinal amplo:
   * pega tanto quem fechou a conversa pelo ciclo de vida quanto quem encerrou um
   * atendimento atribuído. Contar por `atendimentos.encerrado_em` sozinho leria ~0
   * se a equipe fecha conversas sem passar pelo fluxo de atribuição.
   */
  finalizadosPeriodo: number;
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
  tendencia: AtendimentoTrendPoint[];
  emAtendimentoLista: OpenAttendance[];
  finalizadosLista: FinalizedAttendance[];
}

const emptyMetrics: AtendimentoMetrics = {
  kpis: {
    emAtendimento: 0,
    finalizadosPeriodo: 0,
    transferenciasPeriodo: 0,
    tempoMedioMinutos: 0,
  },
  porAtendente: [],
  porDepartamento: [],
  tagsMaisUsadas: [],
  tendencia: [],
  emAtendimentoLista: [],
  finalizadosLista: [],
};

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

async function fetchAtendimentoMetrics(period: MetricsPeriod): Promise<AtendimentoMetrics> {
  const periodStart = getPeriodStart(period);
  const periodStartISO = periodStart.toISOString();

  // ── Tabelas operacionais (todas pequenas). Sem embeds do PostgREST: as
  // relações não são declaradas no schema tipado, então juntamos em JS. ──
  const [
    atendimentosRes,
    atendentesRes,
    departamentosRes,
    tagsRes,
    clientTagsRes,
    clientesRes,
    transferenciasRes,
    conversasStatusRes,
  ] = await Promise.all([
    supabase
      .from('atendimentos')
      .select('id, session_id, client_id, atendente_id, departamento_id, status, created_at, encerrado_em')
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase.from('atendentes').select('id, nome'),
    supabase.from('departamentos').select('id, nome, cor'),
    supabase.from('tags').select('id, nome, cor'),
    supabase.from('client_tags').select('tag_id'),
    supabase.from('dados_cliente').select('id, sessionid, nome, telefone'),
    supabase
      .from('atendimento_transferencias')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', periodStartISO),
    // Conversas finalizadas no período (ciclo de vida). O trigger de reabertura
    // não limpa `fechada_em`, então contar por essa data reflete quem foi
    // finalizado dentro do período mesmo que a conversa tenha reaberto depois.
    supabase
      .from('conversas_status')
      .select('id', { count: 'exact', head: true })
      .gte('fechada_em', periodStartISO),
  ]);

  if (atendimentosRes.error) throw atendimentosRes.error;

  const atendimentos = atendimentosRes.data ?? [];
  const atendentesById = new Map((atendentesRes.data ?? []).map((a) => [a.id, a.nome]));
  const departamentosById = new Map(
    (departamentosRes.data ?? []).map((d) => [d.id, { nome: d.nome, cor: d.cor }])
  );
  const tagsById = new Map((tagsRes.data ?? []).map((t) => [t.id, { nome: t.nome, cor: t.cor }]));

  // dados_cliente usa `sessionid`; atendimentos usa `session_id` + `client_id`.
  // Indexamos por ambos e preferimos o vínculo por client_id (mais confiável).
  const clientById = new Map<number, { nome: string | null; telefone: string | null }>();
  const clientBySession = new Map<string, { nome: string | null; telefone: string | null }>();
  (clientesRes.data ?? []).forEach((c) => {
    clientById.set(c.id, { nome: c.nome, telefone: c.telefone });
    if (c.sessionid) clientBySession.set(c.sessionid, { nome: c.nome, telefone: c.telefone });
  });

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

  const labels = bucketLabels(period);
  const trendAbertos: Record<string, number> = {};
  const trendFinalizados: Record<string, number> = {};
  labels.forEach((l) => {
    trendAbertos[l] = 0;
    trendFinalizados[l] = 0;
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
  (clientTagsRes.data ?? []).forEach((ct) =>
    tagCount.set(ct.tag_id, (tagCount.get(ct.tag_id) ?? 0) + 1)
  );
  const tagsMaisUsadas = [...tagCount.entries()]
    .map(([tagId, value]) => {
      const t = tagsById.get(tagId);
      return { name: t?.nome ?? `Tag ${tagId}`, value, color: t?.cor };
    })
    .sort((a, b) => b.value - a.value);

  const tendencia = labels.map((bucket) => ({
    bucket,
    abertos: trendAbertos[bucket],
    finalizados: trendFinalizados[bucket],
  }));

  return {
    kpis: {
      emAtendimento: emAtendimentoLista.length,
      finalizadosPeriodo: conversasStatusRes.count ?? 0,
      transferenciasPeriodo: transferenciasRes.count ?? 0,
      tempoMedioMinutos: durCount > 0 ? Math.round(durSum / durCount) : 0,
    },
    porAtendente,
    porDepartamento,
    tagsMaisUsadas,
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
