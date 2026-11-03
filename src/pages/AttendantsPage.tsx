import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Headset,
  MessageSquare,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatCard from '@/components/shared/StatCard';
import AtendenteFormDialog from '@/components/atendentes/AtendenteFormDialog';
import DepartamentoManagerDialog from '@/components/atendentes/DepartamentoManagerDialog';
import AtendimentoDialog from '@/components/atendentes/AtendimentoDialog';
import EquipeStatusPanel from '@/components/atendentes/EquipeStatusPanel';
import { useAuth } from '@/context/AuthContext';
import { useAtendentes } from '@/hooks/useAtendentes';
import { useAtendimentos } from '@/hooks/useAtendimentos';
import { supabase } from '@/integrations/supabase/client';
import { formatDayTime } from '@/lib/formatters';
import { Atendente, Atendimento } from '@/types/atendimento';

const AttendantsPage = () => {
  const {
    departamentos,
    atendentes,
    loading,
    setupError,
    atendenteById,
    departamentoById,
    atendentesPorDepartamento,
    deleteAtendente,
  } = useAtendentes();
  const { atendimentos, transferencias, encerrar } = useAtendimentos();
  const { isGestor, setupPendente } = useAuth();

  const [departamentosDialogOpen, setDepartamentosDialogOpen] = useState(false);
  const [atendenteFormOpen, setAtendenteFormOpen] = useState(false);
  const [atendenteEmEdicao, setAtendenteEmEdicao] = useState<Atendente | null>(null);
  const [atendenteParaRemover, setAtendenteParaRemover] = useState<Atendente | null>(null);
  const [atendimentoParaTransferir, setAtendimentoParaTransferir] =
    useState<Atendimento | null>(null);

  // Nomes dos clientes das conversas em atendimento
  const sessionIds = useMemo(
    () => atendimentos.map((a) => a.sessionId).sort(),
    [atendimentos]
  );
  const clientesQuery = useQuery({
    queryKey: ['atendimento-clientes', sessionIds],
    enabled: sessionIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dados_cliente')
        .select('sessionid, nome, telefone')
        .in('sessionid', sessionIds);
      if (error) throw error;
      return data || [];
    },
  });

  const clientePorSession = useMemo(() => {
    const map = new Map<string, { nome: string | null; telefone: string | null }>();
    for (const row of clientesQuery.data || []) {
      if (row.sessionid) map.set(row.sessionid, { nome: row.nome, telefone: row.telefone });
    }
    return map;
  }, [clientesQuery.data]);

  const nomeCliente = (sessionId: string) => {
    const cliente = clientePorSession.get(sessionId);
    return cliente?.nome || cliente?.telefone || sessionId.split('@')[0];
  };

  const abrirNovoAtendente = () => {
    setAtendenteEmEdicao(null);
    setAtendenteFormOpen(true);
  };

  const abrirEdicaoAtendente = (atendente: Atendente) => {
    setAtendenteEmEdicao(atendente);
    setAtendenteFormOpen(true);
  };

  const renderAtendenteRow = (atendente: Atendente) => (
    <div
      key={atendente.id}
      className="flex items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <UserRound className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            {atendente.nome}
            {!atendente.ativo && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Inativo
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{atendente.cargo}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-primary"
          onClick={() => abrirEdicaoAtendente(atendente)}
          aria-label={`Editar ${atendente.nome}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => setAtendenteParaRemover(atendente)}
          aria-label={`Remover ${atendente.nome}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  const semDepartamento = atendentesPorDepartamento.get(null) || [];

  return (
    <PageContainer>
      <PageHeader
        title="Atendentes e Departamentos"
        dataTour="attendants-header"
        description="Gerencie a equipe, vincule conversas e acompanhe transferências de atendimento."
        actions={
          <>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => setDepartamentosDialogOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
              Departamentos
            </Button>
            <Button className="gap-1.5" onClick={abrirNovoAtendente}>
              <Plus className="h-4 w-4" />
              Novo atendente
            </Button>
          </>
        }
      />

      {setupError ? (
        <EmptyState
          icon={<Headset />}
          title="Módulo ainda não configurado"
          description="Aplique a migração de atendentes/departamentos no SQL Editor do Supabase (supabase/migrations/20260709150000_atendentes_departamentos.sql) e recarregue a página."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-tour="attendants-stats">
            <StatCard
              title="Atendentes ativos"
              value={atendentes.filter((a) => a.ativo).length}
              icon={<Headset />}
              loading={loading}
            />
            <StatCard
              title="Departamentos"
              value={departamentos.length}
              icon={<Building2 />}
              loading={loading}
            />
            <StatCard
              title="Atendimentos em andamento"
              value={atendimentos.length}
              icon={<MessageSquare />}
              tone="success"
              loading={loading}
            />
            <StatCard
              title="Transferências recentes"
              value={transferencias.length}
              icon={<ArrowRightLeft />}
              tone="warning"
              loading={loading}
            />
          </div>

          {/* Visão de equipe: admin e líder. Antes das migrações de perfil,
              `setupPendente` mantém o painel visível para todo mundo, como era. */}
          {(isGestor || setupPendente) && (
            <div data-tour="attendants-status-panel">
              <EquipeStatusPanel />
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2" data-tour="attendants-departments">
            {departamentos.map((departamento) => {
              const equipe = atendentesPorDepartamento.get(departamento.id) || [];
              return (
                <Card key={departamento.id} className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: departamento.cor }}
                        aria-hidden="true"
                      />
                      {departamento.nome}
                      <span className="text-sm font-normal text-muted-foreground">
                        {equipe.length} atendente(s)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {equipe.length === 0 ? (
                      <p className="py-3 text-center text-sm text-muted-foreground">
                        Nenhum atendente neste departamento.
                      </p>
                    ) : (
                      equipe.map(renderAtendenteRow)
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {semDepartamento.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span
                      className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40"
                      aria-hidden="true"
                    />
                    Sem departamento
                    <span className="text-sm font-normal text-muted-foreground">
                      {semDepartamento.length} atendente(s)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {semDepartamento.map(renderAtendenteRow)}
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Atendimentos em andamento</CardTitle>
            </CardHeader>
            <CardContent>
              {atendimentos.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare />}
                  title="Nenhum atendimento em andamento"
                  description="Vincule uma conversa a um atendente pela tela de Conversas."
                  className="py-8"
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Atendente</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {atendimentos.map((atendimento) => {
                        const atendente = atendimento.atendenteId
                          ? atendenteById.get(atendimento.atendenteId)
                          : undefined;
                        const departamento = atendimento.departamentoId
                          ? departamentoById.get(atendimento.departamentoId)
                          : undefined;
                        return (
                          <TableRow key={atendimento.id}>
                            <TableCell className="font-medium">
                              {nomeCliente(atendimento.sessionId)}
                            </TableCell>
                            <TableCell>{atendente?.nome || '—'}</TableCell>
                            <TableCell>
                              {departamento ? (
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: departamento.cor }}
                                    aria-hidden="true"
                                  />
                                  {departamento.nome}
                                </span>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDayTime(atendimento.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1"
                                  onClick={() => setAtendimentoParaTransferir(atendimento)}
                                >
                                  <ArrowRightLeft className="h-3.5 w-3.5" />
                                  Transferir
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-1 text-muted-foreground hover:text-success"
                                  disabled={encerrar.isPending}
                                  onClick={() =>
                                    encerrar.mutate({
                                      atendimento,
                                      clienteNome: nomeCliente(atendimento.sessionId),
                                      atendenteNome: atendente?.nome,
                                    })
                                  }
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Encerrar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Transferências recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {transferencias.length === 0 ? (
                <EmptyState
                  icon={<ArrowRightLeft />}
                  title="Nenhuma transferência registrada"
                  description="As transferências entre atendentes e departamentos aparecem aqui."
                  className="py-8"
                />
              ) : (
                <div className="space-y-1.5">
                  {transferencias.map((transferencia) => {
                    const de = transferencia.deAtendenteId
                      ? atendenteById.get(transferencia.deAtendenteId)
                      : undefined;
                    const para = transferencia.paraAtendenteId
                      ? atendenteById.get(transferencia.paraAtendenteId)
                      : undefined;
                    const deDep = transferencia.deDepartamentoId
                      ? departamentoById.get(transferencia.deDepartamentoId)
                      : undefined;
                    const paraDep = transferencia.paraDepartamentoId
                      ? departamentoById.get(transferencia.paraDepartamentoId)
                      : undefined;
                    return (
                      <div
                        key={transferencia.id}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border bg-card px-3 py-2 text-sm"
                      >
                        <ArrowRightLeft
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="font-medium">
                          {de?.nome || 'Sem atendente'}
                          {deDep ? ` (${deDep.nome})` : ''}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">
                          {para?.nome || 'Sem atendente'}
                          {paraDep ? ` (${paraDep.nome})` : ''}
                        </span>
                        {transferencia.motivo && (
                          <span className="text-muted-foreground">
                            · {transferencia.motivo}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground/70">
                          {formatDayTime(transferencia.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <DepartamentoManagerDialog
        open={departamentosDialogOpen}
        onOpenChange={setDepartamentosDialogOpen}
      />

      <AtendenteFormDialog
        open={atendenteFormOpen}
        onOpenChange={setAtendenteFormOpen}
        atendente={atendenteEmEdicao}
      />

      {atendimentoParaTransferir && (
        <AtendimentoDialog
          open={!!atendimentoParaTransferir}
          onOpenChange={(open) => {
            if (!open) setAtendimentoParaTransferir(null);
          }}
          sessionId={atendimentoParaTransferir.sessionId}
          clientId={atendimentoParaTransferir.clientId}
          clienteNome={nomeCliente(atendimentoParaTransferir.sessionId)}
          atendimento={atendimentoParaTransferir}
        />
      )}

      <AlertDialog
        open={!!atendenteParaRemover}
        onOpenChange={(open) => {
          if (!open) setAtendenteParaRemover(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover atendente?</AlertDialogTitle>
            <AlertDialogDescription>
              {atendenteParaRemover
                ? `${atendenteParaRemover.nome} será removido(a) da equipe. Os atendimentos vinculados ficam sem atendente até serem reatribuídos.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (atendenteParaRemover) deleteAtendente.mutate(atendenteParaRemover.id);
                setAtendenteParaRemover(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
};

export default AttendantsPage;
