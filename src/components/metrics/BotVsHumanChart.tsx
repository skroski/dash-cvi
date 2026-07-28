import React from 'react';
import { Bot } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BotVsHuman } from '@/hooks/useChatMetrics';
import ChartCard from '@/components/shared/ChartCard';
import { chartColor, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

interface BotVsHumanChartProps {
  data: BotVsHuman[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  if (percent < 0.04) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={13}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const BotVsHumanChart: React.FC<BotVsHumanChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const hasData = total > 0;

  return (
    <ChartCard
      title="Bot vs. Cliente"
      description="Proporção de mensagens enviadas pelo bot (IA) e pelos clientes"
      icon={<Bot />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={!hasData}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              labelLine={false}
              label={renderCustomLabel}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={chartColor(index)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [
                `${value.toLocaleString('pt-BR')} msgs (${Math.round((value / total) * 100)}%)`,
                name,
              ]}
            />
            <Legend
              iconType="circle"
              iconSize={10}
              formatter={(value) => (
                <span style={{ fontSize: 12, color: 'inherit' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {hasData && (
        <p className="mt-1 text-center text-xs text-muted-foreground tabular-nums">
          Total: {total.toLocaleString('pt-BR')} mensagens
        </p>
      )}
    </ChartCard>
  );
};

export default BotVsHumanChart;
