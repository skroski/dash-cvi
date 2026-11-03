import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MetricsPeriod, getPeriodStart, bucketKey, bucketLabels } from '@/lib/metricsPeriod';
import { fetchAllRows } from '@/lib/fetchAllRows';

export interface ActivityTrendPoint {
  bucket: string;
  segundos: number;
}

export interface ActivityByUser {
  usuarioId: string;
  nome: string;
  segundosTotal: number;
  diasAtivos: number;
  mediaDiariaSegundos: number;
}

export interface ActivityKPIs {
  segundosTotal: number;
  /** Média diária considerando só os dias em que alguém da equipe registrou atividade. */
  mediaDiariaSegundos: number;
  usuariosAtivosHoje: number;
}

export interface ActivityMetrics {
  kpis: ActivityKPIs;
  tendencia: ActivityTrendPoint[];
  porUsuario: ActivityByUser[];
}

const emptyMetrics: ActivityMetrics = {
  kpis: { segundosTotal: 0, mediaDiariaSegundos: 0, usuariosAtivosHoje: 0 },
  tendencia: [],
  porUsuario: [],
};

const dateToLocalDate = (isoDate: string): Date => new Date(`${isoDate}T00:00:00`);

const todayDateStr = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

async function fetchActivityMetrics(period: MetricsPeriod): Promise<ActivityMetrics> {
  const periodStart = getPeriodStart(period);
  const periodStartStr = periodStart.toISOString().slice(0, 10);

  const rows = await fetchAllRows<{ usuario_id: string; data: string; segundos_ativos: number }>(
    (from, to) =>
      supabase
        .from('atividade_diaria')
        .select('usuario_id, data, segundos_ativos')
        .gte('data', periodStartStr)
        .order('id', { ascending: true })
        .range(from, to)
  );

  // Nomes vêm de profiles — pode não existir ainda se as migrações de
  // perfis/papéis não tiverem sido aplicadas. Degrada para o id truncado.
  const nameById = new Map<string, string>();
  try {
    const { data: profiles, error } = await supabase.from('profiles').select('id, nome, email');
    if (error) throw error;
    (profiles ?? []).forEach((p) => {
      nameById.set(p.id, p.nome || p.email || p.id);
    });
  } catch {
    // setupPendente: segue sem nomes, cada usuário aparece pelo id truncado.
  }

  const trendBuckets: Record<string, number> = {};
  bucketLabels(period).forEach((label) => {
    trendBuckets[label] = 0;
  });

  const perUser = new Map<string, { total: number; dias: Set<string> }>();
  const distinctDates = new Set<string>();
  const today = todayDateStr();
  const activeToday = new Set<string>();

  for (const row of rows) {
    const bk = bucketKey(dateToLocalDate(row.data), period);
    if (bk in trendBuckets) trendBuckets[bk] += row.segundos_ativos;

    distinctDates.add(row.data);
    if (row.data === today) activeToday.add(row.usuario_id);

    const entry = perUser.get(row.usuario_id) ?? { total: 0, dias: new Set<string>() };
    entry.total += row.segundos_ativos;
    entry.dias.add(row.data);
    perUser.set(row.usuario_id, entry);
  }

  const tendencia: ActivityTrendPoint[] = Object.entries(trendBuckets).map(([bucket, segundos]) => ({
    bucket,
    segundos,
  }));

  const porUsuario: ActivityByUser[] = [...perUser.entries()]
    .map(([usuarioId, { total, dias }]) => ({
      usuarioId,
      nome: nameById.get(usuarioId) ?? `Usuário ${usuarioId.slice(0, 8)}`,
      segundosTotal: total,
      diasAtivos: dias.size,
      mediaDiariaSegundos: dias.size > 0 ? Math.round(total / dias.size) : 0,
    }))
    .sort((a, b) => b.segundosTotal - a.segundosTotal);

  const segundosTotal = rows.reduce((sum, r) => sum + r.segundos_ativos, 0);

  return {
    kpis: {
      segundosTotal,
      mediaDiariaSegundos: distinctDates.size > 0 ? Math.round(segundosTotal / distinctDates.size) : 0,
      usuariosAtivosHoje: activeToday.size,
    },
    tendencia,
    porUsuario,
  };
}

export function useActivityMetrics(period: MetricsPeriod = '30d', enabled = true) {
  const query = useQuery({
    queryKey: ['metrics', 'atividade', period],
    queryFn: () => fetchActivityMetrics(period),
    staleTime: 60_000,
    enabled,
  });

  return {
    metrics: query.data ?? emptyMetrics,
    loading: query.isPending && enabled,
    error: query.error ? 'Não foi possível carregar as métricas de atividade.' : null,
    fetchActivityMetrics: query.refetch,
  };
}
