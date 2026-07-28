// Paleta de gráficos derivada dos tokens CSS (--chart-1..6), com suporte a dark mode.
export const CHART_COLORS = [1, 2, 3, 4, 5, 6].map((n) => `hsl(var(--chart-${n}))`);

export const chartColor = (index: number): string =>
  CHART_COLORS[index % CHART_COLORS.length];

export const CHART_GRID_COLOR = 'hsl(var(--border))';
export const CHART_TICK_COLOR = 'hsl(var(--muted-foreground))';

export const CHART_TICK = { fontSize: 11, fill: CHART_TICK_COLOR } as const;

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
  color: 'hsl(var(--popover-foreground))',
} as const;
