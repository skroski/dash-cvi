import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type StatTone = 'default' | 'success' | 'warning' | 'destructive';

const toneStyles: Record<StatTone, { chip: string; icon: string }> = {
  default: { chip: 'bg-accent', icon: 'text-accent-foreground' },
  success: { chip: 'bg-success/10', icon: 'text-success' },
  warning: { chip: 'bg-warning/10', icon: 'text-warning' },
  destructive: { chip: 'bg-destructive/10', icon: 'text-destructive' },
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  hint?: string;
  tone?: StatTone;
  loading?: boolean;
  href?: string;
  className?: string;
  /** Âncora para o tour guiado. */
  dataTour?: string;
}

const StatCard = ({
  title,
  value,
  icon,
  hint,
  tone = 'default',
  loading = false,
  href,
  className,
  dataTour,
}: StatCardProps) => {
  const styles = toneStyles[tone];

  return (
    <Card
      data-tour={dataTour}
      className={cn(
        'relative shadow-sm transition-shadow duration-200',
        href && 'hover:shadow-md focus-within:ring-2 focus-within:ring-ring',
        className
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {href ? (
            <Link
              to={href}
              className="outline-none after:absolute after:inset-0 after:content-['']"
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          {loading ? (
            <Skeleton className="h-9 w-16" />
          ) : (
            <div className="text-3xl font-bold tabular-nums">{value}</div>
          )}
          <div className={cn('rounded-full p-2', styles.chip)} aria-hidden="true">
            {React.cloneElement(icon as React.ReactElement, {
              className: cn('h-5 w-5', styles.icon),
            })}
          </div>
        </div>
        {hint !== undefined && (
          <div className="mt-2 text-sm text-muted-foreground">
            {loading ? <Skeleton className="h-4 w-32" /> : hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard;
