import React from 'react';
import { Scissors } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import ChartCard from '@/components/shared/ChartCard';
import { CHART_GRID_COLOR, CHART_TICK, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

interface Service {
  name: string;
  value: number;
}

interface ServicesBarChartProps {
  data: Service[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const ServicesBarChart: React.FC<ServicesBarChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  return (
    <ChartCard
      title="Serviços Mais Procurados"
      description="Ocorrências de cada serviço entre os clientes"
      icon={<Scissors />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={data.length === 0}
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={CHART_TICK}
              tickLine={false}
              axisLine={false}
              width={110}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              cursor={{ fill: 'hsl(var(--muted))' }}
              formatter={(value: number) => [value, 'Clientes']}
            />
            <Bar
              dataKey="value"
              fill="hsl(var(--chart-3))"
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default ServicesBarChart;
