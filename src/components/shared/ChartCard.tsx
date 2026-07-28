import React from 'react';
import { AlertCircle, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import EmptyState from './EmptyState';
import { SkeletonChart } from './skeletons';

interface ChartCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: boolean;
  emptyMessage?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const ChartCard = ({
  title,
  description,
  icon,
  loading = false,
  error = null,
  onRetry,
  empty = false,
  emptyMessage = 'Nenhum dado disponível para o período.',
  action,
  children,
  className,
}: ChartCardProps) => {
  return (
    <Card className={cn('shadow-sm', className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            {icon && (
              <span className="rounded-md bg-accent p-1.5 text-accent-foreground [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">
                {icon}
              </span>
            )}
            {title}
          </CardTitle>
          {action}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <SkeletonChart />
        ) : error ? (
          <EmptyState
            icon={<AlertCircle />}
            title="Não foi possível carregar os dados"
            description={error}
            action={
              onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Tentar novamente
                </Button>
              )
            }
          />
        ) : empty ? (
          <EmptyState icon={<BarChart3 />} title="Sem dados" description={emptyMessage} />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
};

export default ChartCard;
