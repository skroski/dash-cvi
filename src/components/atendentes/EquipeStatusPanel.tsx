import { useMemo, useState } from 'react';
import { History, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import StatusOperacionalBadge from '@/components/atendentes/StatusOperacionalBadge';
import EmptyState from '@/components/shared/EmptyState';
import { useAtendentes } from '@/hooks/useAtendentes';
import { useAtendimentos } from '@/hooks/useAtendimentos';
import { useStatusAtendentes, useStatusHistorico } from '@/hooks/useStatusAtendentes';
import { formatDayTime } from '@/lib/formatters';
import { Atendente } from '@/types/atendimento';
import { STATUS_META, formatarTempoNoStatus } from '@/types/perfil';

/**
 * Visão de equipe para admin e líder: quem está disponível, há quanto tempo e
 * com quantos atendimentos abertos. Atualiza ao vivo via Realtime.
 */
const EquipeStatusPanel = () => {
  const { atendentes } = useAtendentes();
  const { atendimentos } = useAtendimentos();
  const { statusPorAtendente, setupPendente } = useStatusAtendentes();
  const [historicoDe, setHistoricoDe] = useState<Atendente | null>(null);

  const atendimentosPorAtendente = useMemo(() => {
    const contagem = new Map<number, number>();
    for (const atendimento of atendimentos) {
      if (atendimento.atendenteId === null) continue;
      contagem.set(atendimento.atendenteId, (contagem.get(atendimento.atendenteId) ?? 0) + 1);
    }
    return contagem;
  }, [atendimentos]);

  const equipe = useMemo(() => atendentes.filter((a) => a.ativo), [atendentes]);

  const disponiveis = useMemo(
    () =>
      equipe.filter((a) => {
        const status = statusPorAtendente.get(a.id)?.status;
        return status ? STATUS_META[status]?.recebeAtribuicao : false;
      }).length,
    [equipe, statusPorAtendente]
  );

  if (setupPendente) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Status da equipe</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<UserRound />}
            title="Status operacional ainda não configurado"
            description="Aplique a migração supabase/migrations/20260725120000_status_operacional.sql no SQL Editor do Supabase e recarregue a página."
            className="py-8"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            Status da equipe
            <span className="text-sm font-normal text-muted-foreground">
              {disponiveis} de {equipe.length} disponível(is)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {equipe.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">
              Nenhum atendente ativo cadastrado.
            </p>
          ) : (
            equipe.map((atendente) => {
              const status = statusPorAtendente.get(atendente.id);
              const ativos = atendimentosPorAtendente.get(atendente.id) ?? 0;
              return (
                <div
                  key={atendente.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border bg-card px-2.5 py-2"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{atendente.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {atendente.cargo}
                      {status?.motivo ? ` · ${status.motivo}` : ''}
                      {status?.previsaoRetorno
                        ? ` · volta ${formatDayTime(status.previsaoRetorno)}`
                        : ''}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {ativos} atendimento(s)
                  </span>
                  <StatusOperacionalBadge
                    status={status?.status ?? 'offline'}
                    desde={status?.alteradoEm}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    onClick={() => setHistoricoDe(atendente)}
                    aria-label={`Histórico de status de ${atendente.nome}`}
                  >
                    <History className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <HistoricoDialog
        atendente={historicoDe}
        onOpenChange={(open) => !open && setHistoricoDe(null)}
      />
    </>
  );
};

const HistoricoDialog = ({
  atendente,
  onOpenChange,
}: {
  atendente: Atendente | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const { historico, loading } = useStatusHistorico(atendente?.id ?? null);

  return (
    <Dialog open={!!atendente} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Histórico de status</DialogTitle>
          <DialogDescription>
            Últimas alterações de {atendente?.nome ?? ''}.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : historico.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma alteração registrada ainda.
          </p>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {historico.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border bg-card px-2.5 py-2 text-sm"
              >
                <StatusOperacionalBadge status={item.status} />
                {item.motivo && (
                  <span className="text-xs text-muted-foreground">· {item.motivo}</span>
                )}
                <span className="ml-auto text-xs text-muted-foreground/70">
                  {formatDayTime(item.iniciadoEm)}
                  {item.encerradoEm
                    ? ` · ${formatarTempoNoStatus(
                        item.iniciadoEm,
                        new Date(item.encerradoEm).getTime()
                      )}`
                    : ' · em curso'}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EquipeStatusPanel;
