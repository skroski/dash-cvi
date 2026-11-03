import { useMemo, useState } from 'react';
import { Copy, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { TipoAgendaResumo } from '@/hooks/useAtendimentoConfig';
import { QUEM_AGENDA, type ClinicaServico, type QuemAgenda } from '@/types/atendimentoConfig';
import { lerPreco } from '@/lib/moeda';
import { Campo, SelectNativo } from './campos';
import { mensagemErro } from './erros';

const moeda = (valor: number | null) =>
  valor == null ? null : `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const gerarChave = (nome: string) =>
  nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);

type Rascunho = {
  id?: string;
  chave: string;
  chaveManual: boolean;
  nome: string;
  categoria: string;
  descricao: string;
  preco: string;
  preco_observacao: string;
  quem_agenda: QuemAgenda;
  tipo_agenda_id: string;
  exige_requisicao: boolean;
  aceita_plano: 'indefinido' | 'sim' | 'nao';
  observacoes: string;
  ordem: string;
  ativo: boolean;
};

const NOVO: Rascunho = {
  chave: '', chaveManual: false, nome: '', categoria: '', descricao: '', preco: '', preco_observacao: '',
  quem_agenda: 'recepcao', tipo_agenda_id: '', exige_requisicao: false, aceita_plano: 'indefinido', observacoes: '', ordem: '100', ativo: true,
};

const daLinha = (s: ClinicaServico): Rascunho => ({
  id: s.id, chave: s.chave, chaveManual: true, nome: s.nome, categoria: s.categoria ?? '', descricao: s.descricao ?? '',
  preco: s.preco == null ? '' : String(s.preco).replace('.', ','), preco_observacao: s.preco_observacao ?? '',
  quem_agenda: s.quem_agenda, tipo_agenda_id: s.tipo_agenda_id ?? '', exige_requisicao: s.exige_requisicao,
  aceita_plano: s.aceita_plano == null ? 'indefinido' : s.aceita_plano ? 'sim' : 'nao', observacoes: s.observacoes ?? '', ordem: String(s.ordem), ativo: s.ativo,
});

const COR_QUEM: Record<QuemAgenda, string> = {
  assistente: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  recepcao: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
  sem_agendamento: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30',
  nao_oferece: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
};

/**
 * Serviços e valores: fonte única dos preços e das regras “quem agenda”. O prompt usa
 * {{catalogo_servicos}} e {{preco:chave}}; o assistente só agenda o que aponta para um tipo de agenda.
 */
export function ServicosCard({
  servicos, tipos, disponivel, onSalvar, onRemover,
}: {
  servicos: ClinicaServico[];
  tipos: TipoAgendaResumo[];
  disponivel: boolean;
  onSalvar: (valores: Partial<ClinicaServico> & { chave: string; nome: string }) => Promise<unknown>;
  onRemover: (id: string) => Promise<unknown>;
}) {
  const [busca, setBusca] = useState('');
  const [edit, setEdit] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);

  const categorias = useMemo(() => [...new Set(servicos.map((s) => s.categoria).filter(Boolean) as string[])].sort(), [servicos]);
  const grupos = useMemo(() => {
    const filtro = busca.trim().toLowerCase();
    const visiveis = servicos.filter((s) => !filtro || `${s.nome} ${s.categoria ?? ''} ${s.chave}`.toLowerCase().includes(filtro));
    const mapa = new Map<string, ClinicaServico[]>();
    for (const s of visiveis) mapa.set(s.categoria || 'Sem categoria', [...(mapa.get(s.categoria || 'Sem categoria') ?? []), s]);
    return [...mapa.entries()];
  }, [servicos, busca]);
  const tipoNome = (id: string | null) => tipos.find((t) => t.id === id)?.nome;

  const salvar = async () => {
    if (!edit) return;
    const chave = edit.chave.trim();
    if (!edit.nome.trim()) return toast.error('Informe o nome do serviço');
    if (!/^[a-z0-9_-]{2,80}$/.test(chave)) return toast.error('Chave inválida', { description: 'Use letras minúsculas, números, _ ou -.' });
    const preco = lerPreco(edit.preco);
    if (Number.isNaN(preco)) return toast.error('Valor inválido', { description: 'Use números, ex.: 120 ou 120,50.' });
    if (edit.quem_agenda === 'assistente' && !edit.tipo_agenda_id) {
      return toast.error('Escolha o tipo de agenda', { description: 'Para o assistente agendar, o serviço precisa apontar para um tipo de agendamento.' });
    }
    setSalvando(true);
    try {
      await onSalvar({
        id: edit.id,
        chave,
        nome: edit.nome.trim(),
        categoria: edit.categoria.trim() || null,
        descricao: edit.descricao.trim() || null,
        preco,
        preco_observacao: edit.preco_observacao.trim() || null,
        quem_agenda: edit.quem_agenda,
        tipo_agenda_id: edit.quem_agenda === 'assistente' || edit.tipo_agenda_id ? edit.tipo_agenda_id || null : null,
        exige_requisicao: edit.exige_requisicao,
        aceita_plano: edit.aceita_plano === 'indefinido' ? null : edit.aceita_plano === 'sim',
        observacoes: edit.observacoes.trim() || null,
        ordem: Number(edit.ordem) || 0,
        ativo: edit.ativo,
      });
      toast.success('Serviço salvo');
      setEdit(null);
    } catch (erro) {
      toast.error('Não foi possível salvar', { description: mensagemErro(erro) });
    } finally {
      setSalvando(false);
    }
  };

  const copiar = (texto: string) => {
    void navigator.clipboard?.writeText(texto);
    toast.success(`${texto} copiado`);
  };

  if (!disponivel) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Serviços e valores</CardTitle>
          <CardDescription>Aplique a migração <code>20261027100000_clinica_configuracao_prompt</code> para liberar o catálogo.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Serviços e valores</CardTitle>
          <CardDescription>
            Cadastre uma vez e use em qualquer regra com <code>{'{{preco:chave}}'}</code>; o assistente recebe o catálogo completo em <code>{'{{catalogo_servicos}}'}</code>.
            Valores aparecem sempre como atendimento particular.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input aria-label="Buscar serviço" className="pl-9" placeholder="Buscar serviço ou categoria…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Button onClick={() => setEdit({ ...NOVO })}><Plus className="mr-1 h-4 w-4" /> Novo serviço</Button>
          </div>

          {servicos.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum serviço cadastrado ainda. Comece por consultas, vacinas e exames com seus valores.
            </p>
          )}

          {grupos.map(([categoria, itens]) => (
            <section key={categoria} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{categoria}</h3>
              <div className="divide-y rounded-lg border">
                {itens.map((s) => (
                  <div key={s.id} className={`flex flex-wrap items-center gap-3 p-3 ${s.ativo ? '' : 'opacity-60'}`}>
                    <div className="min-w-56 flex-1">
                      <p className="text-sm font-medium">{s.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        <button type="button" className="inline-flex items-center gap-1 font-mono hover:text-foreground" onClick={() => copiar(`{{preco:${s.chave}}}`)} title="Copiar variável de preço">
                          <Copy className="h-3 w-3" />{s.chave}
                        </button>
                        {s.tipo_agenda_id && <> · agenda: {tipoNome(s.tipo_agenda_id) ?? '—'}</>}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      {s.preco != null ? <span className="font-semibold">{moeda(s.preco)}</span> : <span className="text-xs text-muted-foreground">sem valor</span>}
                      {s.preco_observacao && <p className="text-xs text-muted-foreground">{s.preco_observacao}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={COR_QUEM[s.quem_agenda]}>{QUEM_AGENDA.find((q) => q.chave === s.quem_agenda)?.nome}</Badge>
                      {s.exige_requisicao && <Badge variant="outline">Exige requisição</Badge>}
                      {s.aceita_plano === true && <Badge variant="outline">Aceita plano</Badge>}
                      {s.aceita_plano === false && <Badge variant="outline">Sem plano</Badge>}
                      {!s.ativo && <Badge variant="secondary">Inativo</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Editar ${s.nome}`} onClick={() => setEdit(daLinha(s))}><Pencil className="h-4 w-4" /></Button>
                      <Button
                        variant="ghost" size="icon" aria-label={`Remover ${s.nome}`}
                        onClick={async () => {
                          if (!window.confirm(`Remover “${s.nome}”? Regras que usam {{preco:${s.chave}}} passarão a ficar sem o valor.`)) return;
                          try { await onRemover(s.id); toast.success('Serviço removido'); } catch (erro) { toast.error('Não foi possível remover', { description: mensagemErro(erro) }); }
                        }}
                      ><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(aberto) => !aberto && setEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit?.id ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
            <DialogDescription>Defina o que o assistente pode dizer e fazer com este serviço.</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="grid gap-4 md:grid-cols-2">
              <Campo id="srv-nome" rotulo="Nome do serviço">
                <Input
                  id="srv-nome" value={edit.nome} maxLength={120}
                  onChange={(e) => setEdit({ ...edit, nome: e.target.value, chave: edit.chaveManual ? edit.chave : gerarChave(e.target.value) })}
                />
              </Campo>
              <Campo id="srv-chave" rotulo="Chave" ajuda="Usada nas variáveis, ex.: {{preco:chave}}. Não muda depois de usada.">
                <Input id="srv-chave" value={edit.chave} disabled={!!edit.id} className="font-mono text-xs" onChange={(e) => setEdit({ ...edit, chave: e.target.value, chaveManual: true })} />
              </Campo>
              <Campo id="srv-cat" rotulo="Categoria">
                <Input id="srv-cat" list="srv-categorias" value={edit.categoria} maxLength={60} onChange={(e) => setEdit({ ...edit, categoria: e.target.value })} />
                <datalist id="srv-categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
              </Campo>
              <Campo id="srv-ordem" rotulo="Ordem na lista">
                <Input id="srv-ordem" type="number" value={edit.ordem} onChange={(e) => setEdit({ ...edit, ordem: e.target.value })} />
              </Campo>
              <Campo id="srv-preco" rotulo="Valor particular (R$)" ajuda="Deixe vazio se o valor é combinado com a recepção.">
                <Input id="srv-preco" inputMode="decimal" placeholder="120,00" value={edit.preco} onChange={(e) => setEdit({ ...edit, preco: e.target.value })} />
              </Campo>
              <Campo id="srv-preco-obs" rotulo="Observação do valor" ajuda="Ex.: Plantão: R$ 350,00">
                <Input id="srv-preco-obs" value={edit.preco_observacao} maxLength={120} onChange={(e) => setEdit({ ...edit, preco_observacao: e.target.value })} />
              </Campo>
              <Campo id="srv-quem" rotulo="Quem agenda" ajuda={QUEM_AGENDA.find((q) => q.chave === edit.quem_agenda)?.ajuda}>
                <SelectNativo id="srv-quem" value={edit.quem_agenda} onChange={(v) => setEdit({ ...edit, quem_agenda: v as QuemAgenda })}>
                  {QUEM_AGENDA.map((q) => <option key={q.chave} value={q.chave}>{q.nome}</option>)}
                </SelectNativo>
              </Campo>
              <Campo id="srv-tipo" rotulo="Tipo de agenda" ajuda={edit.quem_agenda === 'assistente' ? 'Obrigatório quando o assistente agenda.' : 'Opcional: liga o valor ao tipo de agendamento.'}>
                <SelectNativo id="srv-tipo" value={edit.tipo_agenda_id} onChange={(v) => setEdit({ ...edit, tipo_agenda_id: v })}>
                  <option value="">Nenhum</option>
                  {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}{t.ativo ? '' : ' (inativo)'}</option>)}
                </SelectNativo>
              </Campo>
              <div className="md:col-span-2">
                <Campo id="srv-desc" rotulo="Descrição para o assistente">
                  <Textarea id="srv-desc" rows={2} value={edit.descricao} maxLength={600} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} />
                </Campo>
              </div>
              <div className="md:col-span-2">
                <Campo id="srv-obs" rotulo="Orientações adicionais" ajuda="Preparo, restrições, o que informar ao cliente.">
                  <Textarea id="srv-obs" rows={2} value={edit.observacoes} maxLength={1000} onChange={(e) => setEdit({ ...edit, observacoes: e.target.value })} />
                </Campo>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={edit.exige_requisicao} onCheckedChange={(v) => setEdit({ ...edit, exige_requisicao: !!v })} /> Exige requisição ou encaminhamento
              </label>
              <Campo id="srv-plano" rotulo="Planos e convênios">
                <SelectNativo id="srv-plano" value={edit.aceita_plano} onChange={(v) => setEdit({ ...edit, aceita_plano: v as Rascunho['aceita_plano'] })}>
                  <option value="indefinido">Não informar</option>
                  <option value="sim">Aceita plano/convênio</option>
                  <option value="nao">Somente particular</option>
                </SelectNativo>
              </Campo>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} /> Serviço ativo (aparece para o assistente)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar serviço'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
