import React from 'react';
import { Building2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { NamedCount } from '@/hooks/useAtendimentoMetrics';
import ChartCard from '@/components/shared/ChartCard';
import { chartColor, CHART_TOOLTIP_STYLE } from '@/lib/chartColors';

interface DepartmentsChartProps {
  data: NamedCount[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const DepartmentsChart: React.FC<DepartmentsChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ChartCard
      title="Atendimentos por Departamento"
      description="Distribuição dos atendimentos entre os departamentos no período"
      icon={<Building2 />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={total === 0}
      emptyMessage="Nenhum atendimento atribuído no período."
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
              nameKey="name"
              labelLine={false}
              label={renderCustomLabel}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || chartColor(index)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [
                `${value} atend. (${Math.round((value / total) * 100)}%)`,
                name,
              ]}
            />
            <Legend
              iconType="circle"
              iconSize={10}
              formatter={(value) => <span style={{ fontSize: 12, color: 'inherit' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default DepartmentsChart;
