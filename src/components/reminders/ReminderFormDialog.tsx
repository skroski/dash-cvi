import { FormEvent, useEffect, useState } from 'react';
import { CalendarDays, Clock3, Loader2, MessageSquareText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DEFAULT_REMINDER_TEMPLATE,
  REMINDER_TEMPLATE_VARIABLES,
  ReminderConfiguration,
  ReminderConfigurationInput,
  renderReminderPreview,
} from '@/types/reminder';

interface ReminderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminder?: ReminderConfiguration | null;
  isPending: boolean;
  onSubmit: (input: ReminderConfigurationInput) => void;
}

const TIMEZONE = 'America/Sao_Paulo';

const ReminderFormDialog = ({
  open,
  onOpenChange,
  reminder,
  isPending,
  onSubmit,
}: ReminderFormDialogProps) => {
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [sendTime, setSendTime] = useState('18:00');
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_REMINDER_TEMPLATE);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(reminder?.name ?? 'Lembrete do dia anterior');
    setEnabled(reminder?.enabled ?? true);
    setSendTime(reminder?.sendTime ?? '18:00');
    setMessageTemplate(reminder?.messageTemplate ?? DEFAULT_REMINDER_TEMPLATE);
    setSubmitted(false);
  }, [open, reminder]);

  const nameError = submitted && name.trim().length === 0;
  const timeError = submitted && !/^\d{2}:\d{2}$/.test(sendTime);
  const messageError = submitted && messageTemplate.trim().length === 0;
  const isValid =
    name.trim().length > 0 &&
    /^\d{2}:\d{2}$/.test(sendTime) &&
    messageTemplate.trim().length > 0;

  const insertVariable = (token: string) => {
    setMessageTemplate((current) => {
      const separator = current.length > 0 && !/\s$/.test(current) ? ' ' : '';
      return `${current}${separator}${token}`;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (!isValid || isPending) return;

    onSubmit({
      name,
      enabled,
      sendTime,
      timezone: TIMEZONE,
      messageTemplate,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{reminder ? 'Editar lembrete' : 'Novo lembrete'}</DialogTitle>
          <DialogDescription>
            Configure o horário e a mensagem que o n8n usará para avisar os tutores com
            serviços agendados para o dia seguinte.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="reminder-name">Nome da regra</Label>
            <Input
              id="reminder-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Lembrete do dia anterior"
              aria-invalid={nameError}
              aria-describedby={nameError ? 'reminder-name-error' : undefined}
              className="min-h-11"
              autoFocus
            />
            {nameError && (
              <p id="reminder-name-error" className="text-sm text-destructive" role="alert">
                Informe um nome para identificar esta regra.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="reminder-time">Horário de envio</Label>
              <div className="relative">
                <Clock3
                  className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="reminder-time"
                  type="time"
                  value={sendTime}
                  onChange={(event) => setSendTime(event.target.value)}
                  className="min-h-11 pl-9 tabular-nums"
                  aria-invalid={timeError}
                  aria-describedby={
                    timeError ? 'reminder-time-error' : 'reminder-time-helper'
                  }
                />
              </div>
              {timeError ? (
                <p id="reminder-time-error" className="text-sm text-destructive" role="alert">
                  Informe um horário válido.
                </p>
              ) : (
                <p id="reminder-time-helper" className="text-xs text-muted-foreground">
                  Fuso horário de Brasília ({TIMEZONE}).
                </p>
              )}
            </div>

            <div className="rounded-md border bg-muted/35 p-3">
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Agendamentos de amanhã</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    A antecedência é fixa em 1 dia para corresponder ao fluxo atual do n8n.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <Label htmlFor="reminder-message">Mensagem</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Use as variáveis abaixo para personalizar automaticamente cada envio.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="Variáveis da mensagem">
              {REMINDER_TEMPLATE_VARIABLES.map((variable) => (
                <Button
                  key={variable.token}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 font-mono text-xs"
                  onClick={() => insertVariable(variable.token)}
                  aria-label={`Inserir variável ${variable.label}`}
                >
                  {variable.token}
                </Button>
              ))}
            </div>
            <Textarea
              id="reminder-message"
              value={messageTemplate}
              onChange={(event) => setMessageTemplate(event.target.value)}
              className="min-h-36 resize-y leading-6"
              aria-invalid={messageError}
              aria-describedby={messageError ? 'reminder-message-error' : undefined}
            />
            {messageError && (
              <p id="reminder-message-error" className="text-sm text-destructive" role="alert">
                Escreva a mensagem que será enviada ao tutor.
              </p>
            )}
          </div>

          <div className="rounded-md border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-medium">Prévia da mensagem</p>
              <Badge variant="outline" className="ml-auto font-normal">
                Exemplo
              </Badge>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {renderReminderPreview(messageTemplate) || 'A prévia aparecerá aqui.'}
            </p>
          </div>

          <div className="flex min-h-14 items-center justify-between gap-4 rounded-md border p-3">
            <div>
              <Label htmlFor="reminder-enabled">Regra ativa</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Regras pausadas são ignoradas pelo fluxo de envio.
              </p>
            </div>
            <Switch
              id="reminder-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label={enabled ? 'Pausar regra' : 'Ativar regra'}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {reminder ? 'Salvar alterações' : 'Criar lembrete'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReminderFormDialog;
