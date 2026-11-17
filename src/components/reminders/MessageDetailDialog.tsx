import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CalendarClock,
  CheckCheck,
  Edit3,
  ExternalLink,
  HelpCircle,
  Loader2,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import {
  capitalizarNome,
  juntarLista,
  nomesDosPets,
  renderizarExemplo,
} from '@/lib/reminderMessage';
import {
  DEFAULT_REMINDER_TEMPLATE,
  ReminderConfiguration,
  ReminderConfirmationStatus,
  ReminderMessage,
} from '@/types/reminder';
import { SourceBadge } from './MessagesTab';
import { EventIcon } from './ActivityTab';
import {
  ConfirmationBadge,
  StatusBadge,
  TRIGGER_LABEL,
  formatDateBR,
  formatDateTime,
  formatPhone,
} from './reminderUi';

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
  onMarkAsSent?: (message: ReminderMessage, text?: string) => void;
  onUpdateConfirmation?: (messageId: number, status: ReminderConfirmationStatus) => void;
  onUnlockMessage?: (messageId: number, action: 'pendente' | 'enviado' | 'falha') => void;
  resendPending: boolean;
  cancelPending: boolean;
  sendDirectPending?: boolean;
  markAsSentPending?: boolean;
  confirmationPending?: boolean;
}

