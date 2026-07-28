import React from 'react';
import { UserCog } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { NamedCount } from '@/hooks/useAtendimentoMetrics';
import ChartCard from '@/components/shared/ChartCard';
import { CHART_GRID_COLOR, CHART_TICK, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

interface AttendantsBarChartProps {
  data: NamedCount[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const AttendantsBarChart: React.FC<AttendantsBarChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  // Já vem ordenado por volume (desc); limita aos 10 mais ativos para leitura.
  const top = data.slice(0, 10);

  return (
    <ChartCard
      title="Atendimentos por Atendente"
      description="Quantos atendimentos cada membro da equipe assumiu no período"
      icon={<UserCog />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={top.length === 0}
      emptyMessage="Nenhum atendimento atribuído no período."
    >
      <div style={{ height: Math.max(200, top.length * 38 + 32) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
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
              formatter={(value: number) => [value, 'Atendimentos']}
            />
            <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default AttendantsBarChart;
