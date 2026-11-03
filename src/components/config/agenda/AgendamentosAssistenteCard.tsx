import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SelectNativo } from '@/components/config/atendimento/campos';
import { useAgendamentosAssistente } from '@/hooks/useAgendaAvancada';

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Registro dos agendamentos feitos pelo assistente (base do cancelamento/remarcação e da auditoria). */
export function AgendamentosAssistenteCard() {
  const { data, isPending, error, refetch, isFetching } = useAgendamentosAssistente(200);
  const [status, setStatus] = useState('todos');
  const linhas = (data ?? []).filter((l) => status === 'todos' || l.status === status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agendamentos feitos pelo assistente</CardTitle>
        <CardDescription>
          Cada agendamento fica registrado aqui (o assistente só cancela ou remarca o que ele mesmo agendou). Substitui a planilha e o e-mail de auditoria do fluxo antigo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-44"><SelectNativo id="ag-status" value={status} onChange={setStatus}>
            <option value="todos">Todos os status</option>
            <option value="confirmado">Confirmados</option>
            <option value="cancelado">Cancelados</option>
          </SelectNativo></div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar</Button>
        </div>
        {isPending && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {error && <p className="text-sm text-muted-foreground">Registro indisponível: aplique a migração <code>20261027110000_agenda_motor_configuravel</code>.</p>}
        {!isPending && !error && linhas.length === 0 && <p className="text-sm text-muted-foreground">Nenhum agendamento ainda.</p>}
        {linhas.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr><th className="p-2">Quando</th><th className="p-2">Serviço</th><th className="p-2">Profissional</th><th className="p-2">Tutor / pet</th><th className="p-2">Telefone</th><th className="p-2">Status</th></tr>
              </thead>
              <tbody className="divide-y">
                {linhas.map((l) => (
                  <tr key={l.id} className={l.status === 'cancelado' ? 'opacity-60' : ''}>
                    <td className="whitespace-nowrap p-2">{quando(l.inicio)}</td>
                    <td className="p-2">{l.tipo_nome}</td>
                    <td className="p-2">{l.profissional_nome ?? '—'}</td>
                    <td className="p-2">{[l.tutor_nome, l.pet_nome].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="p-2 font-mono text-xs">{l.telefone ?? '—'}</td>
                    <td className="p-2"><Badge variant={l.status === 'confirmado' ? 'default' : 'outline'}>{l.status === 'confirmado' ? 'Confirmado' : l.status === 'cancelado' ? 'Cancelado' : 'Remarcado'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
