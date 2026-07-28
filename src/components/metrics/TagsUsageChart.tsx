import React from 'react';
import { Tags } from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { NamedCount } from '@/hooks/useAtendimentoMetrics';
import ChartCard from '@/components/shared/ChartCard';
import { chartColor, CHART_GRID_COLOR, CHART_TICK, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

interface TagsUsageChartProps {
  data: NamedCount[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const TagsUsageChart: React.FC<TagsUsageChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  const top = data.slice(0, 10);

  return (
    <ChartCard
      title="Tags Mais Aplicadas"
      description="Marcadores mais presentes nos clientes (base atual)"
      icon={<Tags />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={top.length === 0}
      emptyMessage="Nenhuma tag aplicada aos clientes ainda."
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
              formatter={(value: number) => [value, 'Clientes']}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {top.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || chartColor(index)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default TagsUsageChart;
