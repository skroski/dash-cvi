import { useState } from 'react';
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleDot,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { ConversationStatus } from '@/types/chat';
import { useConversationStatus } from '@/hooks/useConversationStatus';

type FeedbackPhase = 'saving' | 'success' | 'error';

interface StatusFeedback {
  status: ConversationStatus;
  phase: FeedbackPhase;
}

const statusConfig: Record<
  ConversationStatus,
  {
    label: string;
    actionLabel: string;
    savingLabel: string;
    successLabel: string;
    description: string;
    successDescription: string;
    icon: React.ElementType;
    className: string;
    activeClassName: string;
  }
> = {
  aberta: {
    label: 'Aberta',
    actionLabel: 'Reabrir',
    savingLabel: 'Reabrindo conversa…',
    successLabel: 'Conversa reaberta',
    description: 'A equipe pode enviar e receber mensagens normalmente.',
    successDescription: 'Ela já está aberta e pronta para receber novas mensagens.',
    icon: CircleDot,
    className: 'border-success/20 bg-success/10 text-success hover:bg-success/15',
    activeClassName:
      'data-[state=on]:bg-success/15 data-[state=on]:text-success data-[state=on]:shadow-sm',
  },
  fechada: {
    label: 'Fechada',
    actionLabel: 'Fechar',
    savingLabel: 'Fechando conversa…',
    successLabel: 'Conversa fechada',
    description: 'O envio fica bloqueado até a conversa ser reaberta.',
    successDescription: 'Ela já está fechada. Reabra a conversa para enviar novas mensagens.',
    icon: CheckCircle2,
    className: 'border-border bg-muted text-muted-foreground hover:bg-muted/80',
    activeClassName:
      'data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm',
  },
  arquivada: {
    label: 'Arquivada',
    actionLabel: 'Arquivar',
    savingLabel: 'Arquivando conversa…',
    successLabel: 'Conversa arquivada',
    description: 'A conversa fica guardada fora do fluxo ativo.',
    successDescription: 'Ela já está arquivada e saiu do fluxo de conversas ativas.',
    icon: Archive,
    className: 'border-warning/20 bg-warning/10 text-warning hover:bg-warning/15',
    activeClassName:
      'data-[state=on]:bg-warning/15 data-[state=on]:text-warning data-[state=on]:shadow-sm',
  },
};

const statusOptions = Object.entries(statusConfig) as [
  ConversationStatus,
  (typeof statusConfig)[ConversationStatus],
][];

interface ConversationStatusControlProps {
  sessionId: string;
}

/** Status atual + seletor e retorno explícito do resultado da alteração. */
const ConversationStatusControl = ({ sessionId }: ConversationStatusControlProps) => {
  const {
    getStatus,
    mudandoStatus,
    fecharConversa,
    arquivarConversa,
    reabrirConversa,
  } = useConversationStatus();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<StatusFeedback | null>(null);

  const status = getStatus(sessionId);
  const config = statusConfig[status];
  const Icon = config.icon;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && !open) setFeedback(null);
    setOpen(nextOpen);
  };

  const handleStatusChange = (nextStatus: string) => {
    if (!nextStatus || nextStatus === status || mudandoStatus) return;

    const requestedStatus = nextStatus as ConversationStatus;
    const callbacks = {
      onSuccess: () => setFeedback({ status: requestedStatus, phase: 'success' }),
      onError: () => setFeedback({ status: requestedStatus, phase: 'error' }),
    };

    setFeedback({ status: requestedStatus, phase: 'saving' });
    if (requestedStatus === 'aberta') reabrirConversa(sessionId, callbacks);
    if (requestedStatus === 'fechada') fecharConversa(sessionId, callbacks);
    if (requestedStatus === 'arquivada') arquivarConversa(sessionId, callbacks);
  };

  const feedbackConfig = feedback ? statusConfig[feedback.status] : null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            config.className
          )}
          aria-busy={mudandoStatus}
          aria-label={`Status da conversa: ${config.label}. Abrir ações de status`}
        >
          {mudandoStatus ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Icon className="h-3 w-3" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{config.label}</span>
          <ChevronDown className="h-3 w-3 opacity-70" aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 max-w-[calc(100vw-1.5rem)] space-y-3 p-3"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Status da conversa</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {config.description}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Fechar seletor de status"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <ToggleGroup
          type="single"
          value={status}
          onValueChange={handleStatusChange}
          disabled={mudandoStatus}
          aria-label="Alterar status da conversa"
          className="grid grid-cols-3 gap-1 rounded-lg bg-muted/70 p-1"
        >
          {statusOptions.map(([value, option]) => {
            const OptionIcon = option.icon;
            const isSavingThisStatus =
              feedback?.phase === 'saving' && feedback.status === value;

            return (
              <ToggleGroupItem
                key={value}
                value={value}
                aria-label={
                  value === status
                    ? `Status atual: ${option.label}`
                    : `${option.actionLabel} conversa`
                }
                className={cn(
                  'h-auto min-w-0 flex-col gap-1 rounded-md px-2 py-2 text-[11px] leading-none',
                  'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                  option.activeClassName
                )}
              >
                {isSavingThisStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : value === 'aberta' && status !== 'aberta' ? (
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <OptionIcon className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{value === 'aberta' && status !== 'aberta' ? 'Reabrir' : option.label}</span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>

        {feedback && feedbackConfig && (
          <div className="space-y-2">
            <div
              role={feedback.phase === 'error' ? 'alert' : 'status'}
              aria-live="polite"
              className={cn(
                'flex gap-2.5 rounded-lg border px-3 py-2.5',
                feedback.phase === 'saving' && 'border-primary/20 bg-accent/60',
                feedback.phase === 'success' && 'border-success/25 bg-success/10',
                feedback.phase === 'error' && 'border-destructive/25 bg-destructive/10'
              )}
            >
              {feedback.phase === 'saving' && (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
              )}
              {feedback.phase === 'success' && (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              )}
              {feedback.phase === 'error' && (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  {feedback.phase === 'saving' && feedbackConfig.savingLabel}
                  {feedback.phase === 'success' && feedbackConfig.successLabel}
                  {feedback.phase === 'error' && 'Não foi possível alterar o status'}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {feedback.phase === 'saving' && 'Aguarde a confirmação antes de continuar.'}
                  {feedback.phase === 'success' && feedbackConfig.successDescription}
                  {feedback.phase === 'error' && 'O estado anterior foi restaurado. Tente novamente.'}
                </p>
              </div>
            </div>

            {feedback.phase !== 'saving' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Entendi
                </button>
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Todos os usuários da equipe podem alterar este status. A mudança aparece para todos.
        </p>
      </PopoverContent>
    </Popover>
  );
};

export default ConversationStatusControl;
