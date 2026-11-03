import { useState } from 'react';
import { CalendarCheck, Copy, FlaskConical, Plus, Power } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Campo, SelectNativo } from '@/components/config/atendimento/campos';
import { mensagemErro } from '@/components/config/atendimento/erros';
import { useAgendaAvancada, type ResultadoTeste } from '@/hooks/useAgendaAvancada';
import { useAgendaConfiguracao, type AgendaEspecialidade, type AgendaProfissional } from '@/hooks/useAgendaConfiguracao';
import { AgendamentosAssistenteCard } from './AgendamentosAssistenteCard';
import { FeriadosCard } from './FeriadosCard';
import { RegraAgendaEditor } from './RegraAgendaEditor';
import { TipoAgendaEditor } from './TipoAgendaEditor';

function ProfissionalEditor({ profissional, onSalvar }: { profissional: AgendaProfissional; onSalvar: (valores: { id: string; unidade: string | null; titulo: string | null; email: string | null; convidar_por_email: boolean }) => Promise<unknown> }) {
  const [unidade, setUnidade] = useState(profissional.unidade ?? '');
  const [titulo, setTitulo] = useState(profissional.titulo ?? '');
  const [email, setEmail] = useState(profissional.email ?? '');
  const [convidar, setConvidar] = useState(!!profissional.convidar_por_email);
  const salvar = async () => {
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast.error('E-mail inválido');
    try {
      await onSalvar({ id: profissional.id, unidade: unidade.trim() || null, titulo: titulo.trim() || null, email: email.trim() || null, convidar_por_email: convidar && !!email.trim() });
      toast.success(`${profissional.nome} atualizado`);
    } catch (erro) {
      toast.error('Não foi possível salvar', { description: mensagemErro(erro) });
    }
  };
  return (
    <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_1fr_1fr_1.4fr_auto_auto] md:items-end">
      <p className="text-sm font-medium md:pb-2">{profissional.nome}</p>
      <Campo id={`prof-un-${profissional.id}`} rotulo="Unidade"><Input id={`prof-un-${profissional.id}`} value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Ex.: Asa Sul" /></Campo>
      <Campo id={`prof-ti-${profissional.id}`} rotulo="Título / função"><Input id={`prof-ti-${profissional.id}`} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Oncologista" /></Campo>
      <Campo id={`prof-em-${profissional.id}`} rotulo="E-mail do profissional"><Input id={`prof-em-${profissional.id}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="opcional" /></Campo>
      <label className="flex items-center gap-2 pb-2 text-xs"><Switch checked={convidar} disabled={!email.trim()} onCheckedChange={setConvidar} /> Convidar nos eventos</label>
      <Button size="sm" variant="outline" onClick={salvar}>Salvar</Button>
    </div>
  );
}

export function AgendaAvancadaSection() {
  const agenda = useAgendaConfiguracao();
  const avancada = useAgendaAvancada();
  const [calNome, setCalNome] = useState('');
  const [calId, setCalId] = useState('');
  const [idsNovos, setIdsNovos] = useState<Record<string, string>>({});
  const [modeloTipo, setModeloTipo] = useState('');
  const [novaAgenda, setNovaAgenda] = useState({ modelo: '', profissional: '', tipo: '', calendario: '' });
  const [duplicar, setDuplicar] = useState<{ regra: string; profissional: string; calendario: string } | null>(null);
  const [teste, setTeste] = useState<{ regraId: string; resultado: ResultadoTeste } | null>(null);

  const executar = async (acao: Promise<unknown>, ok: string) => {
    try {
      await acao;
      toast.success(ok);
    } catch (erro) {
      toast.error('Não foi possível concluir', { description: mensagemErro(erro) });
    }
  };

  const modelosTipo = (avancada.modelos ?? []).filter((m) => m.categoria === 'tipo');
  const modelosAgenda = (avancada.modelos ?? []).filter((m) => m.categoria === 'agenda');
  const calendarios = avancada.calendarios ?? [];
  const regras = agenda.regrasComNomes;

  const testar = async (regraId: string) => {
    try {
      setTeste({ regraId, resultado: await avancada.testarRegra.mutateAsync(regraId) });
    } catch (erro) {
      toast.error('Teste indisponível', { description: mensagemErro(erro) });
    }
  };

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Agendas e tipos de agendamento</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre calendários, reutilize tipos de agendamento entre profissionais e crie agendas a partir de modelos. Novas agendas nascem desativadas: teste antes de ativar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calendários (Google Agenda)</CardTitle>
          <CardDescription>O ID do calendário é guardado criptografado (Vault) e nunca volta para o navegador. Calendários antigos continuam funcionando pelos secrets do ambiente; informe um ID aqui para passar a gerenciá-lo pelo painel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {calendarios.map((cal) => (
            <div key={cal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span>{cal.nome}</span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={cal.origem === 'painel' ? 'default' : 'outline'}>{cal.origem === 'painel' ? 'ID cadastrado no painel' : 'ID nos secrets do ambiente'}</Badge>
                <Input
                  aria-label={`Novo ID do calendário ${cal.nome}`}
                  className="h-8 w-56 text-xs"
                  placeholder="Informar/trocar ID"
                  autoComplete="off"
                  value={idsNovos[cal.id] ?? ''}
                  onChange={(e) => setIdsNovos({ ...idsNovos, [cal.id]: e.target.value })}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!(idsNovos[cal.id] ?? '').trim()}
                  onClick={() => executar(
                    avancada.salvarCalendario.mutateAsync({ p_nome: cal.nome, p_google_calendar_id: idsNovos[cal.id], p_id: cal.id })
                      .then(() => setIdsNovos((atual) => ({ ...atual, [cal.id]: '' }))),
                    'ID do calendário atualizado',
                  )}
                >Atualizar ID</Button>
              </div>
            </div>
          ))}
          <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
            <Campo id="cal-nome" rotulo="Nome"><Input id="cal-nome" value={calNome} onChange={(e) => setCalNome(e.target.value)} placeholder="Ex.: Dr. Fulano" /></Campo>
            <Campo id="cal-id" rotulo="ID do Google Calendar"><Input id="cal-id" value={calId} onChange={(e) => setCalId(e.target.value)} placeholder="abc123@group.calendar.google.com" autoComplete="off" /></Campo>
            <Button
              disabled={!calNome.trim() || !calId.trim() || avancada.salvarCalendario.isPending}
              onClick={() => executar(
                avancada.salvarCalendario.mutateAsync({ p_nome: calNome, p_google_calendar_id: calId }).then(() => { setCalNome(''); setCalId(''); }),
                'Calendário cadastrado',
              )}
            ><Plus className="mr-1 h-4 w-4" /> Cadastrar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profissionais</CardTitle>
          <CardDescription>Unidade e função de cada profissional. A unidade permite avisar só a equipe daquela unidade (Config. do atendimento › Notificações).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(agenda.profissionais ?? []).map((prof) => (
            <ProfissionalEditor key={prof.id} profissional={prof} onSalvar={(v) => avancada.atualizarProfissional.mutateAsync(v)} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Biblioteca de tipos de agendamento</CardTitle>
          <CardDescription>Cadastre uma vez e associe a quantos profissionais quiser. Os modelos abaixo são exemplos editáveis, não regras fixas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(agenda.especialidades ?? []).map((tipo) => (
            <TipoAgendaEditor
              key={tipo.id}
              tipo={tipo}
              regras={regras.filter((regra) => regra.especialidade_id === tipo.id && regra.ativo)}
              janelas={agenda.janelas ?? []}
              intervalos={agenda.intervalos ?? []}
              servicos={agenda.servicos ?? []}
              tags={agenda.tags ?? []}
              onSalvar={(v) => avancada.atualizarTipo.mutateAsync(v as { id: string })}
            />
          ))}
          <div className="flex flex-wrap items-end gap-3 border-t pt-3">
            <div className="min-w-56 flex-1">
              <Campo id="modelo-tipo" rotulo="Adicionar tipo a partir de um modelo">
                <SelectNativo id="modelo-tipo" value={modeloTipo} onChange={setModeloTipo}>
                  <option value="">Selecione…</option>
                  {modelosTipo.map((m) => <option key={m.id} value={m.chave}>{m.nome}</option>)}
                </SelectNativo>
              </Campo>
            </div>
            <Button variant="outline" disabled={!modeloTipo} onClick={() => executar(avancada.aplicarModeloTipo.mutateAsync({ p_modelo: modeloTipo }).then(() => setModeloTipo('')), 'Tipo adicionado')}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agendas (profissional × tipo)</CardTitle>
          <CardDescription>Cada agenda liga um profissional a um tipo e a um calendário. Duração, intervalo e instruções aqui sobrescrevem as do tipo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {regras.map((regra) => (
            <div key={regra.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{regra.profissional?.nome ?? 'Profissional'} · {regra.especialidade?.nome ?? 'Tipo'}</p>
                  <p className="text-xs text-muted-foreground">Calendário: {regra.calendario?.nome ?? 'não definido'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={regra.ativo ? 'default' : 'outline'}>{regra.ativo ? 'Ativa' : 'Desativada'}</Badge>
                  <Button size="sm" variant="outline" onClick={() => testar(regra.id)}><FlaskConical className="mr-1 h-4 w-4" /> Testar</Button>
                  <Button size="sm" variant="outline" onClick={() => setDuplicar({ regra: regra.id, profissional: '', calendario: '' })}><Copy className="mr-1 h-4 w-4" /> Duplicar</Button>
                  <Button size="sm" variant={regra.ativo ? 'outline' : 'default'} onClick={() => executar(avancada.atualizarRegra.mutateAsync({ id: regra.id, ativo: !regra.ativo }), regra.ativo ? 'Agenda desativada' : 'Agenda ativada')}>
                    <Power className="mr-1 h-4 w-4" /> {regra.ativo ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              </div>
              <RegraAgendaEditor regra={regra} tipo={regra.especialidade as AgendaEspecialidade | undefined} onSalvar={(v) => avancada.atualizarRegra.mutateAsync(v as { id: string })} />
              {teste?.regraId === regra.id && (
                <div className="rounded bg-muted p-3 text-xs">
                  <p className="font-medium">
                    {teste.resultado.servico} · {teste.resultado.duracaoMinutos} min a cada {teste.resultado.passoMinutos} min
                    {teste.resultado.antecedenciaMinutos ? ` · antecedência ${teste.resultado.antecedenciaMinutos} min` : ''}
                    {teste.resultado.fusoHorario ? ` · ${teste.resultado.fusoHorario}` : ''} ·{' '}
                    {teste.resultado.calendarioConfigurado
                      ? (teste.resultado.calendarioAcessivel === false ? 'calendário configurado, mas sem acesso' : 'calendário acessível')
                      : 'calendário sem ID configurado'}
                  </p>
                  {teste.resultado.dias.length === 0 && <p className="mt-1">Nenhum horário nos próximos 7 dias: confira as jornadas desta agenda.</p>}
                  {teste.resultado.dias.map((dia) => (
                    <p key={dia.data} className="mt-1"><strong>{dia.data}</strong>: {dia.horarios.join(', ')}</p>
                  ))}
                </div>
              )}
              {duplicar?.regra === regra.id && (
                <div className="grid gap-3 rounded bg-muted/50 p-3 md:grid-cols-3 md:items-end">
                  <Campo id="dup-prof" rotulo="Para o profissional">
                    <SelectNativo id="dup-prof" value={duplicar.profissional} onChange={(v) => setDuplicar({ ...duplicar, profissional: v })}>
                      <option value="">Selecione…</option>
                      {(agenda.profissionais ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </SelectNativo>
                  </Campo>
                  <Campo id="dup-cal" rotulo="Calendário">
                    <SelectNativo id="dup-cal" value={duplicar.calendario} onChange={(v) => setDuplicar({ ...duplicar, calendario: v })}>
                      <option value="">Selecione…</option>
                      {calendarios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </SelectNativo>
                  </Campo>
                  <Button disabled={!duplicar.profissional} onClick={() => executar(
                    avancada.duplicarRegra.mutateAsync({ p_regra_id: duplicar.regra, p_profissional_id: duplicar.profissional, p_calendario_id: duplicar.calendario || null }).then(() => setDuplicar(null)),
                    'Agenda duplicada (desativada até você testar e ativar)',
                  )}>Duplicar</Button>
                </div>
              )}
            </div>
          ))}

          <div className="space-y-3 border-t pt-3">
            <p className="flex items-center gap-2 text-sm font-medium"><CalendarCheck className="h-4 w-4" /> Nova agenda a partir de um modelo</p>
            <div className="grid gap-3 md:grid-cols-4 md:items-end">
              <Campo id="na-modelo" rotulo="Modelo de jornada">
                <SelectNativo id="na-modelo" value={novaAgenda.modelo} onChange={(v) => setNovaAgenda({ ...novaAgenda, modelo: v })}>
                  <option value="">Selecione…</option>
                  {modelosAgenda.map((m) => <option key={m.id} value={m.chave}>{m.nome}</option>)}
                </SelectNativo>
              </Campo>
              <Campo id="na-prof" rotulo="Profissional">
                <SelectNativo id="na-prof" value={novaAgenda.profissional} onChange={(v) => setNovaAgenda({ ...novaAgenda, profissional: v })}>
                  <option value="">Selecione…</option>
                  {(agenda.profissionais ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </SelectNativo>
              </Campo>
              <Campo id="na-tipo" rotulo="Tipo de agendamento">
                <SelectNativo id="na-tipo" value={novaAgenda.tipo} onChange={(v) => setNovaAgenda({ ...novaAgenda, tipo: v })}>
                  <option value="">Selecione…</option>
                  {(agenda.especialidades ?? []).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </SelectNativo>
              </Campo>
              <Campo id="na-cal" rotulo="Calendário">
                <SelectNativo id="na-cal" value={novaAgenda.calendario} onChange={(v) => setNovaAgenda({ ...novaAgenda, calendario: v })}>
                  <option value="">Selecione…</option>
                  {calendarios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </SelectNativo>
              </Campo>
            </div>
            <Button
              disabled={!novaAgenda.modelo || !novaAgenda.profissional || !novaAgenda.tipo}
              onClick={() => executar(
                avancada.criarRegraDeModelo.mutateAsync({
                  p_modelo: novaAgenda.modelo, p_profissional_id: novaAgenda.profissional,
                  p_especialidade_id: novaAgenda.tipo, p_calendario_id: novaAgenda.calendario || null,
                }).then(() => setNovaAgenda({ modelo: '', profissional: '', tipo: '', calendario: '' })),
                'Agenda criada (desativada). Teste e ative quando estiver pronta.',
              )}
            ><Plus className="mr-1 h-4 w-4" /> Criar agenda</Button>
          </div>
        </CardContent>
      </Card>

      <FeriadosCard
        feriados={agenda.feriados ?? []}
        agendas={regras.map((r) => ({ id: r.id, nome: `${r.profissional?.nome ?? 'Profissional'} · ${r.especialidade?.nome ?? 'Tipo'}` }))}
        disponivel={!!agenda.recursosNovos}
        onCriar={(v) => agenda.criarFeriado.mutateAsync(v)}
        onRemover={(id) => agenda.remover.mutateAsync({ tabela: 'agenda_feriados', id })}
      />

      <AgendamentosAssistenteCard />
    </div>
  );
}
