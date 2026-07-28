import { Play, PauseCircle, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Status = 'ativo' | 'pausado' | 'aguardando' | 'falha';

const statusConfig: Record<Status, { label: string; icon: React.ElementType; className: string }> = {
  ativo: {
    label: 'Ativo',
    icon: Play,
    className: 'bg-success/10 text-success border-success/20',
  },
  pausado: {
    label: 'Pausado',
    icon: PauseCircle,
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  aguardando: {
    label: 'Aguardando',
    icon: Clock,
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  falha: {
    label: 'Falha',
    icon: XCircle,
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

interface StatusBadgeProps {
  status: Status;
  /** Texto customizado (ex.: "Bot pausado · 12min"). Se omitido, usa o rótulo padrão. */
  label?: string;
  className?: string;
}

const StatusBadge = ({ status, label, className }: StatusBadgeProps) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label ?? config.label}
    </span>
  );
};

export default StatusBadge;
