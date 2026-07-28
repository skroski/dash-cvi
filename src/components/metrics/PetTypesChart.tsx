import React, { useState } from 'react';
import { PawPrint } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Sector,
} from 'recharts';
import ChartCard from '@/components/shared/ChartCard';
import { chartColor } from '@/lib/chartColors';

interface PetType {
  name: string;
  value: number;
}

interface PetTypesChartProps {
  data: PetType[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const renderActiveShape = (props: any) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent, value,
  } = props;

  return (
    <g>
      <text x={cx} y={cy - 12} textAnchor="middle" fill={fill} style={{ fontSize: 15, fontWeight: 700 }}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="hsl(var(--muted-foreground))" style={{ fontSize: 13 }}>
        {value} pets
      </text>
      <text x={cx} y={cy + 34} textAnchor="middle" fill="hsl(var(--muted-foreground))" style={{ fontSize: 12 }}>
        {(percent * 100).toFixed(1)}%
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 14}
        outerRadius={outerRadius + 18}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    const total = item.payload.total || 1;
    return (
      <div className="rounded-xl border bg-popover px-4 py-3 text-popover-foreground shadow-xl">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.payload.fill }} />
          <span className="text-sm font-semibold">{item.name}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-bold text-foreground">{item.value}</span> pets &nbsp;·&nbsp;
          <span className="font-bold text-foreground">
            {((item.payload.value / total) * 100).toFixed(1)}%
          </span>
        </p>
      </div>
    );
  }
  return null;
};

const PetTypesChart: React.FC<PetTypesChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  // Inject total + fill into each entry for tooltip/legend
  const enrichedData = data.map((d, index) => ({ ...d, total, fill: chartColor(index) }));

  const topItems = enrichedData.slice(0, 20); // Show up to 20 breeds

  return (
    <ChartCard
      title="Tipos & Raças de Pets Atendidos"
      icon={<PawPrint />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={topItems.length === 0}
      className="col-span-full"
      action={
        total > 0 ? (
          <div className="text-sm text-muted-foreground tabular-nums">
            <span className="font-semibold text-foreground">{total}</span> pets no total
            {data.length > 20 && (
              <span className="ml-2 text-xs">· Exibindo top 20 de {data.length}</span>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="flex h-auto flex-col items-center gap-6 md:h-96 md:flex-row">
        {/* Pie Chart */}
        <div className="h-80 w-full flex-shrink-0 md:h-full md:w-3/5">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                data={topItems}
                cx="50%"
                cy="50%"
                innerRadius="45%"
                outerRadius="65%"
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIndex(index)}
              >
                {topItems.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.fill} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="min-h-0 w-full flex-1 md:w-2/5">
          <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto pr-1">
            {topItems.map((entry, index) => {
              const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0';
              return (
                <button
                  key={`leg-${entry.name}`}
                  type="button"
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                    activeIndex === index
                      ? 'bg-accent ring-1 ring-primary/30'
                      : 'hover:bg-muted'
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                >
                  <div
                    className="h-3 w-3 flex-shrink-0 rounded-full shadow-sm"
                    style={{ backgroundColor: entry.fill }}
                  />
                  <span className="flex-1 truncate text-sm font-medium">
                    {entry.name}
                  </span>
                  <span className="flex-shrink-0 text-xs text-muted-foreground tabular-nums">{entry.value}</span>
                  <span className="w-12 flex-shrink-0 text-right text-xs font-semibold tabular-nums">
                    {pct}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </ChartCard>
  );
};

export default PetTypesChart;
