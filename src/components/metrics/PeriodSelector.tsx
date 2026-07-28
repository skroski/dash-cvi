import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { MetricsPeriod, PERIOD_OPTIONS } from '@/lib/metricsPeriod';

interface PeriodSelectorProps {
  value: MetricsPeriod;
  onChange: (period: MetricsPeriod) => void;
}

const PeriodSelector = ({ value, onChange }: PeriodSelectorProps) => {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as MetricsPeriod);
      }}
      className="rounded-lg border bg-card p-1"
      aria-label="Período das métricas"
    >
      {PERIOD_OPTIONS.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className="h-8 px-3 text-xs data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
          aria-label={`Período: ${option.label}`}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
};

export default PeriodSelector;
