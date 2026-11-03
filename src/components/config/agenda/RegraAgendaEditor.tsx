import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Campo } from '@/components/config/atendimento/campos';
import { mensagemErro } from '@/components/config/atendimento/erros';
import type { AgendaEspecialidade, AgendaRegra } from '@/hooks/useAgendaConfiguracao';
import { OPERACOES_AGENDA } from '@/types/atendimentoConfig';
import { marcadoresEventoInvalidos } from './modelosEvento';

const alternar = (atual: string[], chave: string, marcado: boolean) =>
  marcado ? [...new Set([...atual, chave])] : atual.filter((item) => item !== chave);

/** Ajustes de uma agenda (profissional × tipo). Campo vazio = usa o valor do tipo. */
export function RegraAgendaEditor({
  regra, tipo, onSalvar,
}: { regra: AgendaRegra; tipo?: AgendaEspecialidade; onSalvar: (valores: Record<string, unknown>) => Promise<unknown> }) {
  const numero = (valor: number | null | undefined) => (valor == null ? '' : String(valor));
  const [f, setF] = useState({
    nome: regra.nome_exibicao ?? '',
    duracao: numero(regra.duracao_padrao_minutos),
    retorno: numero(regra.duracao_retorno_minutos),
    passo: numero(regra.intervalo_slots_minutos),
    antecedencia: numero(regra.antecedencia_minima_minutos),
    capacidade: numero(regra.capacidade_simultanea),
    pets: numero(regra.max_pets_por_agendamento),
    titulo: regra.titulo_evento_modelo ?? '',
    descricaoEvento: regra.descricao_evento_modelo ?? '',
    local: regra.local_evento ?? '',
    instrucoes: regra.instrucoes_prompt ?? '',
    personalizarOps: !!regra.operacoes_permitidas,
    operacoes: regra.operacoes_permitidas ?? tipo?.operacoes_permitidas ?? OPERACOES_AGENDA.map((o) => o.chave) as string[],
  });
  const set = <K extends keyof typeof f>(campo: K, valor: (typeof f)[K]) => setF((atual) => ({ ...atual, [campo]: valor }));

  const salvar = async () => {
    const n = (valor: string) => (valor.trim() === '' ? null : Number(valor));
    const limites: Array<[string, string, number, number]> = [
      ['Duração', f.duracao, 5, 480], ['Retorno', f.retorno, 5, 480], ['Intervalo', f.passo, 5, 240],
      ['Antecedência', f.antecedencia, 0, 20160], ['Atendimentos simultâneos', f.capacidade, 1, 20], ['Pets por agendamento', f.pets, 1, 10],
    ];
    for (const [rotulo, texto, min, max] of limites) {
      const valor = n(texto);
      if (valor !== null && (!Number.isFinite(valor) || valor < min || valor > max)) return toast.error(`${rotulo}: use um valor entre ${min} e ${max}`);
    }
    const invalidos = [...marcadoresEventoInvalidos(f.titulo), ...marcadoresEventoInvalidos(f.descricaoEvento)];
    if (invalidos.length) return toast.error('Variável desconhecida no modelo do evento', { description: invalidos.join(', ') });
    try {
      await onSalvar({
        id: regra.id,
        nome_exibicao: f.nome.trim() || null,
        duracao_padrao_minutos: n(f.duracao), duracao_retorno_minutos: n(f.retorno), intervalo_slots_minutos: n(f.passo),
        antecedencia_minima_minutos: n(f.antecedencia), capacidade_simultanea: n(f.capacidade), max_pets_por_agendamento: n(f.pets),
        titulo_evento_modelo: f.titulo.trim() || null,
        descricao_evento_modelo: f.descricaoEvento.trim() || null,
        local_evento: f.local.trim() || null,
        instrucoes_prompt: f.instrucoes.trim() || null,
        operacoes_permitidas: f.personalizarOps ? f.operacoes : null,
      });
      toast.success('Ajustes da agenda salvos');
    } catch (erro) {
      toast.error('Não foi possível salvar', { description: mensagemErro(erro) });
    }
  };

  const doTipo = (valor: number | undefined | null) => (valor == null ? '—' : String(valor));
  return (
    <details className="rounded bg-muted/30 p-3">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Ajustes desta agenda (sobrescrevem o tipo; vazio = usa o do tipo)</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Campo id={`rg-nome-${regra.id}`} rotulo="Nome exibido"><Input id={`rg-nome-${regra.id}`} value={f.nome} onChange={(e) => set('nome', e.target.value)} /></Campo>
        <Campo id={`rg-dur-${regra.id}`} rotulo={`Duração (min) · tipo: ${doTipo(tipo?.duracao_padrao_minutos)}`}><Input id={`rg-dur-${regra.id}`} type="number" min={5} max={480} value={f.duracao} onChange={(e) => set('duracao', e.target.value)} /></Campo>
        <Campo id={`rg-ret-${regra.id}`} rotulo={`Retorno (min) · tipo: ${doTipo(tipo?.duracao_retorno_minutos)}`}><Input id={`rg-ret-${regra.id}`} type="number" min={5} max={480} value={f.retorno} onChange={(e) => set('retorno', e.target.value)} /></Campo>
        <Campo id={`rg-passo-${regra.id}`} rotulo={`Intervalo (min) · tipo: ${doTipo(tipo?.intervalo_slots_minutos ?? 30)}`}><Input id={`rg-passo-${regra.id}`} type="number" min={5} max={240} value={f.passo} onChange={(e) => set('passo', e.target.value)} /></Campo>
        <Campo id={`rg-ant-${regra.id}`} rotulo={`Antecedência (min) · tipo: ${doTipo(tipo?.antecedencia_minima_minutos ?? 0)}`}><Input id={`rg-ant-${regra.id}`} type="number" min={0} value={f.antecedencia} onChange={(e) => set('antecedencia', e.target.value)} /></Campo>
        <Campo id={`rg-cap-${regra.id}`} rotulo={`Simultâneos · tipo: ${doTipo(tipo?.capacidade_simultanea ?? 1)}`}><Input id={`rg-cap-${regra.id}`} type="number" min={1} max={20} value={f.capacidade} onChange={(e) => set('capacidade', e.target.value)} /></Campo>
        <Campo id={`rg-pets-${regra.id}`} rotulo={`Pets/agendamento · tipo: ${doTipo(tipo?.max_pets_por_agendamento ?? 1)}`}><Input id={`rg-pets-${regra.id}`} type="number" min={1} max={10} value={f.pets} onChange={(e) => set('pets', e.target.value)} /></Campo>
        <Campo id={`rg-local-${regra.id}`} rotulo="Local do evento"><Input id={`rg-local-${regra.id}`} value={f.local} onChange={(e) => set('local', e.target.value)} placeholder={tipo?.local_evento ?? ''} /></Campo>
        <div className="md:col-span-2">
          <Campo id={`rg-titulo-${regra.id}`} rotulo="Título do evento (desta agenda)"><Input id={`rg-titulo-${regra.id}`} value={f.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder={tipo?.titulo_evento_modelo ?? 'usa o do tipo'} /></Campo>
        </div>
        <div className="md:col-span-2">
          <Campo id={`rg-descev-${regra.id}`} rotulo="Descrição do evento (desta agenda)"><Input id={`rg-descev-${regra.id}`} value={f.descricaoEvento} onChange={(e) => set('descricaoEvento', e.target.value)} placeholder="usa o do tipo" /></Campo>
        </div>
        <div className="md:col-span-4">
          <Campo id={`rg-instr-${regra.id}`} rotulo="Instruções específicas desta agenda"><Textarea id={`rg-instr-${regra.id}`} rows={2} value={f.instrucoes} onChange={(e) => set('instrucoes', e.target.value)} /></Campo>
        </div>
        <div className="space-y-2 md:col-span-4">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.personalizarOps} onCheckedChange={(v) => set('personalizarOps', !!v)} /> Definir operações permitidas só para esta agenda</label>
          {f.personalizarOps && (
            <div className="flex flex-wrap gap-4">
              {OPERACOES_AGENDA.map((op) => (
                <label key={op.chave} className="flex items-center gap-2 text-sm"><Checkbox checked={f.operacoes.includes(op.chave)} onCheckedChange={(v) => set('operacoes', alternar(f.operacoes, op.chave, !!v))} /> {op.nome}</label>
              ))}
            </div>
          )}
        </div>
        <div><Button size="sm" onClick={salvar}>Salvar ajustes</Button></div>
      </div>
    </details>
  );
}
