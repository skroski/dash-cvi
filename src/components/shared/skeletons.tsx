import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const SkeletonList = ({ rows = 6, className }: { rows?: number; className?: string }) => (
  <div className={cn('space-y-1 p-2', className)} aria-busy="true" aria-label="Carregando lista">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 rounded-lg p-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonTable = ({ rows = 5, cols = 4, className }: { rows?: number; cols?: number; className?: string }) => (
  <div className={cn('space-y-3 p-4', className)} aria-busy="true" aria-label="Carregando tabela">
    <div className="flex gap-4">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-8 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonChart = ({ className }: { className?: string }) => (
  <div className={cn('flex h-[300px] flex-col justify-end gap-2 p-4', className)} aria-busy="true" aria-label="Carregando gráfico">
    <div className="flex flex-1 items-end gap-3">
      {[60, 85, 45, 95, 70, 55, 80].map((h, i) => (
        <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
      ))}
    </div>
    <Skeleton className="h-3 w-full" />
  </div>
);

export const SkeletonMessages = ({ rows = 5, className }: { rows?: number; className?: string }) => (
  <div className={cn('space-y-4 p-4', className)} aria-busy="true" aria-label="Carregando mensagens">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
        <Skeleton
          className={cn('h-14 rounded-2xl', i % 3 === 0 ? 'w-3/5' : 'w-2/5')}
        />
      </div>
    ))}
  </div>
);
