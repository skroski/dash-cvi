import React from 'react';
import { Clock4 } from 'lucide-react';
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ActivityTrendPoint } from '@/hooks/useActivityMetrics';
import { formatDurationShort } from '@/hooks/useAtendimentoMetrics';
import ChartCard from '@/components/shared/ChartCard';
import { CHART_GRID_COLOR, CHART_TICK, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

interface ActivityTrendChartProps {
  data: ActivityTrendPoint[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const ActivityTrendChart: React.FC<ActivityTrendChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  const isEmpty = data.length === 0 || data.every((d) => d.segundos === 0);
  const chartData = data.map((d) => ({ bucket: d.bucket, minutos: Math.round(d.segundos / 60) }));

  return (
    <ChartCard
      title="Atividade no Painel"
      description="Tempo com a aba aberta e em primeiro plano, por dia/mês"
      icon={<Clock4 />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={isEmpty}
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="bucket" axisLine={false} tickLine={false} tick={CHART_TICK} />
            <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} allowDecimals={false} />
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number) => [formatDurationShort(value), 'Tempo ativo']}
            />
            <Area
              type="monotone"
              dataKey="minutos"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              fill="url(#activityGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default ActivityTrendChart;
