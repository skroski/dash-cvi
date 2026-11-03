import {
  AlertOctagon,
  Ban,
  CalendarClock,
  CheckCircle2,
  Info,
  RotateCcw,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { ReminderEvent, ReminderEventType, ReminderMessage } from '@/types/reminder';
import { formatDateTime } from './reminderUi';

const EVENT_META: Record<ReminderEventType, { icon: typeof Info; className: string; label: string }> = {
  planejado: { icon: CalendarClock, className: 'text-primary', label: 'Programado' },
  enviado: { icon: CheckCircle2, className: 'text-success', label: 'Enviado' },
  falha: { icon: XCircle, className: 'text-destructive', label: 'Falha' },
  ignorado: { icon: SkipForward, className: 'text-muted-foreground', label: 'Não enviado' },
  cancelado: { icon: Ban, className: 'text-muted-foreground', label: 'Cancelado' },
  reagendado: { icon: RotateCcw, className: 'text-primary', label: 'Reenvio' },
  erro_sistema: { icon: AlertOctagon, className: 'text-destructive', label: 'Erro do sistema' },
  info: { icon: Info, className: 'text-warning', label: 'Aviso' },
};

export const EventIcon = ({ type }: { type: ReminderEventType }) => {
  const meta = EVENT_META[type] ?? EVENT_META.info;
  const Icon = meta.icon;
  return <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.className)} aria-label={meta.label} />;
};

interface ActivityTabProps {
  events: ReminderEvent[];
  messages: ReminderMessage[];
  loading: boolean;
  onOpenMessage: (messageId: number) => void;
}

const ActivityTab = ({ events, messages, loading, onOpenMessage }: ActivityTabProps) => {
  const ownerByMessage = new Map(messages.map((message) => [message.id, message.ownerName]));
  const systemErrors = events.filter((event) => event.type === 'erro_sistema').length;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Atividade</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Tudo o que aconteceu com os lembretes, do mais recente para o mais antigo (últimos 150
          registros).
          {systemErrors > 0 && (
            <span className="ml-1 font-medium text-destructive">
              {systemErrors} erro(s) do sistema nesta lista.
            </span>
          )}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-10 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={<CalendarClock />}
            title="Nenhuma atividade ainda"
            description="Quando os lembretes forem programados e enviados, cada passo aparece aqui."
            className="py-10"
          />
        ) : (
          <ol className="divide-y">
            {events.map((event) => {
              const owner = event.messageId ? ownerByMessage.get(event.messageId) : null;
              return (
                <li key={event.id} className="flex items-start gap-3 px-4 py-3">
                  <EventIcon type={event.type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {owner && <span className="font-medium">{owner}: </span>}
                      {event.description}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(event.createdAt)}
                      {event.messageId && (
                        <>
                          {' · '}
                          <button
                            type="button"
                            className="text-primary underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
                            onClick={() => onOpenMessage(event.messageId as number)}
                          >
                            ver mensagem #{event.messageId}
                          </button>
                        </>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityTab;