const MessageDetailDialog = ({
  message: currentMessage,
  configurations = [],
  clinicName = 'C.V.I. - Centro Veterinário Integrado',
  onOpenChange,
  onResend,
  onCancel,
  onSendDirect,
  onMarkAsSent,
  onUpdateConfirmation,
  onUnlockMessage,
  resendPending,
  cancelPending,
  sendDirectPending = false,
  markAsSentPending = false,
  confirmationPending = false,
}: MessageDetailDialogProps) => {
  const [lastMessage, setLastMessage] = useState(currentMessage);
  useEffect(() => {
    if (currentMessage) setLastMessage(currentMessage);
  }, [currentMessage]);
  const message = currentMessage || lastMessage;

  const rule = useMemo(
    () => configurations.find((c) => c.id === message?.configurationId),
    [configurations, message?.configurationId]
  );

  const initialDraft = useMemo(() => {
    if (!message) return '';
    if (message.text) return message.text;
    const template = rule?.examples?.[0] || DEFAULT_REMINDER_TEMPLATE;
    const pet = message.petName || (message.petNames && message.petNames[0]) || '';
    const servico = message.service || (message.services && message.services[0]) || '';
    return renderizarExemplo(template, {
      nomeTutor: message.ownerName,
      nomePet: pet,
      servico: servico,
      pets: pet ? [pet] : message.petNames,
      servicos: servico ? [servico] : message.services,
      dataAgendada: message.appointmentDate,
      horario: message.appointmentTime,
      diaEnvio: message.sendDay,
      clinica: clinicName,
    });
  }, [message, rule, clinicName]);

  const [draftText, setDraftText] = useState(initialDraft);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setDraftText(initialDraft);
    setIsEditing(false);
  }, [initialDraft, currentMessage?.id]);

  const events = useReminderMessageEvents(currentMessage?.id ?? null);

  const handleOpenWhatsAppWeb = () => {
    if (!message) return;
    const digits = message.phone.replace(/\D/g, '');
    const cleanPhone = digits.startsWith('55') ? digits : `55${digits}`;
    window.open(
      `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(draftText)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const isConsultationOrExam =
    rule?.category === 'consulta' ||
    rule?.category === 'vacina' ||
    rule?.category === 'banho_tosa' ||
    message?.category === 'consulta' ||
    message?.category === 'vacina' ||
    !message?.category;

  const hasConfirmButtons = Boolean(
    rule?.botoesConfirmacao ||
      message?.botoesConfirmacao ||
      isConsultationOrExam
  );

  const isSent = message?.status === 'enviado';
  const canCancel = message?.status === 'pendente' || message?.status === 'processando';
  const canResend = message?.status === 'falha' || message?.status === 'cancelado';
  const canSendDirect = Boolean(onSendDirect && message && !isSent);

  return (
    <Dialog open={!!currentMessage} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-xl">
        {message && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {capitalizarNome(message.ownerName)}
                <StatusBadge status={message.status} />
                {hasConfirmButtons ? (
                  <span className="rounded-md border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    2 botões: Confirmar / Cancelar
                  </span>
                ) : (
                  <span className="rounded-md border border-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Sem confirmação
                  </span>
                )}
                {message.confirmationStatus && (
                  <ConfirmationBadge status={message.confirmationStatus} />
                )}
              </DialogTitle>
              <DialogDescription>
                {formatPhone(message.phone)} ·{' '}
                {message.petName || juntarLista(nomesDosPets(message.petNames)) || 'Pet não informado'} ·{' '}
                {message.service || message.services.join(', ') || 'Sem serviço'}
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

            {message.status === 'processando' && (
              <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-100">
                <div className="flex items-center gap-2 font-semibold">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                  <span>Este lembrete está com status &quot;Enviando&quot;</span>
                </div>
                <p className="text-muted-foreground dark:text-amber-200/80">
                  Se o disparo automático demorou ou travou na fila, você pode resolver diretamente por aqui:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {onUnlockMessage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-amber-600/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
                      onClick={() => onUnlockMessage(message.id, 'pendente')}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Devolver para a fila
                    </Button>
                  )}
                  {onMarkAsSent && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-emerald-600/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                      onClick={() => onMarkAsSent(message, draftText)}
                    >
                      <CheckCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                      Marcar como enviado
                    </Button>
                  )}
                  {onUnlockMessage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onUnlockMessage(message.id, 'falha')}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Marcar como falha
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Painel de confirmação do tutor pós-envio */}
            {isSent && onUpdateConfirmation && (
              <section className="rounded-md border p-3 bg-muted/20">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Status de Confirmação do Tutor
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Atualize conforme a resposta do tutor no WhatsApp
                    </p>
                  </div>
                    <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant={message.confirmationStatus === 'confirmado' ? 'default' : 'outline'}
                      className={cn(
                        'h-8 text-xs gap-1',
                        message.confirmationStatus === 'confirmado' && 'bg-emerald-600 hover:bg-emerald-700'
                      )}
                      disabled={confirmationPending}
                      onClick={() => onUpdateConfirmation(message.id, 'confirmado')}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Confirmado
                    </Button>
                    <Button
                      size="sm"
                      variant={message.confirmationStatus === 'cancelado' ? 'default' : 'outline'}
                      className={cn(
                        'h-8 text-xs gap-1',
                        message.confirmationStatus === 'cancelado' && 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                      )}
                      disabled={confirmationPending}
                      onClick={() => onUpdateConfirmation(message.id, 'cancelado')}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      variant={message.confirmationStatus === 'remarcar' ? 'default' : 'outline'}
                      className={cn(
                        'h-8 text-xs gap-1',
                        message.confirmationStatus === 'remarcar' && 'bg-amber-600 hover:bg-amber-700 text-white'
                      )}
                      disabled={confirmationPending}
                      onClick={() => onUpdateConfirmation(message.id, 'remarcar')}
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      Remarcar
                    </Button>
                    <Button
                      size="sm"
                      variant={message.confirmationStatus === 'aguardando' ? 'default' : 'outline'}
                      className="h-8 text-xs gap-1"
                      disabled={confirmationPending}
                      onClick={() => onUpdateConfirmation(message.id, 'aguardando')}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      Aguardando
                    </Button>
                  </div>
                </div>
              </section>
            )}

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
                        ✕ Cancelar
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
                  <Ban className="h-4 w-4" aria-hidden="true" />
                  Cancelar envio
                </Button>
              )}

              {canResend && (
                <Button
                  className="min-h-11 gap-1.5"
                  onClick={() => onResend(message)}
                  disabled={resendPending}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Reenviar
                </Button>
              )}

              {!isSent && onMarkAsSent && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => onMarkAsSent(message, draftText)}
                  disabled={markAsSentPending}
                  title="Usa quando a mensagem já foi enviada pelo WhatsApp mas continuou Na fila"
                >
                  {markAsSentPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCheck className="h-4 w-4" aria-hidden="true" />
                  )}
                  Já enviei (Marcar enviado)
                </Button>
              )}

              {canSendDirect && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 gap-1.5"
                    onClick={handleOpenWhatsAppWeb}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Abrir no WhatsApp Web
                  </Button>
                  <Button
                    type="button"
                    className="min-h-11 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() =>
                      onSendDirect?.(message, draftText, hasConfirmButtons, clinicName)
                    }
                    disabled={sendDirectPending || !draftText.trim()}
                  >
                    {sendDirectPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden="true" />
                    )}
                    Enviar agora (Uazapi)
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MessageDetailDialog;
