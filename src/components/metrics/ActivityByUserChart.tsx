import React from 'react';
import { Users } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ActivityByUser } from '@/hooks/useActivityMetrics';
import { formatDurationShort } from '@/hooks/useAtendimentoMetrics';
import ChartCard from '@/components/shared/ChartCard';
import { CHART_GRID_COLOR, CHART_TICK, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

interface ActivityByUserChartProps {
  data: ActivityByUser[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const ActivityByUserChart: React.FC<ActivityByUserChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  // Já vem ordenado por tempo total (desc); limita aos 10 mais ativos para leitura.
  const top = data.slice(0, 10).map((u) => ({ name: u.nome, minutos: Math.round(u.segundosTotal / 60) }));

  return (
    <ChartCard
      title="Atividade por Usuário"
      description="Tempo total com o painel aberto e em primeiro plano no período"
      icon={<Users />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={top.length === 0}
      emptyMessage="Nenhuma atividade registrada no período."
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
              formatter={(value: number) => [formatDurationShort(value), 'Tempo ativo']}
            />
            <Bar dataKey="minutos" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default ActivityByUserChart;
