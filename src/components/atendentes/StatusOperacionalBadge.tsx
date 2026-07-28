import { cn } from '@/lib/utils';
import { STATUS_META, StatusOperacional, formatarTempoNoStatus } from '@/types/perfil';

interface StatusOperacionalBadgeProps {
  status: StatusOperacional;
  /** Quando informado, acrescenta o tempo decorrido no status atual. */
  desde?: string | null;
  className?: string;
}

/** Situação operacional de um atendente (disponível, almoço, pausa...). */
const StatusOperacionalBadge = ({
  status,
  desde,
  className,
}: StatusOperacionalBadgeProps) => {
  const meta = STATUS_META[status] ?? STATUS_META.offline;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        meta.badge,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} aria-hidden="true" />
      {meta.label}
      {desde && (
        <span className="opacity-70">· {formatarTempoNoStatus(desde)}</span>
      )}
    </span>
  );
};

export default StatusOperacionalBadge;
