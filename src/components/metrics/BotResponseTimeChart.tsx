import React from 'react';
import { Timer } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { BotResponsePoint } from '@/hooks/useChatMetrics';
import ChartCard from '@/components/shared/ChartCard';
import { CHART_GRID_COLOR, CHART_TICK, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

interface BotResponseTimeChartProps {
  data: BotResponsePoint[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

const BotResponseTimeChart: React.FC<BotResponseTimeChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  const hasData = data.some(d => d.avgSeconds > 0);
  const avgOverall =
    hasData
      ? Math.round(data.filter(d => d.avgSeconds > 0).reduce((a, b) => a + b.avgSeconds, 0) /
          data.filter(d => d.avgSeconds > 0).length)
      : 0;

  return (
    <ChartCard
      title="Tempo Médio de Resposta do Bot"
      description="Últimos 7 dias — intervalo entre mensagem do cliente e resposta do bot"
      icon={<Timer />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={!hasData}
      emptyMessage="São necessários pares cliente → bot para calcular o tempo de resposta."
      action={
        hasData ? (
          <span className="rounded-full bg-accent px-2 py-1 text-xs font-medium text-accent-foreground tabular-nums">
            Média: {formatSeconds(avgOverall)}
          </span>
        ) : undefined
      }
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis dataKey="day" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ ...CHART_TICK, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatSeconds}
            />
            {avgOverall > 0 && (
              <ReferenceLine
                y={avgOverall}
                stroke="hsl(var(--chart-2))"
                strokeDasharray="4 4"
                label={{ value: 'Média', position: 'right', fontSize: 10, fill: 'hsl(var(--chart-2))' }}
              />
            )}
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number) => [formatSeconds(value), 'Média']}
            />
            <Line
              type="monotone"
              dataKey="avgSeconds"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2.5}
              dot={{ r: 4, fill: 'hsl(var(--chart-1))', strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default BotResponseTimeChart;
