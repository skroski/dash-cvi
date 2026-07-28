import React from 'react';
import { CalendarDays } from 'lucide-react';
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
import { WeekdayVolume } from '@/hooks/useChatMetrics';
import ChartCard from '@/components/shared/ChartCard';
import { CHART_GRID_COLOR, CHART_TICK, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

interface ChatVolumeByWeekdayChartProps {
  data: WeekdayVolume[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const isWeekend = (day: string) => day === 'Dom' || day === 'Sáb';

const ChatVolumeByWeekdayChart: React.FC<ChatVolumeByWeekdayChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  const isEmpty = data.every(d => d.conversations === 0);

  return (
    <ChartCard
      title="Mensagens por Dia da Semana"
      description="Fins de semana em destaque (laranja)"
      icon={<CalendarDays />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={isEmpty}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis dataKey="day" tick={CHART_TICK} tickLine={false} axisLine={false} />
            <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              cursor={{ fill: 'hsl(var(--muted))' }}
              formatter={(value: number) => [value, 'Mensagens']}
            />
            <Bar dataKey="conversations" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {data.map((entry) => (
                <Cell
                  key={entry.day}
                  fill={isWeekend(entry.day) ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-3))'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default ChatVolumeByWeekdayChart;
