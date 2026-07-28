import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useStatusAtendentes } from '@/hooks/useStatusAtendentes';
import {
  STATUS_META,
  STATUS_ORDEM,
  StatusOperacional,
  formatarTempoNoStatus,
} from '@/types/perfil';

/**
 * Controle do próprio status operacional, no header. Só aparece para quem tem
 * um cadastro de atendente vinculado ao login.
 *
 * Trocar para um status que bloqueia novas atribuições pede confirmação
 * explícita, deixando claro o efeito prático antes de aplicar.
 */
const StatusSelector = () => {
  const { perfil } = useAuth();
  const { statusPorAtendente, setupPendente, definirStatus } = useStatusAtendentes();
  const [pendente, setPendente] = useState<StatusOperacional | null>(null);
  const [motivo, setMotivo] = useState('');
  const [previsao, setPrevisao] = useState('');
  // Recalcula o "há quanto tempo" sem depender de nova busca no servidor.
  const [, forcarTick] = useState(0);

  const atendenteId = perfil?.atendenteId ?? null;
  const atual = atendenteId !== null ? statusPorAtendente.get(atendenteId) : undefined;

  useEffect(() => {
    const timer = window.setInterval(() => forcarTick((n) => n + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!atendenteId || setupPendente) return null;

  const statusAtual: StatusOperacional = atual?.status ?? 'offline';
  const metaAtual = STATUS_META[statusAtual];

  const aplicar = (status: StatusOperacional, comMotivo?: string, comPrevisao?: string) => {
    definirStatus.mutate({
      atendenteId,
      status,
      motivo: comMotivo?.trim() || null,
      // <input type="time"> devolve "HH:MM"; converte para hoje no fuso local.
      previsaoRetorno: comPrevisao ? horarioParaIso(comPrevisao) : null,
    });
  };

  const selecionar = (status: StatusOperacional) => {
    if (status === statusAtual) return;
    if (!STATUS_META[status].recebeAtribuicao) {
      setMotivo('');
      setPrevisao('');
      setPendente(status);
      return;
    }
    aplicar(status);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-8 items-center gap-1.5 rounded-md border border-input px-2.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-60"
          aria-label={`Seu status: ${metaAtual.label}. Alterar`}
          disabled={definirStatus.isPending}
        >
          <span
            className={cn('h-1.5 w-1.5 shrink-0 rounded-full', metaAtual.dot)}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">{metaAtual.label}</span>
          {atual?.alteradoEm && (
            <span className="hidden text-muted-foreground md:inline">
              · {formatarTempoNoStatus(atual.alteradoEm)}
            </span>
          )}
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {metaAtual.efeito}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_ORDEM.map((status) => {
            const meta = STATUS_META[status];
            return (
              <DropdownMenuItem
                key={status}
                onSelect={() => selecionar(status)}
                className={cn('gap-2', status === statusAtual && 'bg-accent')}
              >
                <span
                  className={cn('h-2 w-2 shrink-0 rounded-full', meta.dot)}
                  aria-hidden="true"
                />
                <span className="flex-1">{meta.label}</span>
                {!meta.recebeAtribuicao && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    sem novas
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={pendente !== null} onOpenChange={(open) => !open && setPendente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Alterar status para {pendente ? STATUS_META[pendente].label : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendente ? STATUS_META[pendente].efeito : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="status-motivo" className="text-xs">
                Motivo <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="status-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: reunião de equipe"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status-previsao" className="text-xs">
                Previsão de retorno <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="status-previsao"
                type="time"
                value={previsao}
                onChange={(e) => setPrevisao(e.target.value)}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendente) aplicar(pendente, motivo, previsao);
                setPendente(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

/** "HH:MM" -> ISO de hoje no fuso local (amanhã se o horário já passou). */
function horarioParaIso(horario: string): string | null {
  const [h, m] = horario.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const data = new Date();
  data.setHours(h, m, 0, 0);
  if (data.getTime() < Date.now()) data.setDate(data.getDate() + 1);
  return data.toISOString();
}

export default StatusSelector;
