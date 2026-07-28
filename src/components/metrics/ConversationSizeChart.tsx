import React from 'react';
import { MessagesSquare } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ConversationSizeBucket } from '@/hooks/useChatMetrics';
import ChartCard from '@/components/shared/ChartCard';
import { CHART_GRID_COLOR, CHART_TICK, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

const BUCKET_LABELS: Record<string, string> = {
  '1–5': 'Curta',
  '6–15': 'Média',
  '16–30': 'Longa',
  '31+': 'Extensa',
};

interface ConversationSizeChartProps {
  data: ConversationSizeBucket[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const ConversationSizeChart: React.FC<ConversationSizeChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  const isEmpty = data.every(d => d.count === 0);

  return (
    <ChartCard
      title="Tamanho das Conversas"
      description="Distribuição por quantidade de mensagens"
      icon={<MessagesSquare />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={isEmpty}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis dataKey="range" tick={CHART_TICK} tickLine={false} axisLine={false} />
            <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              cursor={{ fill: 'hsl(var(--muted))' }}
              formatter={(value: number, _name, item) => [
                `${value} conversas`,
                BUCKET_LABELS[item?.payload?.range] ?? item?.payload?.range,
              ]}
            />
            <Bar
              dataKey="count"
              fill="hsl(var(--chart-5))"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default ConversationSizeChart;
