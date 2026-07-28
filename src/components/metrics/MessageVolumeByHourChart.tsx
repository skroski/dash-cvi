import React from 'react';
import { BarChart2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { HourlyVolume } from '@/hooks/useChatMetrics';
import ChartCard from '@/components/shared/ChartCard';
import { CHART_GRID_COLOR, CHART_TICK, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

interface MessageVolumeByHourChartProps {
  data: HourlyVolume[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const MessageVolumeByHourChart: React.FC<MessageVolumeByHourChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  const maxVal = Math.max(...data.map(d => d.messages), 1);
  const isEmpty = data.every(d => d.messages === 0);

  return (
    <ChartCard
      title="Volume de Mensagens por Hora"
      description="Distribuição ao longo do dia (todas as sessões)"
      icon={<BarChart2 />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={isEmpty}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis
              dataKey="hour"
              tick={{ ...CHART_TICK, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={2}
            />
            <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              cursor={{ fill: 'hsl(var(--muted))' }}
              formatter={(value: number) => [value, 'Mensagens']}
            />
            <Bar dataKey="messages" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {data.map((entry, index) => {
                const intensity = entry.messages / maxVal;
                const opacity = 0.25 + intensity * 0.75;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill="hsl(var(--chart-1))"
                    fillOpacity={opacity}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default MessageVolumeByHourChart;
