import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Campo, SelectNativo } from '@/components/config/atendimento/campos';
import { mensagemErro } from '@/components/config/atendimento/erros';
import type {
  AgendaEspecialidade, AgendaIntervalo, AgendaJanela, AgendaServicoPreco, AgendaTag,
} from '@/hooks/useAgendaConfiguracao';
import { textoHorariosTipo, type RegraTexto } from '@/lib/horariosTipo';
import { CAMPOS_AGENDA, OPERACOES_AGENDA } from '@/types/atendimentoConfig';
import {
  DESCRICAO_EVENTO_PADRAO, TITULO_EVENTO_PADRAO, VARIAVEIS_EVENTO, marcadoresEventoInvalidos, previaModelo,
} from './modelosEvento';

const lista = (texto: string) => texto.split(',').map((item) => item.trim()).filter(Boolean);
const alternar = (atual: string[], chave: string, marcado: boolean) =>
  marcado ? [...new Set([...atual, chave])] : atual.filter((item) => item !== chave);

export type RegraDoTipo = {
  id: string;
  especialidade_id: string;
  duracao_padrao_minutos?: number | null;
  nome_exibicao?: string | null;
  profissional?: { nome: string };
};

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 md:col-span-2">
      <legend className="text-sm font-semibold">{titulo}</legend>
      {descricao && <p className="-mt-1 text-xs text-muted-foreground">{descricao}</p>}
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function ChipsVariaveis({ onInserir }: { onInserir: (texto: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {VARIAVEIS_EVENTO.map((v) => (
        <button
          key={v.nome} type="button" title={`${v.descricao} — ex.: ${v.exemplo}`} onClick={() => onInserir(`{{${v.nome}}}`)}
          className="rounded border bg-background px-1.5 py-0.5 font-mono text-[11px] hover:bg-primary/10 hover:text-primary"
        >{`{{${v.nome}}}`}</button>
      ))}
    </div>
  );
}

/** Todos os parâmetros de um tipo de agendamento: o que antes ficava fixo nos fluxos do n8n. */
export function TipoAgendaEditor({
  tipo, regras, janelas, intervalos, servicos, tags, onSalvar,
}: {
  tipo: AgendaEspecialidade;
  regras: RegraDoTipo[];
  janelas: AgendaJanela[];
  intervalos: AgendaIntervalo[];
  servicos: AgendaServicoPreco[];
  tags: AgendaTag[];
  onSalvar: (valores: Record<string, unknown>) => Promise<unknown>;
}) {
  const num = (valor: number | null | undefined, padrao: number) => String(valor ?? padrao);
  const [f, setF] = useState({
    nome: tipo.nome,
    descricao: tipo.descricao ?? '',
    aliases: (tipo.aliases ?? []).join(', '),
    operacoes: tipo.operacoes_permitidas ?? OPERACOES_AGENDA.map((o) => o.chave) as string[],
    campos: tipo.campos_obrigatorios ?? [],
    instrucoes: tipo.instrucoes_prompt ?? '',
    duracao: num(tipo.duracao_padrao_minutos, 60),
    retorno: num(tipo.duracao_retorno_minutos, 30),
    passo: num(tipo.intervalo_slots_minutos, 30),
    antecedencia: num(tipo.antecedencia_minima_minutos, 0),
    capacidade: num(tipo.capacidade_simultanea, 1),
    pets: num(tipo.max_pets_por_agendamento, 1),
    horizonte: num(tipo.busca_horizonte_dias, 20),
    maxDias: num(tipo.busca_max_dias_com_vaga, 10),
    maxHorarios: num(tipo.busca_max_horarios_por_dia, 30),
    apresentarDatas: num(tipo.busca_apresentar_max_datas, 2),
    apresentarHorarios: num(tipo.busca_apresentar_max_horarios, 4),
    ordem: tipo.busca_ordem ?? 'proximos',
    titulo: tipo.titulo_evento_modelo ?? '',
    descricaoEvento: tipo.descricao_evento_modelo ?? '',
    local: tipo.local_evento ?? '',
    convite: tipo.enviar_convite_cliente ?? true,
    mensagemEquipe: tipo.mensagem_agendamento_equipe ?? '',
    tagId: tipo.tag_id == null ? '' : String(tipo.tag_id),
  });
  const set = <K extends keyof typeof f>(campo: K, valor: (typeof f)[K]) => setF((atual) => ({ ...atual, [campo]: valor }));

  const assistentePode = f.operacoes.length > 0;
  const preco = useMemo(() => {
    const ligados = servicos.filter((s) => s.tipo_agenda_id === tipo.id && s.ativo && s.preco != null);
    return ligados.length === 1 ? ligados[0].preco : null;
  }, [servicos, tipo.id]);
  const horarios = useMemo(() => textoHorariosTipo(regras.map((regra): RegraTexto => ({
    profissional: regra.profissional?.nome ?? 'Profissional',
    nome_exibicao: regra.nome_exibicao,
    duracao: regra.duracao_padrao_minutos ?? (Number(f.duracao) || 60),
    janelas: janelas.filter((j) => j.regra_id === regra.id),
    intervalos: intervalos.filter((i) => i.regra_id === regra.id),
  }))), [regras, janelas, intervalos, f.duracao]);

  const salvar = async () => {
    const n = (valor: string) => Number(valor);
    const faixas: Array<[string, number, number, number]> = [
      ['Duração', n(f.duracao), 5, 480], ['Retorno', n(f.retorno), 5, 480], ['Intervalo entre horários', n(f.passo), 5, 240],
      ['Antecedência mínima', n(f.antecedencia), 0, 20160], ['Capacidade simultânea', n(f.capacidade), 1, 20],
      ['Pets por agendamento', n(f.pets), 1, 10], ['Horizonte da busca', n(f.horizonte), 1, 120],
      ['Dias com vaga', n(f.maxDias), 1, 60], ['Horários por dia', n(f.maxHorarios), 1, 100],
      ['Datas apresentadas', n(f.apresentarDatas), 1, 10], ['Horários apresentados', n(f.apresentarHorarios), 1, 20],
    ];
    for (const [rotulo, valor, min, max] of faixas) {
      if (!Number.isFinite(valor) || valor < min || valor > max) return toast.error(`${rotulo}: use um valor entre ${min} e ${max}`);
    }
    const invalidos = [...marcadoresEventoInvalidos(f.titulo), ...marcadoresEventoInvalidos(f.descricaoEvento)];
    if (invalidos.length) return toast.error('Variável desconhecida no modelo do evento', { description: invalidos.join(', ') });
    try {
      await onSalvar({
        id: tipo.id,
        nome: f.nome.trim() || tipo.nome,
        descricao: f.descricao.trim() || null,
        aliases: lista(f.aliases),
        operacoes_permitidas: f.operacoes,
        campos_obrigatorios: f.campos,
        instrucoes_prompt: f.instrucoes.trim() || null,
        duracao_padrao_minutos: n(f.duracao), duracao_retorno_minutos: n(f.retorno), intervalo_slots_minutos: n(f.passo),
        antecedencia_minima_minutos: n(f.antecedencia), capacidade_simultanea: n(f.capacidade), max_pets_por_agendamento: n(f.pets),
        busca_horizonte_dias: n(f.horizonte), busca_max_dias_com_vaga: n(f.maxDias), busca_max_horarios_por_dia: n(f.maxHorarios),
        busca_apresentar_max_datas: n(f.apresentarDatas), busca_apresentar_max_horarios: n(f.apresentarHorarios), busca_ordem: f.ordem,
        titulo_evento_modelo: f.titulo.trim() || null,
        descricao_evento_modelo: f.descricaoEvento.trim() || null,
        local_evento: f.local.trim() || null,
        enviar_convite_cliente: f.convite,
        mensagem_agendamento_equipe: f.mensagemEquipe.trim() || null,
        tag_id: f.tagId ? Number(f.tagId) : null,
      });
      toast.success(`${tipo.nome} atualizado`);
    } catch (erro) {
      toast.error('Não foi possível salvar', { description: mensagemErro(erro) });
    }
  };

  return (
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {tipo.nome} <code className="ml-1 rounded bg-muted px-1 text-xs">{tipo.chave}</code>
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {tipo.duracao_padrao_minutos} min · retorno {tipo.duracao_retorno_minutos} min
          {!(tipo.operacoes_permitidas ?? OPERACOES_AGENDA).length && ' · só informativo (recepção agenda)'}
        </span>
      </summary>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <Secao titulo="Identificação" descricao="Como o tipo é chamado e como o cliente costuma pedi-lo.">
          <Campo id={`tipo-nome-${tipo.id}`} rotulo="Nome"><Input id={`tipo-nome-${tipo.id}`} value={f.nome} onChange={(e) => set('nome', e.target.value)} /></Campo>
          <Campo id={`tipo-desc-${tipo.id}`} rotulo="Descrição"><Input id={`tipo-desc-${tipo.id}`} value={f.descricao} onChange={(e) => set('descricao', e.target.value)} /></Campo>
          <div className="md:col-span-2">
            <Campo id={`tipo-alias-${tipo.id}`} rotulo="Outros nomes (separados por vírgula)" ajuda="Ex.: ultrassom, ultra. O assistente reconhece qualquer um deles.">
              <Input id={`tipo-alias-${tipo.id}`} value={f.aliases} onChange={(e) => set('aliases', e.target.value)} />
            </Campo>
          </div>
        </Secao>

        <Secao titulo="O que o assistente faz" descricao="Sem nenhuma operação marcada, o tipo é só informativo: o assistente explica e encaminha para a recepção.">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">O assistente pode</legend>
            <div className="grid grid-cols-2 gap-2">
              {OPERACOES_AGENDA.map((op) => (
                <label key={op.chave} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={f.operacoes.includes(op.chave)} onCheckedChange={(v) => set('operacoes', alternar(f.operacoes, op.chave, !!v))} /> {op.nome}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Dados obrigatórios para agendar</legend>
            <div className="grid grid-cols-2 gap-2">
              {CAMPOS_AGENDA.map((campo) => (
                <label key={campo.chave} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={f.campos.includes(campo.chave)} onCheckedChange={(v) => set('campos', alternar(f.campos, campo.chave, !!v))} /> {campo.nome}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="md:col-span-2">
            <Campo id={`tipo-instr-${tipo.id}`} rotulo="Instruções para o assistente" ajuda="Regras específicas deste serviço (preparo, restrições, o que perguntar). Entram no prompt junto com o serviço.">
              <Textarea id={`tipo-instr-${tipo.id}`} rows={3} value={f.instrucoes} onChange={(e) => set('instrucoes', e.target.value)} />
            </Campo>
          </div>
        </Secao>

        <Secao titulo="Duração e disponibilidade" descricao="Cada agenda pode sobrescrever estes valores (Ajustes desta agenda).">
          <Campo id={`tipo-dur-${tipo.id}`} rotulo="Duração da consulta (min)"><Input id={`tipo-dur-${tipo.id}`} type="number" min={5} max={480} value={f.duracao} onChange={(e) => set('duracao', e.target.value)} /></Campo>
          <Campo id={`tipo-ret-${tipo.id}`} rotulo="Duração do retorno (min)"><Input id={`tipo-ret-${tipo.id}`} type="number" min={5} max={480} value={f.retorno} onChange={(e) => set('retorno', e.target.value)} /></Campo>
          <Campo id={`tipo-passo-${tipo.id}`} rotulo="Intervalo entre horários (min)" ajuda="De quanto em quanto tempo um horário é oferecido."><Input id={`tipo-passo-${tipo.id}`} type="number" min={5} max={240} value={f.passo} onChange={(e) => set('passo', e.target.value)} /></Campo>
          <Campo id={`tipo-ant-${tipo.id}`} rotulo="Antecedência mínima (min)" ajuda="Não oferece horários que começam antes de “agora + este tempo”. 0 = qualquer horário futuro."><Input id={`tipo-ant-${tipo.id}`} type="number" min={0} max={20160} value={f.antecedencia} onChange={(e) => set('antecedencia', e.target.value)} /></Campo>
          <Campo id={`tipo-cap-${tipo.id}`} rotulo="Atendimentos simultâneos" ajuda="Quantos eventos podem ocupar o mesmo horário no calendário."><Input id={`tipo-cap-${tipo.id}`} type="number" min={1} max={20} value={f.capacidade} onChange={(e) => set('capacidade', e.target.value)} /></Campo>
          <Campo id={`tipo-pets-${tipo.id}`} rotulo="Pets por agendamento" ajuda="Quantos pets cabem em um mesmo agendamento (nomes separados por vírgula)."><Input id={`tipo-pets-${tipo.id}`} type="number" min={1} max={10} value={f.pets} onChange={(e) => set('pets', e.target.value)} /></Campo>
        </Secao>

        <Secao titulo="Busca de horários" descricao="Quantos horários o assistente procura e quanto mostra ao cliente.">
          <Campo id={`tipo-hor-${tipo.id}`} rotulo="Procurar até (dias à frente)"><Input id={`tipo-hor-${tipo.id}`} type="number" min={1} max={120} value={f.horizonte} onChange={(e) => set('horizonte', e.target.value)} /></Campo>
          <Campo id={`tipo-ordem-${tipo.id}`} rotulo="Ordem" ajuda="“Em torno da data” alterna dias antes e depois da data pedida.">
            <SelectNativo id={`tipo-ordem-${tipo.id}`} value={f.ordem} onChange={(v) => set('ordem', v as 'proximos' | 'em_torno_da_data')}>
              <option value="proximos">Próximos dias a partir da data</option>
              <option value="em_torno_da_data">Em torno da data pedida</option>
            </SelectNativo>
          </Campo>
          <Campo id={`tipo-md-${tipo.id}`} rotulo="Máx. de dias com vaga encontrados"><Input id={`tipo-md-${tipo.id}`} type="number" min={1} max={60} value={f.maxDias} onChange={(e) => set('maxDias', e.target.value)} /></Campo>
          <Campo id={`tipo-mh-${tipo.id}`} rotulo="Máx. de horários por dia encontrados"><Input id={`tipo-mh-${tipo.id}`} type="number" min={1} max={100} value={f.maxHorarios} onChange={(e) => set('maxHorarios', e.target.value)} /></Campo>
          <Campo id={`tipo-ad-${tipo.id}`} rotulo="Datas mostradas ao cliente"><Input id={`tipo-ad-${tipo.id}`} type="number" min={1} max={10} value={f.apresentarDatas} onChange={(e) => set('apresentarDatas', e.target.value)} /></Campo>
          <Campo id={`tipo-ah-${tipo.id}`} rotulo="Horários por data mostrados ao cliente"><Input id={`tipo-ah-${tipo.id}`} type="number" min={1} max={20} value={f.apresentarHorarios} onChange={(e) => set('apresentarHorarios', e.target.value)} /></Campo>
        </Secao>

        <Secao titulo="Evento no Google Agenda" descricao="Como o evento é criado quando o assistente agenda. Pode ser sobrescrito em cada agenda.">
          <div className="md:col-span-2 space-y-2">
            <Campo id={`tipo-titulo-${tipo.id}`} rotulo="Título do evento" ajuda={`Vazio usa: ${TITULO_EVENTO_PADRAO}`}>
              <Input id={`tipo-titulo-${tipo.id}`} value={f.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder={TITULO_EVENTO_PADRAO} />
            </Campo>
            <ChipsVariaveis onInserir={(t) => set('titulo', `${f.titulo}${t}`)} />
            <p className="text-xs text-muted-foreground">Exemplo: <strong>{previaModelo(f.titulo || TITULO_EVENTO_PADRAO)}</strong></p>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Campo id={`tipo-descev-${tipo.id}`} rotulo="Descrição do evento" ajuda={`Vazio usa: ${DESCRICAO_EVENTO_PADRAO.replace(/\n/g, ' ')}`}>
              <Textarea id={`tipo-descev-${tipo.id}`} rows={3} value={f.descricaoEvento} onChange={(e) => set('descricaoEvento', e.target.value)} />
            </Campo>
            <ChipsVariaveis onInserir={(t) => set('descricaoEvento', `${f.descricaoEvento}${t}`)} />
          </div>
          <Campo id={`tipo-local-${tipo.id}`} rotulo="Local do evento"><Input id={`tipo-local-${tipo.id}`} value={f.local} onChange={(e) => set('local', e.target.value)} placeholder="Nome ou endereço da unidade" /></Campo>
          <Campo id={`tipo-tag-${tipo.id}`} rotulo="Marcador aplicado ao cliente ao agendar" ajuda="Tag do cadastro de clientes; vazio = nenhuma.">
            <SelectNativo id={`tipo-tag-${tipo.id}`} value={f.tagId} onChange={(v) => set('tagId', v)}>
              <option value="">Nenhuma</option>
              {tags.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </SelectNativo>
          </Campo>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <Switch checked={f.convite} onCheckedChange={(v) => set('convite', v)} /> Enviar convite do Google Agenda para o e-mail do cliente
          </label>
          <div className="md:col-span-2">
            <Campo id={`tipo-equipe-${tipo.id}`} rotulo="Mensagem quando o agendamento foi feito pela equipe" ajuda="Dita ao assistente quando o cliente pede para cancelar/remarcar um evento que a equipe criou (o assistente só altera o que ele mesmo agendou).">
              <Textarea id={`tipo-equipe-${tipo.id}`} rows={2} value={f.mensagemEquipe} onChange={(e) => set('mensagemEquipe', e.target.value)} />
            </Campo>
          </div>
        </Secao>

        <div className="space-y-1 rounded-md bg-muted/50 p-3 text-xs md:col-span-2">
          <p className="font-medium text-muted-foreground">O que o assistente informa a partir destes dados</p>
          <p><strong>Horários</strong> ({`{{horarios:${tipo.chave}}}`}): {horarios ? <span className="whitespace-pre-line">{horarios}</span> : 'cadastre a jornada das agendas deste tipo.'}</p>
          <p><strong>Valor particular</strong>: {preco != null ? `R$ ${Number(preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (de Serviços e valores)` : 'não há um serviço único com valor ligado a este tipo (cadastre em Config. do atendimento › Serviços e valores).'}</p>
          {!assistentePode && <p className="text-amber-700 dark:text-amber-400">Nenhuma operação marcada: o assistente não verá este tipo na ferramenta de agenda.</p>}
        </div>
        <div className="md:col-span-2"><Button size="sm" onClick={salvar}>Salvar tipo</Button></div>
      </div>
    </details>
  );
}
