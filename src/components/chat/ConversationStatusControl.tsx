import {
  Archive,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ConversationStatus } from '@/types/chat';
import { useConversationStatus } from '@/hooks/useConversationStatus';

const statusConfig: Record<
  ConversationStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  aberta: {
    label: 'Aberta',
    icon: CircleDot,
    className: 'border-success/20 bg-success/10 text-success hover:bg-success/15',
  },
  fechada: {
    label: 'Fechada',
    icon: CheckCircle2,
    className: 'border-border bg-muted text-muted-foreground hover:bg-muted/80',
  },
  arquivada: {
    label: 'Arquivada',
    icon: Archive,
    className: 'border-warning/20 bg-warning/10 text-warning hover:bg-warning/15',
  },
};

interface ConversationStatusControlProps {
  sessionId: string;
}

/**
 * Badge com o status da conversa (aberta/fechada/arquivada) + menu para
 * fechar, arquivar ou reabrir. Fica no header da thread do chat.
 */
const ConversationStatusControl = ({ sessionId }: ConversationStatusControlProps) => {
  const {
    getStatus,
    mudandoStatus,
    fecharConversa,
    arquivarConversa,
    reabrirConversa,
  } = useConversationStatus();

  const status = getStatus(sessionId);
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={mudandoStatus}
          className={cn(
            'inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
            config.className
          )}
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
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {status !== 'aberta' && (
          <DropdownMenuItem className="gap-2" onClick={() => reabrirConversa(sessionId)}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reabrir conversa
          </DropdownMenuItem>
        )}
        {status === 'aberta' && (
          <DropdownMenuItem className="gap-2" onClick={() => fecharConversa(sessionId)}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Fechar conversa
          </DropdownMenuItem>
        )}
        {status !== 'arquivada' && (
          <DropdownMenuItem className="gap-2" onClick={() => arquivarConversa(sessionId)}>
            <Archive className="h-4 w-4" aria-hidden="true" />
            Arquivar conversa
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ConversationStatusControl;
