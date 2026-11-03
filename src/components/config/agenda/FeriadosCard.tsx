import { useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Campo, SelectNativo } from '@/components/config/atendimento/campos';
import { mensagemErro } from '@/components/config/atendimento/erros';
import type { AgendaFeriado } from '@/hooks/useAgendaConfiguracao';

const dataBR = (iso: string) => iso.split('-').reverse().join('/');

/** Feriados e fechamentos: nenhum horário é oferecido nessas datas (todas as agendas ou só uma). */
export function FeriadosCard({
  feriados, agendas, disponivel, onCriar, onRemover,
}: {
  feriados: AgendaFeriado[];
  agendas: Array<{ id: string; nome: string }>;
  disponivel: boolean;
  onCriar: (valores: { data: string; descricao: string; diaInteiro: boolean; inicio: string | null; fim: string | null; regraId: string | null }) => Promise<unknown>;
  onRemover: (id: string) => Promise<unknown>;
}) {
  const [data, setData] = useState('');
  const [descricao, setDescricao] = useState('');
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [inicio, setInicio] = useState('12:00');
  const [fim, setFim] = useState('18:00');
  const [regraId, setRegraId] = useState('');
  const hoje = new Date().toISOString().slice(0, 10);
  const futuros = feriados.filter((f) => f.data >= hoje);
  const passados = feriados.filter((f) => f.data < hoje).length;

  if (!disponivel) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feriados e fechamentos</CardTitle>
          <CardDescription>Aplique a migração <code>20261027110000_agenda_motor_configuravel</code> para liberar.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const adicionar = async () => {
    if (!data) return toast.error('Informe a data');
    if (!diaInteiro && inicio >= fim) return toast.error('O início precisa ser antes do fim');
    try {
      await onCriar({ data, descricao, diaInteiro, inicio: diaInteiro ? null : inicio, fim: diaInteiro ? null : fim, regraId: regraId || null });
      toast.success('Fechamento cadastrado');
      setData(''); setDescricao('');
    } catch (erro) {
      toast.error('Não foi possível salvar', { description: /duplicate|unique/i.test(mensagemErro(erro)) ? 'Já existe um fechamento nessa data para essa agenda.' : mensagemErro(erro) });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><CalendarOff className="h-4 w-4" /> Feriados e fechamentos</CardTitle>
        <CardDescription>Nessas datas o assistente não oferece horários — vale para todas as agendas ou apenas para uma.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4 md:items-end">
          <Campo id="fer-data" rotulo="Data"><Input id="fer-data" type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
          <Campo id="fer-desc" rotulo="Motivo"><Input id="fer-desc" value={descricao} maxLength={120} placeholder="Ex.: Natal" onChange={(e) => setDescricao(e.target.value)} /></Campo>
          <Campo id="fer-agenda" rotulo="Vale para">
            <SelectNativo id="fer-agenda" value={regraId} onChange={setRegraId}>
              <option value="">Todas as agendas</option>
              {agendas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </SelectNativo>
          </Campo>
          <label className="flex items-center gap-2 pb-2 text-sm"><Checkbox checked={diaInteiro} onCheckedChange={(v) => setDiaInteiro(!!v)} /> Dia inteiro</label>
          {!diaInteiro && (
            <>
              <Campo id="fer-ini" rotulo="Fechado de"><Input id="fer-ini" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo>
              <Campo id="fer-fim" rotulo="até"><Input id="fer-fim" type="time" value={fim} onChange={(e) => setFim(e.target.value)} /></Campo>
            </>
          )}
          <Button onClick={adicionar}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
        </div>
        {futuros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum fechamento futuro cadastrado.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {futuros.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="w-24 font-medium">{dataBR(f.data)}</span>
                <span className="flex-1">{f.descricao || 'Fechamento'}</span>
                <Badge variant="outline">{f.dia_inteiro ? 'Dia inteiro' : `${(f.inicio ?? '').slice(0, 5)}–${(f.fim ?? '').slice(0, 5)}`}</Badge>
                <Badge variant="secondary">{f.regra_id ? agendas.find((a) => a.id === f.regra_id)?.nome ?? 'Uma agenda' : 'Todas as agendas'}</Badge>
                <Button variant="ghost" size="icon" aria-label="Remover fechamento" onClick={async () => { try { await onRemover(f.id); toast.success('Fechamento removido'); } catch (e) { toast.error('Não foi possível remover', { description: mensagemErro(e) }); } }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
        {passados > 0 && <p className="text-xs text-muted-foreground">{passados} fechamento(s) já passado(s) não são exibidos.</p>}
      </CardContent>
    </Card>
  );
}
