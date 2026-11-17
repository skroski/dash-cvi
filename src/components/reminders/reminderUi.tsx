import {
  AlertCircle,
  Ban,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Loader2,
  LucideIcon,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  REMINDER_SERVICE_COLORS,
  ReminderConfirmationStatus,
  ReminderDeliveryStatus,
  ReminderService,
  ReminderTrigger,
} from '@/types/reminder';

export const STATUS_META: Record<
  ReminderDeliveryStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  pendente: {
    label: 'Na fila',
    icon: Clock3,
    className: 'border-warning/20 bg-warning/10 text-warning',
  },
  processando: {
    label: 'Enviando',
    icon: Loader2,
    className: 'border-primary/20 bg-primary/10 text-primary',
  },
  enviado: {
    label: 'Enviado',
    icon: CheckCircle2,
    className: 'border-success/20 bg-success/10 text-success',
  },
  falha: {
    label: 'Falha',
    icon: XCircle,
    className: 'border-destructive/20 bg-destructive/10 text-destructive',
  },
  ignorado: {
    label: 'Não enviado',
    icon: AlertCircle,
    className: 'border-border bg-muted text-muted-foreground',
  },
  cancelado: {
    label: 'Cancelado',
    icon: Ban,
    className: 'border-border bg-muted text-muted-foreground line-through decoration-1',
  },
};

export const CONFIRMATION_META: Record<
  ReminderConfirmationStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  aguardando: {
    label: 'Aguardando resposta',
    icon: HelpCircle,
    className: 'border-border bg-muted/60 text-muted-foreground',
  },
  confirmado: {
    label: 'Confirmado pelo tutor',
    icon: CheckCheck,
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium',
  },
  cancelado: {
    label: 'Cancelado pelo tutor',
    icon: XCircle,
    className: 'border-destructive/20 bg-destructive/10 text-destructive font-medium',
  },
  remarcar: {
    label: 'Pediu remarcação',
    icon: CalendarClock,
    className: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium',
  },
  sem_resposta: {
    label: 'Sem resposta',
    icon: AlertCircle,
    className: 'border-border bg-muted text-muted-foreground',
  },
};

export const ConfirmationBadge = ({
  status,
}: {
  status?: ReminderConfirmationStatus | null;
}) => {
  const meta = CONFIRMATION_META[status ?? 'aguardando'] ?? CONFIRMATION_META.aguardando;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
        meta.className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
};

/** Na agenda, "pendente" sem mensagem ainda significa "aguardando o horário". */
export const APPOINTMENT_STATUS_LABEL: Partial<Record<ReminderDeliveryStatus, string>> = {
  pendente: 'Aguardando',
};

export const TRIGGER_LABEL: Record<ReminderTrigger, string> = {
  automatico: 'Automático',
  manual: 'Manual',
  teste: 'Teste',
};

export const StatusBadge = ({
  status,
  label,
  neutral = false,
}: {
  status: ReminderDeliveryStatus;
  label?: string;
  /** Tom neutro: agendamento que ainda espera o horário da regra. */
  neutral?: boolean;
}) => {
  const meta = STATUS_META[status] ?? STATUS_META.ignorado;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
        neutral ? 'border-border bg-muted/60 text-foreground' : meta.className
      )}
    >
      <Icon className={cn('h-3 w-3', status === 'processando' && 'animate-spin')} aria-hidden="true" />
      {label ?? meta.label}
    </span>
  );
};

export const ServiceBadge = ({
  name,
  service,
}: {
  name: string | null;
  service?: ReminderService | null;
}) => {
  if (!name && !service) {
    return <span className="text-xs text-muted-foreground">Sem serviço</span>;
  }
  const color = REMINDER_SERVICE_COLORS[service?.color ?? 'cinza'];
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 truncate rounded-md border px-2 py-0.5 text-xs font-medium',
        color.className
      )}
      title={service ? undefined : 'Serviço sem categoria'}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', color.dot)} aria-hidden="true" />
      <span className="truncate">{service?.name ?? name}</span>
    </span>
  );
};

export const DayBadge = ({
  date,
  today,
  tomorrow,
}: {
  date: string;
  today: string;
  tomorrow: string;
}) => {
  if (date === today) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold',
          'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
        Hoje
      </span>
    );
  }

  if (date === tomorrow) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium',
          'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300'
        )}
      >
        Amanhã
      </span>
    );
  }

  if (date < today) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-normal',
          'border-border bg-muted/60 text-muted-foreground'
        )}
      >
        Passado
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-normal',
        'border-primary/20 bg-primary/5 text-primary'
      )}
    >
      Futuro
    </span>
  );
};

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

export function formatDateBR(isoDate: string, withWeekday = false) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withWeekday ? { weekday: 'short' as const } : {}),
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function formatPhone(value: string) {
  const digits = value.split('@')[0].replace(/\D/g, '');
  const local = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return digits || value;
}
