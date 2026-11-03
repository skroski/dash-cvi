import { useEffect, useMemo, useState } from 'react';
import { Ban, Edit3, ExternalLink, Loader2, RotateCcw, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useReminderMessageEvents } from '@/hooks/useReminders';
import {
  capitalizarNome,
  juntarLista,
  nomesDosPets,
  renderizarExemplo,
} from '@/lib/reminderMessage';
import {
  DEFAULT_REMINDER_TEMPLATE,
  ReminderConfiguration,
  ReminderMessage,
} from '@/types/reminder';
import { SourceBadge } from './MessagesTab';
import { EventIcon } from './ActivityTab';
import { StatusBadge, TRIGGER_LABEL, formatDateBR, formatDateTime, formatPhone } from './reminderUi';

interface MessageDetailDialogProps {
  message: ReminderMessage | null;
  configurations?: ReminderConfiguration[];
  clinicName?: string;
  onOpenChange: (open: boolean) => void;
  onResend: (message: ReminderMessage) => void;
  onCancel: (message: ReminderMessage) => void;
  onSendDirect?: (
    message: ReminderMessage,
    text: string,
    botoesConfirmacao?: boolean,
    clinicName?: string
  ) => Promise<unknown>;
  resendPending: boolean;
  cancelPending: boolean;
  sendDirectPending?: boolean;
}

