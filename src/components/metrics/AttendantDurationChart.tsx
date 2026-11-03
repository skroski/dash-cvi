import React from 'react';
import { Timer } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AttendantDuration, formatDurationShort } from '@/hooks/useAtendimentoMetrics';
import ChartCard from '@/components/shared/ChartCard';
import { CHART_GRID_COLOR, CHART_TICK, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

interface AttendantDurationChartProps {
  data: AttendantDuration[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const AttendantDurationChart: React.FC<AttendantDurationChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  const top = data.slice(0, 10);

  return (
    <ChartCard
      title="Tempo Médio por Atendente"
      description="Da atribuição até o encerramento, por pessoa (atendimentos encerrados no período)"
      icon={<Timer />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={top.length === 0}
      emptyMessage="Nenhum atendimento encerrado no período."
    >
      <div style={{ height: Math.max(200, top.length * 38 + 32) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis
              type="number"
              tick={CHART_TICK}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatDurationShort(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={CHART_TICK}
              tickLine={false}
              axisLine={false}
              width={130}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              cursor={{ fill: 'hsl(var(--muted))' }}
              formatter={(value: number, _name: string, props: any) => [
                `${formatDurationShort(value)} (${props?.payload?.count ?? 0} atend.)`,
                'Tempo médio',
              ]}
            />
            <Bar dataKey="avgMinutes" fill="hsl(var(--chart-5))" radius={[0, 4, 4, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default AttendantDurationChart;
