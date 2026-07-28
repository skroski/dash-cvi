import React from 'react';
import { MessageSquarePlus } from 'lucide-react';
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { NewChatMonthly } from '@/hooks/useChatMetrics';
import ChartCard from '@/components/shared/ChartCard';
import { CHART_GRID_COLOR, CHART_TICK, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

interface NewChatsMonthlyChartProps {
  data: NewChatMonthly[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const NewChatsMonthlyChart: React.FC<NewChatsMonthlyChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  const total = data.reduce((s, d) => s + d.chats, 0);
  const isEmpty = data.length === 0 || total === 0;

  return (
    <ChartCard
      title="Novas Conversas"
      description="Conversas iniciadas no período selecionado"
      icon={<MessageSquarePlus />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={isEmpty}
      action={
        !isEmpty ? (
          <span className="rounded-full bg-accent px-2 py-1 text-xs font-medium text-accent-foreground tabular-nums">
            Total: {total.toLocaleString('pt-BR')}
          </span>
        ) : undefined
      }
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="chatsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={CHART_TICK} />
            <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} allowDecimals={false} />
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number) => [value, 'Conversas']}
            />
            <Area
              type="monotone"
              dataKey="chats"
              stroke="hsl(var(--chart-4))"
              strokeWidth={2}
              fill="url(#chatsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default NewChatsMonthlyChart;