const MessageDetailDialog = ({
  message: currentMessage,
  configurations = [],
  clinicName = 'Clínica Veterinária',
  onOpenChange,
  onResend,
  onCancel,
  onSendDirect,
  resendPending,
  cancelPending,
  sendDirectPending = false,
}: MessageDetailDialogProps) => {
  const [lastMessage, setLastMessage] = useState(currentMessage);
  useEffect(() => {
    if (currentMessage) setLastMessage(currentMessage);
  }, [currentMessage]);
  const message = currentMessage ?? lastMessage;
  const events = useReminderMessageEvents(message?.id ?? null);

  const rule = useMemo(
    () => configurations.find((c) => c.id === message?.configurationId),
    [configurations, message?.configurationId]
  );

  const fallbackText = useMemo(() => {
    if (!message) return '';
    if (message.text) return message.text;
    const template = rule?.examples?.[0] || DEFAULT_REMINDER_TEMPLATE;
    return renderizarExemplo(template, {
      nomeTutor: message.ownerName,
      pets: message.petNames,
      servicos: message.services,
      dataAgendada: message.appointmentDate,
      horario: message.appointmentTime,
      diaEnvio: message.sendDay,
      clinica: clinicName,
    });
  }, [message, rule, clinicName]);

  const [draftText, setDraftText] = useState(fallbackText);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (message) {
      setDraftText(fallbackText);
      setIsEditing(false);
    }
  }, [message?.id, fallbackText]);

  const canResend = message && ['falha', 'ignorado', 'cancelado'].includes(message.status);
  const canCancel = message?.status === 'pendente';
  const isSent = message?.status === 'enviado';

  const handleOpenWhatsAppWeb = () => {
    if (!message) return;
    const cleanPhone = message.phone.split('@')[0].replace(/\D/g, '');
    const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    window.open(
      `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(draftText)}`,
      '_blank'
    );
  };

  const hasConfirmButtons = Boolean(
    message?.botoesConfirmacao ??
      rule?.botoesConfirmacao ??
      (rule?.category === 'consulta' || rule?.category === 'vacina')
  );

  return (
    <Dialog open={!!currentMessage} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl">
        {message && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {capitalizarNome(message.ownerName)}
                <StatusBadge status={message.status} />
                {hasConfirmButtons ? (
                  <span className="rounded-md border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    2 botões: Confirmar / Não Confirmar
                  </span>
                ) : (
                  <span className="rounded-md border border-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Sem confirmação
                  </span>
                )}
              </DialogTitle>
              <DialogDescription>
                {formatPhone(message.phone)} · {juntarLista(nomesDosPets(message.petNames)) || 'Pet não informado'}{' '}
                · {message.services.join(', ') || 'Sem serviço'}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Atendimento</dt>
                <dd className="font-medium">
                  {formatDateBR(message.appointmentDate, true)}
                  {message.appointmentTime ? ` às ${message.appointmentTime}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {message.status === 'enviado' ? 'Enviado em' : 'Programado para'}
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatDateTime(message.status === 'enviado' ? message.sentAt : message.scheduledFor)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Origem</dt>
                <dd className="font-medium">
                  {TRIGGER_LABEL[message.trigger]} · {message.configurationName || 'Sem regra'}
                </dd>
              </div>
            </dl>

            <section aria-label="Texto da mensagem" className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Texto da mensagem</p>
                  <SourceBadge message={message} />
                  {message.aiModel && (
                    <span className="text-xs text-muted-foreground">{message.aiModel}</span>
                  )}
                </div>
                {!isSent && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {isEditing ? 'Concluir edição' : 'Editar texto'}
                  </Button>
                )}
              </div>

              {isEditing ? (
                <Textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  className="min-h-36 font-sans text-sm leading-6"
                  placeholder="Escreva a mensagem..."
                />
              ) : (
                <div className="rounded-lg bg-[#e7ffdb] p-3 text-sm leading-6 text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
                  <p className="whitespace-pre-wrap">{draftText}</p>
                  {hasConfirmButtons && (
                    <div className="mt-3 flex flex-col gap-1.5 border-t border-black/10 pt-2 dark:border-white/10">
                      <div className="flex items-center justify-center rounded-md border border-emerald-600/30 bg-white/70 py-1.5 text-xs font-semibold text-emerald-800 shadow-xs dark:bg-black/30 dark:text-emerald-200">
                        ✓ Confirmar
                      </div>
                      <div className="flex items-center justify-center rounded-md border border-rose-600/30 bg-white/70 py-1.5 text-xs font-semibold text-rose-800 shadow-xs dark:bg-black/30 dark:text-rose-200">
                        ✕ Não Confirmar
                      </div>
                    </div>
                  )}
                </div>
              )}

              {message.error && (
                <p className="mt-2 rounded-md border border-destructive/20 bg-destructive/5 p-2 text-sm text-destructive">
                  {message.error}
                </p>
              )}
            </section>

            <section aria-label="Linha do tempo">
              <p className="mb-2 text-sm font-medium">Linha do tempo</p>
              {events.isPending ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <ol className="space-y-2">
                  {(events.data ?? []).map((event) => (
                    <li key={event.id} className="flex items-start gap-2 text-sm">
                      <EventIcon type={event.type} />
                      <div>
                        <p>{event.description}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatDateTime(event.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                  <li className="text-xs text-muted-foreground">
                    {message.attempts} tentativa(s) de envio
                    {message.providerMessageId ? ` · id WhatsApp ${message.providerMessageId}` : ''}
                  </li>
                </ol>
              )}
            </section>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {canCancel && (
                <Button
                  variant="outline"
                  className="min-h-11 gap-1.5"
                  onClick={() => onCancel(message)}
                  disabled={cancelPending}
                >
                  {cancelPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Ban className="h-4 w-4" aria-hidden="true" />
                  )}
                  Cancelar
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                className="min-h-11 gap-1.5"
                onClick={handleOpenWhatsAppWeb}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                WhatsApp Web
              </Button>

              {onSendDirect && !isSent && (
                <Button
                  type="button"
                  className="min-h-11 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => onSendDirect(message, draftText, hasConfirmButtons, clinicName)}
                  disabled={sendDirectPending || !draftText.trim()}
                >
                  {sendDirectPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden="true" />
                  )}
                  Enviar agora (Uazapi)
                </Button>
              )}

              {canResend && (
                <Button
                  className="min-h-11 gap-1.5"
                  onClick={() => onResend(message)}
                  disabled={resendPending}
                >
                  {resendPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  )}
                  Tentar fila novamente
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MessageDetailDialog;
