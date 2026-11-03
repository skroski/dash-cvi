import React from 'react';
import { Activity } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { AtendimentoTrendPoint } from '@/hooks/useAtendimentoMetrics';
import ChartCard from '@/components/shared/ChartCard';
import { CHART_GRID_COLOR, CHART_TICK, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

interface AtendimentoTrendChartProps {
  data: AtendimentoTrendPoint[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const AtendimentoTrendChart: React.FC<AtendimentoTrendChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  const total = data.reduce((s, d) => s + d.abertos + d.finalizados + d.fechadas, 0);

  return (
    <ChartCard
      title="Ciclo de Vida ao Longo do Tempo"
      // As duas primeiras séries vêm de `atendimentos` (fluxo de atribuição); a
      // terceira, de `conversas_status` — é a que soma o KPI "Fechados".
      description="Atendimentos atribuídos e encerrados pela equipe, e conversas fechadas (ordem cronológica)"
      icon={<Activity />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={data.length === 0 || total === 0}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis dataKey="bucket" axisLine={false} tickLine={false} tick={CHART_TICK} />
            <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} allowDecimals={false} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend
              iconType="plainline"
              formatter={(value) => <span style={{ fontSize: 12, color: 'inherit' }}>{value}</span>}
            />
            <Line
              type="monotone"
              dataKey="abertos"
              name="Atendimentos atribuídos"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="finalizados"
              name="Atendimentos encerrados"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="fechadas"
              name="Conversas fechadas"
              stroke="hsl(var(--chart-3))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default AtendimentoTrendChart;
