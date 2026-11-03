import { FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { useScheduledMessages } from '@/hooks/useScheduledMessages';
import { cn } from '@/lib/utils';
import { Conversation } from '@/types/chat';
import FormattedMessage from './FormattedMessage';
import {
  ScheduledMessage,
  ScheduledMessageInput,
  ScheduledMessageSender,
  ScheduledMessageStatus,
  SCHEDULED_MESSAGE_TIMEZONE,
} from '@/types/scheduledMessage';

interface ScheduledMessagesDialogProps {
  conversation: Conversation;
}

type DialogView = 'list' | 'form';

const STATUS_META: Record<
  ScheduledMessageStatus,
  { label: string; icon: typeof Clock3; className: string }
> = {
  pendente: {
    label: 'Agendada',
    icon: Clock3,
    className: 'border-primary/20 bg-primary/10 text-primary',
  },
  processando: {
    label: 'Enviando',
    icon: Loader2,
    className: 'border-warning/20 bg-warning/10 text-warning',
  },
  enviado: {
    label: 'Enviada',
    icon: CheckCircle2,
    className: 'border-success/20 bg-success/10 text-success',
  },
  falha: {
    label: 'Falha',
    icon: AlertCircle,
    className: 'border-destructive/20 bg-destructive/10 text-destructive',
  },
  cancelado: {
    label: 'Cancelada',
    icon: AlertCircle,
    className: 'border-border bg-muted text-muted-foreground',
  },
};

function timeZoneParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
}

function toDateTimeLocal(date: Date) {
  const parts = timeZoneParts(date, SCHEDULED_MESSAGE_TIMEZONE);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

function timezoneOffset(date: Date, timezone: string) {
  const parts = timeZoneParts(date, timezone);
  const displayedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return displayedAsUtc - date.getTime();
}

function fromDateTimeLocal(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match.map(Number);
  const intendedUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const initialOffset = timezoneOffset(
    new Date(intendedUtc),
    SCHEDULED_MESSAGE_TIMEZONE
  );
  let instant = intendedUtc - initialOffset;
  const refinedOffset = timezoneOffset(
    new Date(instant),
    SCHEDULED_MESSAGE_TIMEZONE
  );

  if (refinedOffset !== initialOffset) {
    instant = intendedUtc - refinedOffset;
  }

  return new Date(instant);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: SCHEDULED_MESSAGE_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getCalendarMarker(value: string) {
  const date = new Date(value);
  return {
    day: new Intl.DateTimeFormat('pt-BR', {
      timeZone: SCHEDULED_MESSAGE_TIMEZONE,
      day: '2-digit',
    }).format(date),
    month: new Intl.DateTimeFormat('pt-BR', {
      timeZone: SCHEDULED_MESSAGE_TIMEZONE,
      month: 'short',
    })
      .format(date)
      .replace('.', '')
      .toUpperCase(),
  };
}

const StatusBadge = ({ status }: { status: ScheduledMessageStatus }) => {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        meta.className
      )}
    >
      <Icon
        className={cn('h-3 w-3', status === 'processando' && 'animate-spin')}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  );
};

