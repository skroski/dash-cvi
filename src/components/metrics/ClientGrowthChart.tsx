import React from 'react';
import { TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import ChartCard from '@/components/shared/ChartCard';
import { CHART_GRID_COLOR, CHART_TICK, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

interface ClientGrowthChartProps {
  data: Array<{ month: string; clients: number }>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const ClientGrowthChart: React.FC<ClientGrowthChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  const isEmpty = data.length === 0 || data.every(d => d.clients === 0);

  return (
    <ChartCard
      title="Novos Clientes"
      description="Cadastros de clientes no período selecionado"
      icon={<TrendingUp />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={isEmpty}
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="clientsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={CHART_TICK}
            />
            <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} allowDecimals={false} />
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number) => [value, 'Clientes']}
            />
            <Area
              type="monotone"
              dataKey="clients"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="url(#clientsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default ClientGrowthChart;
