import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  EVENTOS_AGENDA, type AtendimentoEstado, type EscopoNotificacao, type NotificacaoDestinatario,
} from '@/types/atendimentoConfig';
import { formatarTelefone, normalizarTelefone } from '@/utils/telefone';
import { Campo, SelectNativo } from './campos';
import { mensagemErro } from './erros';

type Rascunho = {
  id?: string;
  nome: string;
  telefone: string;
  eventos: string[];
  escopo: EscopoNotificacao;
  unidade: string;
  profissional_id: string;
  departamento_id: string;
  ativo: boolean;
  observacao: string;
};

const vazio: Rascunho = {
  nome: '', telefone: '', eventos: [], escopo: 'global', unidade: '', profissional_id: '', departamento_id: '', ativo: true, observacao: '',
};

export function DestinatariosCard({
  destinatarios, estados, profissionais, departamentos, codigoPais, onSalvar, onRemover,
}: {
  destinatarios: NotificacaoDestinatario[];
  estados: AtendimentoEstado[];
  profissionais: Array<{ id: string; nome: string }>;
  departamentos: Array<{ id: number; nome: string }>;
  codigoPais: string;
  onSalvar: (valores: Partial<NotificacaoDestinatario> & { telefone: string; nome: string }) => Promise<unknown>;
  onRemover: (id: string) => Promise<unknown>;
}) {
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const eventosDisponiveis = useMemo(
    () => [
      ...estados.filter((e) => e.notificar && e.ativo).map((e) => ({ chave: e.chave, nome: e.nome })),
      ...EVENTOS_AGENDA.map((e) => ({ chave: e.chave, nome: e.nome })),
    ],
    [estados],
  );
  const nomeEvento = (chave: string) => eventosDisponiveis.find((e) => e.chave === chave)?.nome ?? chave;
  const telefoneValido = rascunho ? normalizarTelefone(rascunho.telefone, codigoPais) : null;

  const salvar = async () => {
    if (!rascunho) return;
    if (!rascunho.nome.trim()) return toast.error('Informe um nome');
    if (!telefoneValido) return toast.error('Telefone inválido', { description: 'Use DDD + número (ex.: 61 98283-4411).' });
    if (!rascunho.eventos.length) return toast.error('Escolha ao menos um evento');
    if (rascunho.escopo === 'unidade' && !rascunho.unidade.trim()) return toast.error('Informe a unidade');
    if (rascunho.escopo === 'profissional' && !rascunho.profissional_id) return toast.error('Escolha o profissional');
    if (rascunho.escopo === 'departamento' && !rascunho.departamento_id) return toast.error('Escolha o setor');
    try {
      await onSalvar({
        id: rascunho.id,
        nome: rascunho.nome.trim(),
        telefone: telefoneValido,
        eventos: rascunho.eventos,
        escopo: rascunho.escopo,
        unidade: rascunho.escopo === 'unidade' ? rascunho.unidade.trim() : null,
        profissional_id: rascunho.escopo === 'profissional' ? rascunho.profissional_id : null,
        departamento_id: rascunho.escopo === 'departamento' ? Number(rascunho.departamento_id) : null,
        ativo: rascunho.ativo,
        observacao: rascunho.observacao.trim() || null,
      });
      toast.success('Destinatário salvo');
      setRascunho(null);
    } catch (erro) {
      toast.error('Não foi possível salvar', { description: mensagemErro(erro) });
    }
  };

  const descreverEscopo = (d: NotificacaoDestinatario) => {
    if (d.escopo === 'unidade') return `Unidade: ${d.unidade}`;
    if (d.escopo === 'profissional') return `Profissional: ${profissionais.find((p) => p.id === d.profissional_id)?.nome ?? '—'}`;
    if (d.escopo === 'departamento') return `Setor: ${departamentos.find((p) => p.id === d.departamento_id)?.nome ?? '—'}`;
    return 'Todos os atendimentos';
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Quem recebe notificações</CardTitle>
          <CardDescription>
            Telefones que recebem, por WhatsApp, o aviso de cada evento. As mudanças valem na próxima notificação — sem republicar nada.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setRascunho({ ...vazio })}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {destinatarios.length === 0 && <p className="text-sm text-muted-foreground">Nenhum destinatário cadastrado: ninguém será avisado.</p>}
        {destinatarios.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">{d.nome} <span className="font-normal text-muted-foreground">· {formatarTelefone(d.telefone)}</span></p>
              <p className="text-xs text-muted-foreground">{descreverEscopo(d)}</p>
              <div className="flex flex-wrap gap-1">{d.eventos.map((e) => <Badge key={e} variant="secondary">{nomeEvento(e)}</Badge>)}</div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={d.ativo}
                aria-label={`Ativar ${d.nome}`}
                onCheckedChange={(ativo) => onSalvar({ id: d.id, nome: d.nome, telefone: d.telefone, ativo }).catch((e) => toast.error('Erro', { description: mensagemErro(e) }))}
              />
              <Button size="icon" variant="ghost" aria-label={`Editar ${d.nome}`} onClick={() => setRascunho({
                id: d.id, nome: d.nome, telefone: d.telefone, eventos: d.eventos, escopo: d.escopo, unidade: d.unidade ?? '',
                profissional_id: d.profissional_id ?? '', departamento_id: d.departamento_id?.toString() ?? '', ativo: d.ativo, observacao: d.observacao ?? '',
              })}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label={`Remover ${d.nome}`} onClick={() => {
                if (window.confirm(`Remover ${d.nome} das notificações?`)) {
                  onRemover(d.id).catch((e) => toast.error('Erro', { description: mensagemErro(e) }));
                }
              }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}

        {rascunho && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Campo id="dest-nome" rotulo="Nome"><Input id="dest-nome" value={rascunho.nome} maxLength={80} onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} /></Campo>
              <Campo id="dest-tel" rotulo="WhatsApp" ajuda={rascunho.telefone ? (telefoneValido ? `Será usado: ${formatarTelefone(telefoneValido)}` : 'Número inválido') : 'DDD + número'}>
                <Input id="dest-tel" inputMode="tel" value={rascunho.telefone} onChange={(e) => setRascunho({ ...rascunho, telefone: e.target.value })} />
              </Campo>
              <Campo id="dest-escopo" rotulo="Recebe avisos de">
                <SelectNativo id="dest-escopo" value={rascunho.escopo} onChange={(v) => setRascunho({ ...rascunho, escopo: v as EscopoNotificacao })}>
                  <option value="global">Todos os atendimentos</option>
                  <option value="unidade">Uma unidade</option>
                  <option value="profissional">Um profissional</option>
                  <option value="departamento">Um setor</option>
                </SelectNativo>
              </Campo>
              {rascunho.escopo === 'unidade' && (
                <Campo id="dest-unidade" rotulo="Unidade"><Input id="dest-unidade" value={rascunho.unidade} onChange={(e) => setRascunho({ ...rascunho, unidade: e.target.value })} /></Campo>
              )}
              {rascunho.escopo === 'profissional' && (
                <Campo id="dest-prof" rotulo="Profissional">
                  <SelectNativo id="dest-prof" value={rascunho.profissional_id} onChange={(v) => setRascunho({ ...rascunho, profissional_id: v })}>
                    <option value="">Selecione…</option>
                    {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </SelectNativo>
                </Campo>
              )}
              {rascunho.escopo === 'departamento' && (
                <Campo id="dest-setor" rotulo="Setor">
                  <SelectNativo id="dest-setor" value={rascunho.departamento_id} onChange={(v) => setRascunho({ ...rascunho, departamento_id: v })}>
                    <option value="">Selecione…</option>
                    {departamentos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </SelectNativo>
                </Campo>
              )}
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Eventos</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {eventosDisponiveis.map((evento) => (
                  <label key={evento.chave} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={rascunho.eventos.includes(evento.chave)}
                      onCheckedChange={(marcado) => setRascunho({
                        ...rascunho,
                        eventos: marcado ? [...rascunho.eventos, evento.chave] : rascunho.eventos.filter((c) => c !== evento.chave),
                      })}
                    />
                    {evento.nome}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex gap-2">
              <Button onClick={salvar}>Salvar destinatário</Button>
              <Button variant="outline" onClick={() => setRascunho(null)}>Cancelar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