const ScheduledMessagesDialog = ({
  conversation,
}: ScheduledMessagesDialogProps) => {
  const {
    messages,
    pendingCount,
    loading,
    setupError,
    createMessage,
    updateMessage,
    deleteMessage,
    refresh,
  } = useScheduledMessages(conversation);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DialogView>('list');
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(
    null
  );
  const [messageToDelete, setMessageToDelete] =
    useState<ScheduledMessage | null>(null);
  const [message, setMessage] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [sender, setSender] = useState<ScheduledMessageSender>('cvi');
  const [submitted, setSubmitted] = useState(false);

  const minimumDateTime = toDateTimeLocal(new Date(Date.now() + 60_000));

  useEffect(() => {
    if (open) return;
    setView('list');
    setEditingMessage(null);
    setMessageToDelete(null);
    setSubmitted(false);
  }, [open]);

  const openCreateForm = () => {
    setEditingMessage(null);
    setMessage('');
    setSender('cvi');
    setScheduledAt(toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
    setSubmitted(false);
    setView('form');
  };

  const openEditForm = (scheduledMessage: ScheduledMessage) => {
    setEditingMessage(scheduledMessage);
    setMessage(scheduledMessage.message);
    setSender(scheduledMessage.sender);
    setScheduledAt(toDateTimeLocal(new Date(scheduledMessage.scheduledFor)));
    setSubmitted(false);
    setView('form');
  };

  const scheduledInstant = scheduledAt ? fromDateTimeLocal(scheduledAt) : null;
  const messageError = submitted && message.trim().length === 0;
  const dateError =
    submitted &&
    (!scheduledInstant || scheduledInstant.getTime() <= Date.now() + 30_000);
  const isPending = createMessage.isPending || updateMessage.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);

    if (
      !message.trim() ||
      !scheduledInstant ||
      scheduledInstant.getTime() <= Date.now() + 30_000 ||
      isPending
    ) {
      return;
    }

    const input: ScheduledMessageInput = {
      message,
      scheduledFor: scheduledInstant.toISOString(),
      sender,
    };
    const closeForm = { onSuccess: () => setView('list') };

    if (editingMessage) {
      updateMessage.mutate({ id: editingMessage.id, input }, closeForm);
    } else {
      createMessage.mutate(input, closeForm);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="relative"
                aria-label={
                  pendingCount > 0
                    ? `Gerenciar mensagens agendadas. ${pendingCount} pendente(s).`
                    : 'Gerenciar mensagens agendadas'
                }
              >
                <CalendarClock className="h-5 w-5" aria-hidden="true" />
                {pendingCount > 0 && (
                  <span
                    className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground"
                    aria-hidden="true"
                  >
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Mensagens agendadas</TooltipContent>
        </Tooltip>

        <DialogContent className="flex max-h-[92vh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-5 py-4 pr-12">
            <div className="flex items-center gap-2">
              {view === 'form' && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="-ml-2 h-8 w-8"
                  onClick={() => setView('list')}
                  aria-label="Voltar para mensagens agendadas"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div>
                <DialogTitle>
                  {view === 'form'
                    ? editingMessage
                      ? 'Editar mensagem'
                      : 'Agendar mensagem'
                    : 'Mensagens agendadas'}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {view === 'form'
                    ? `Defina a mensagem e o horário de envio para ${conversation.name}.`
                    : `Gerencie os envios programados para ${conversation.name}.`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {view === 'list' ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{conversation.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {conversation.phone}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={openCreateForm}
                  disabled={setupError}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Nova mensagem
                </Button>
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="p-5">
                  {loading ? (
                    <div className="space-y-3" role="status" aria-label="Carregando mensagens">
                      {[0, 1, 2].map((item) => (
                        <Skeleton key={item} className="h-28 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : setupError ? (
                    <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
                      <AlertCircle
                        className="mb-3 h-9 w-9 text-destructive"
                        aria-hidden="true"
                      />
                      <p className="font-medium">Módulo ainda não configurado</p>
                      <p className="mt-1 max-w-md text-sm leading-5 text-muted-foreground">
                        Aplique a migração de mensagens agendadas no Supabase e
                        recarregue esta conversa.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4 gap-1.5"
                        onClick={() => refresh()}
                      >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Tentar novamente
                      </Button>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
                      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                        <CalendarPlus className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <p className="font-medium">Nenhuma mensagem agendada</p>
                      <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">
                        Programe uma mensagem para este tutor sem sair da conversa.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="mt-4 gap-1.5"
                        onClick={openCreateForm}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Agendar primeira mensagem
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((scheduledMessage) => {
                        const marker = getCalendarMarker(
                          scheduledMessage.scheduledFor
                        );
                        const canEdit = ['pendente', 'falha'].includes(
                          scheduledMessage.status
                        );
                        const canDelete =
                          scheduledMessage.status !== 'processando';

                        return (
                          <article
                            key={scheduledMessage.id}
                            className="group flex gap-3 rounded-lg border bg-card p-3 shadow-sm transition-colors hover:border-primary/30"
                          >
                            <div className="flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-md border bg-muted/40 text-center">
                              <span className="text-lg font-bold tabular-nums leading-none">
                                {marker.day}
                              </span>
                              <span className="mt-1 text-[10px] font-semibold tracking-wide text-muted-foreground">
                                {marker.month}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge status={scheduledMessage.status} />
                                <span className="text-xs tabular-nums text-muted-foreground">
                                  {formatDateTime(scheduledMessage.scheduledFor)}
                                </span>
                              </div>
                              <div className="mt-2 text-sm leading-5">
                                <FormattedMessage content={scheduledMessage.message} />
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Mensagem agendada</span>
                                {scheduledMessage.error && (
                                  <span
                                    className="basis-full text-destructive"
                                    title={scheduledMessage.error}
                                  >
                                    {scheduledMessage.error}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-start gap-0.5">
                              {canEdit && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground"
                                  onClick={() => openEditForm(scheduledMessage)}
                                  aria-label="Editar mensagem agendada"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => setMessageToDelete(scheduledMessage)}
                                  aria-label="Remover mensagem agendada"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-5 p-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="scheduled-message-text">Mensagem</Label>
                    <Textarea
                      id="scheduled-message-text"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Digite a mensagem que será enviada ao tutor..."
                      className="min-h-32 resize-y leading-6"
                      aria-invalid={messageError}
                      aria-describedby={
                        messageError ? 'scheduled-message-text-error' : undefined
                      }
                      autoFocus
                    />
                    {messageError && (
                      <p
                        id="scheduled-message-text-error"
                        className="text-sm text-destructive"
                        role="alert"
                      >
                        Escreva a mensagem que será enviada.
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="space-y-1.5">
                      <Label htmlFor="scheduled-message-date">Data e horário</Label>
                      <div className="relative">
                        <CalendarClock
                          className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <Input
                          id="scheduled-message-date"
                          type="datetime-local"
                          value={scheduledAt}
                          min={minimumDateTime}
                          onChange={(event) => setScheduledAt(event.target.value)}
                          className="min-h-11 pl-9 tabular-nums"
                          aria-invalid={dateError}
                          aria-describedby={
                            dateError
                              ? 'scheduled-message-date-error'
                              : 'scheduled-message-date-helper'
                          }
                        />
                      </div>
                      {dateError ? (
                        <p
                          id="scheduled-message-date-error"
                          className="text-sm text-destructive"
                          role="alert"
                        >
                          Escolha uma data e hora futuras.
                        </p>
                      ) : (
                        <p
                          id="scheduled-message-date-helper"
                          className="text-xs text-muted-foreground"
                        >
                          Horário de Brasília.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-start gap-3">
                      <MessageSquareText
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Resumo do envio</p>
                        <p className="mt-1 text-sm leading-5 text-muted-foreground">
                          Para <span className="font-medium text-foreground">{conversation.name}</span>
                          {scheduledInstant && !dateError
                            ? ` em ${formatDateTime(scheduledInstant.toISOString())}.`
                            : '.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="gap-2 border-t px-5 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setView('list')}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="min-h-11" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                  )}
                  {editingMessage ? 'Salvar alterações' : 'Agendar mensagem'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(messageToDelete)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setMessageToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta mensagem agendada?</AlertDialogTitle>
            <AlertDialogDescription>
              {messageToDelete?.status === 'enviado'
                ? 'O registro já foi enviado. A exclusão removerá apenas este histórico.'
                : 'A mensagem não será mais enviada e o registro será excluído.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {messageToDelete && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="line-clamp-3 whitespace-pre-wrap">
                {messageToDelete.message}
              </p>
              <Badge variant="outline" className="mt-2 font-normal">
                {formatDateTime(messageToDelete.scheduledFor)}
              </Badge>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMessage.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!messageToDelete || deleteMessage.isPending}
              onClick={() => {
                if (!messageToDelete) return;
                deleteMessage.mutate(messageToDelete.id, {
                  onSuccess: () => setMessageToDelete(null),
                });
              }}
            >
              {deleteMessage.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ScheduledMessagesDialog;
