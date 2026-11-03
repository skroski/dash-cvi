import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { NamedCount, SEM_ATRIBUICAO } from '@/hooks/useAtendimentoMetrics';
import ChartCard from '@/components/shared/ChartCard';
import { CHART_GRID_COLOR, CHART_TICK, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

interface ClosedByUserChartProps {
  data: NamedCount[];
  /** Autoria inferida do atendimento da sessão (histórico com autor indisponível). */
  inferida?: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const ClosedByUserChart: React.FC<ClosedByUserChartProps> = ({
  data,
  inferida = false,
  loading = false,
  error = null,
  onRetry,
}) => {
  // Top 10 por volume, mas "Sem atribuição" fica fora do corte e sempre aparece
  // por último: é justamente a barra que não pode sumir, senão o gráfico deixa
  // de somar o KPI sem avisar.
  const semAtribuicao = data.find((d) => d.name === SEM_ATRIBUICAO);
  const top = [...data.filter((d) => d.name !== SEM_ATRIBUICAO).slice(0, 10)];
  if (semAtribuicao) top.push(semAtribuicao);

  return (
    <ChartCard
      title="Conversas Fechadas por Usuário"
      description={
        inferida
          ? 'Fechamentos no período, atribuídos ao atendente do atendimento da conversa'
          : 'Fechamentos no período, por quem fechou a conversa'
      }
      icon={<CheckCircle2 />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={top.length === 0}
      emptyMessage="Nenhuma conversa fechada no período."
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
              formatter={(value: number) => [value, 'Fechamentos']}
            />
            <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default ClosedByUserChart;
