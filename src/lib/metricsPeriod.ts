export type MetricsPeriod = '7d' | '30d' | '90d' | '12m';

export const PERIOD_OPTIONS: { value: MetricsPeriod; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: '12m', label: '12 meses' },
];

export const PERIOD_LABELS: Record<MetricsPeriod, string> = {
  '7d': 'últimos 7 dias',
  '30d': 'últimos 30 dias',
  '90d': 'últimos 90 dias',
  '12m': 'últimos 12 meses',
};

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function getPeriodStart(period: MetricsPeriod): Date {
  const now = new Date();
  switch (period) {
    case '7d':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    case '30d':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    case '90d':
      return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    case '12m':
      return new Date(now.getFullYear(), now.getMonth() - 11, 1);
  }
}

/** Períodos curtos usam buckets diários; longos, mensais. */
export const isDailyGranularity = (period: MetricsPeriod): boolean =>
  period === '7d' || period === '30d';

const dayKey = (d: Date): string =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

const monthKey = (d: Date): string =>
  `${MONTH_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;

/** Chave do bucket para uma data, conforme a granularidade do período. */
export const bucketKey = (date: Date, period: MetricsPeriod): string =>
  isDailyGranularity(period) ? dayKey(date) : monthKey(date);

/** Lista ordenada de rótulos de bucket do início do período até hoje. */
export function bucketLabels(period: MetricsPeriod): string[] {
  const labels: string[] = [];
  const start = getPeriodStart(period);
  const now = new Date();

  if (isDailyGranularity(period)) {
    const cursor = new Date(start);
    while (cursor <= now) {
      labels.push(dayKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= now) {
      labels.push(monthKey(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  return labels;
}
