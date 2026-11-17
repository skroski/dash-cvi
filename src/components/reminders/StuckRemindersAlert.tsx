import React from 'react';
import { AlertTriangle, CheckCheck, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StuckRemindersAlertProps {
  count: number;
  onUnlock: (action: 'pendente' | 'enviado' | 'falha') => void;
  loading?: boolean;
}

export const StuckRemindersAlert: React.FC<StuckRemindersAlertProps> = ({
  count,
  onUnlock,
  loading = false,
}) => {
  if (count <= 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 text-amber-950 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">
            {count} {count === 1 ? 'lembrete está' : 'lembretes estão'} em estado &quot;Enviando&quot;
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground dark:text-amber-200/80">
            Se o envio automático foi interrompido ou demorou, você pode destravar e resolver diretamente por aqui:
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
        <Button
          type="button"
          size="sm"
          onClick={() => onUnlock('pendente')}
          disabled={loading}
          className="min-h-8 gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm"
          title="Destrava os itens e coloca de volta na fila para envio imediato com intervalo seguro"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          Tentar de novo (Devolver à fila)
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onUnlock('enviado')}
          disabled={loading}
          className="min-h-8 gap-1.5 text-xs border-emerald-600/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
          title="Se as mensagens já chegaram no WhatsApp do cliente, marque como enviado"
        >
          <CheckCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          Marcar Enviado(s)
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onUnlock('falha')}
          disabled={loading}
          className="min-h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="Marca como falha para permitir revisão humana individual"
        >
          <XCircle className="h-3.5 w-3.5" />
          Marcar como Falha
        </Button>
      </div>
    </div>
  );
};

export default StuckRemindersAlert;

