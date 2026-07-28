import { useMemo } from 'react';
import { ClipboardList, ShieldCheck, Users2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { useAtendentes } from '@/hooks/useAtendentes';
import { useAuditoria } from '@/hooks/useAuditoria';
import { useUsuarios } from '@/hooks/useUsuarios';
import { formatDayTime } from '@/lib/formatters';
import { ACOES_FILTRAVEIS, AuditoriaEvento, descreverAcao } from '@/types/auditoria';
import { PAPEIS, PAPEL_DESCRICAO, PAPEL_LABEL, Papel } from '@/types/perfil';

const SEM_VINCULO = 'sem-vinculo';
const TODOS = 'todos';

const UsersPage = () => {
  const { isAdmin, perfil, setupPendente: authSetupPendente } = useAuth();
  // Segunda barreira: o ModuloGuard já bloqueia a rota, mas a página não confia
  // nisso. Antes das migrações (`authSetupPendente`) o acesso segue como antes.
  const podeVer = isAdmin || authSetupPendente;

  if (!podeVer) {
    return (
      <PageContainer>
        <EmptyState
          icon={<ShieldCheck />}
          title="Acesso restrito"
          description="Esta área é exclusiva de administradores."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Usuários e auditoria"
        description="Gerencie quem acessa o painel, com qual papel, e acompanhe o histórico de ações."
      />

      <Tabs defaultValue="usuarios" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usuarios" className="gap-1.5">
            <Users2 className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <UsuariosTab isAdmin={isAdmin || authSetupPendente} meuId={perfil?.id ?? null} />
        </TabsContent>

        <TabsContent value="auditoria">
          <AuditoriaTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
};

// ---------------------------------------------------------------------------

const UsuariosTab = ({ isAdmin, meuId }: { isAdmin: boolean; meuId: string | null }) => {
  const { usuarios, loading, setupPendente, atualizarPapel, atualizarAtivo, atualizarVinculo } =
    useUsuarios();
  const { atendentes } = useAtendentes();

  const atendentesDisponiveis = useMemo(() => atendentes.filter((a) => a.ativo), [atendentes]);

  if (setupPendente) {
    return (
      <EmptyState
        icon={<Users2 />}
        title="Perfis ainda não configurados"
        description="Aplique a migração supabase/migrations/20260725100000_perfis_papeis.sql no SQL Editor do Supabase e recarregue a página."
      />
    );
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>;
  }

  const pendentes = usuarios.filter((u) => !u.ativo).length;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {usuarios.length} usuário(s)
          {pendentes > 0 && (
            <Badge variant="outline" className="text-amber-700 dark:text-amber-400">
              {pendentes} aguardando liberação
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Atendente vinculado</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((usuario) => {
                const souEu = usuario.id === meuId;
                return (
                  <TableRow key={usuario.id}>
                    <TableCell>
                      <p className="font-medium">
                        {usuario.nome || '—'}
                        {souEu && (
                          <span className="ml-1.5 text-xs text-muted-foreground">(você)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{usuario.email}</p>
                    </TableCell>

                    <TableCell>
                      {isAdmin ? (
                        <Select
                          value={usuario.papel}
                          onValueChange={(papel) =>
                            atualizarPapel.mutate({ id: usuario.id, papel: papel as Papel })
                          }
                        >
                          <SelectTrigger className="h-8 w-[150px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAPEIS.map((papel) => (
                              <SelectItem key={papel} value={papel} title={PAPEL_DESCRICAO[papel]}>
                                {PAPEL_LABEL[papel]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm">{PAPEL_LABEL[usuario.papel]}</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {isAdmin ? (
                        <Select
                          value={
                            usuario.atendenteId !== null
                              ? String(usuario.atendenteId)
                              : SEM_VINCULO
                          }
                          onValueChange={(valor) =>
                            atualizarVinculo.mutate({
                              id: usuario.id,
                              atendenteId: valor === SEM_VINCULO ? null : Number(valor),
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-[170px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SEM_VINCULO}>Sem vínculo</SelectItem>
                            {atendentesDisponiveis.map((atendente) => (
                              <SelectItem key={atendente.id} value={String(atendente.id)}>
                                {atendente.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {usuario.atendenteId ?? '—'}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      {usuario.ativo ? (
                        <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Aguardando liberação
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant={usuario.ativo ? 'ghost' : 'default'}
                          className="h-8"
                          disabled={atualizarAtivo.isPending}
                          onClick={() =>
                            atualizarAtivo.mutate({ id: usuario.id, ativo: !usuario.ativo })
                          }
                        >
                          {usuario.ativo ? 'Desativar' : 'Liberar'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------

const AuditoriaTab = () => {
  const {
    eventos,
    total,
    pagina,
    totalPaginas,
    setPagina,
    filtros,
    aplicarFiltros,
    limparFiltros,
    loading,
    fetching,
    setupPendente,
  } = useAuditoria();
  const { atendentes, atendenteById } = useAtendentes();

  if (setupPendente) {
    return (
      <EmptyState
        icon={<ClipboardList />}
        title="Auditoria ainda não configurada"
        description="Aplique a migração supabase/migrations/20260725110000_auditoria.sql no SQL Editor do Supabase e recarregue a página."
      />
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {total} evento(s) {fetching && <span className="text-xs font-normal">atualizando…</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Ação</Label>
            <Select
              value={filtros.acao ?? TODOS}
              onValueChange={(valor) =>
                aplicarFiltros({ acao: valor === TODOS ? null : valor })
              }
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                {ACOES_FILTRAVEIS.map((acao) => (
                  <SelectItem key={acao} value={acao}>
                    {descreverAcao(acao)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Atendente</Label>
            <Select
              value={filtros.atendenteId !== null ? String(filtros.atendenteId) : TODOS}
              onValueChange={(valor) =>
                aplicarFiltros({ atendenteId: valor === TODOS ? null : Number(valor) })
              }
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {atendentes.map((atendente) => (
                  <SelectItem key={atendente.id} value={String(atendente.id)}>
                    {atendente.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auditoria-de" className="text-xs">
              De
            </Label>
            <Input
              id="auditoria-de"
              type="date"
              className="h-9 text-xs"
              value={filtros.de?.slice(0, 10) ?? ''}
              onChange={(e) =>
                aplicarFiltros({
                  de: e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : null,
                })
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auditoria-ate" className="text-xs">
              Até
            </Label>
            <Input
              id="auditoria-ate"
              type="date"
              className="h-9 text-xs"
              value={filtros.ate?.slice(0, 10) ?? ''}
              onChange={(e) =>
                aplicarFiltros({
                  ate: e.target.value ? new Date(`${e.target.value}T23:59:59`).toISOString() : null,
                })
              }
            />
          </div>

          <div className="flex items-end">
            <Button variant="outline" className="h-9 w-full" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : eventos.length === 0 ? (
          <EmptyState
            icon={<ClipboardList />}
            title="Nenhum evento encontrado"
            description="Ajuste os filtros ou aguarde novas ações na operação."
            className="py-8"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Quem fez</TableHead>
                    <TableHead>Detalhe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventos.map((evento) => (
                    <TableRow key={evento.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDayTime(evento.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">{descreverAcao(evento.acao)}</TableCell>
                      <TableCell>{evento.atorNome || 'sistema'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {resumirEvento(evento, (id) => atendenteById.get(id)?.nome)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Página {pagina + 1} de {totalPaginas}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagina === 0}
                  onClick={() => setPagina(pagina - 1)}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagina + 1 >= totalPaginas}
                  onClick={() => setPagina(pagina + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

/** Transforma o JSONB do evento em uma frase curta e legível. */
function resumirEvento(
  evento: AuditoriaEvento,
  nomeAtendente: (id: number) => string | undefined
): string {
  const dados = evento.dados ?? {};
  const nome = (valor: unknown) =>
    typeof valor === 'number' ? nomeAtendente(valor) ?? `#${valor}` : null;

  switch (evento.acao) {
    case 'atendimento.transferido': {
      const de = nome(dados.de_atendente_id) ?? 'sem atendente';
      const para = nome(dados.para_atendente_id) ?? 'sem atendente';
      return `${de} → ${para}`;
    }
    case 'atendimento.atribuido': {
      const para = evento.alvoAtendenteId ? nome(evento.alvoAtendenteId) : null;
      return para ? `para ${para}` : '—';
    }
    case 'status.alterado':
      return `${dados.de ?? '—'} → ${dados.para ?? '—'}`;
    case 'usuario.papel_alterado':
      return `${dados.de ?? '—'} → ${dados.para ?? '—'}`;
    case 'usuario.vinculo_alterado': {
      const para = nome(dados.para_atendente_id) ?? 'sem vínculo';
      return `agora: ${para}`;
    }
    default:
      return evento.alvoAtendenteId ? nome(evento.alvoAtendenteId) ?? '—' : '—';
  }
}

export default UsersPage;
