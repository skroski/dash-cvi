import { FormEvent, useMemo, useState } from 'react';
import { CalendarClock, Coffee, Plus, ShieldCheck, Stethoscope, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AgendaIntervalo,
  AgendaRegra,
  useAgendaConfiguracao,
} from '@/hooks/useAgendaConfiguracao';
import { AgendaAvancadaSection } from '@/components/config/agenda/AgendaAvancadaSection';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function SelectField({
  id,
  value,
  onChange,
  children,
  disabled = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </select>
  );
}

function RegraNome({
  regra,
}: {
  regra: AgendaRegra & {
    profissional?: { nome: string; cor: string };
    especialidade?: { nome: string };
    calendario?: { nome: string };
  };
}) {
  return `${regra.profissional?.nome || 'Profissional'} · ${regra.especialidade?.nome || 'Especialidade'}`;
}

export default function AgendaSettingsPage() {
  const agenda = useAgendaConfiguracao();
  const [profissionalNome, setProfissionalNome] = useState('');
  const [profissionalCor, setProfissionalCor] = useState('#0f766e');
  const [especialidadeNome, setEspecialidadeNome] = useState('');
  const [especialidadeChave, setEspecialidadeChave] = useState('');
  const [duracaoPadrao, setDuracaoPadrao] = useState('60');
  const [duracaoRetorno, setDuracaoRetorno] = useState('30');
  const [regraProfissional, setRegraProfissional] = useState('');
  const [regraEspecialidade, setRegraEspecialidade] = useState('');
  const [regraCalendario, setRegraCalendario] = useState('');
  const [janelaRegra, setJanelaRegra] = useState('');
  const [janelaDia, setJanelaDia] = useState('1');
  const [janelaInicio, setJanelaInicio] = useState('09:00');
  const [janelaFim, setJanelaFim] = useState('18:00');
  const [janelaUltimoInicio, setJanelaUltimoInicio] = useState('');
  const [janelaRecorrencia, setJanelaRecorrencia] = useState<'semanal' | 'quinzenal'>('semanal');
  const [janelaAncora, setJanelaAncora] = useState('');
  const [intervaloRegra, setIntervaloRegra] = useState('');
  const [intervaloTipo, setIntervaloTipo] = useState<AgendaIntervalo['tipo']>('almoco');
  const [intervaloDia, setIntervaloDia] = useState('1');
  const [intervaloData, setIntervaloData] = useState('');
  const [intervaloInicio, setIntervaloInicio] = useState('12:00');
  const [intervaloFim, setIntervaloFim] = useState('13:00');
  const [intervaloDescricao, setIntervaloDescricao] = useState('');

  const regras = agenda.regrasComNomes;
  const janelasPorRegra = useMemo(() => {
    const result = new Map<string, typeof agenda.janelas>();
    for (const janela of agenda.janelas || []) {
      const list = result.get(janela.regra_id) || [];
      list.push(janela);
      result.set(janela.regra_id, list);
    }
    return result;
  }, [agenda.janelas]);

  const intervalosPorRegra = useMemo(() => {
    const result = new Map<string, typeof agenda.intervalos>();
    for (const intervalo of agenda.intervalos || []) {
      const list = result.get(intervalo.regra_id) || [];
      list.push(intervalo);
      result.set(intervalo.regra_id, list);
    }
    return result;
  }, [agenda.intervalos]);

  const executar = async (promise: Promise<unknown>, mensagem: string) => {
    try {
      await promise;
      toast.success(mensagem);
    } catch (error) {
      toast.error('Não foi possível salvar', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    }
  };

  const criarProfissional = async (event: FormEvent) => {
    event.preventDefault();
    if (!profissionalNome.trim()) return;
    await executar(
      agenda.criarProfissional.mutateAsync({ nome: profissionalNome, cor: profissionalCor }),
      'Veterinário adicionado'
    );
    setProfissionalNome('');
  };

  const criarEspecialidade = async (event: FormEvent) => {
    event.preventDefault();
    const chave = especialidadeChave.trim() || especialidadeNome
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    if (!especialidadeNome.trim() || !chave) return;
    await executar(
      agenda.criarEspecialidade.mutateAsync({
        chave,
        nome: especialidadeNome,
        duracaoPadrao: Number(duracaoPadrao),
        duracaoRetorno: Number(duracaoRetorno),
      }),
      'Especialidade adicionada'
    );
    setEspecialidadeNome('');
    setEspecialidadeChave('');
  };

  const criarRegra = async (event: FormEvent) => {
    event.preventDefault();
    if (!regraProfissional || !regraEspecialidade || !regraCalendario) return;
    await executar(
      agenda.criarRegra.mutateAsync({
        profissionalId: regraProfissional,
        especialidadeId: regraEspecialidade,
        calendarioId: regraCalendario,
      }),
      'Agenda vinculada'
    );
  };

  const criarJanela = async (event: FormEvent) => {
    event.preventDefault();
    if (!janelaRegra || janelaInicio >= janelaFim) {
      toast.error('Confira o início e o fim do horário.');
      return;
    }
    if (janelaRecorrencia === 'quinzenal' && !janelaAncora) {
      toast.error('Informe uma data de referência para o atendimento quinzenal.');
      return;
    }
    await executar(
      agenda.criarJanela.mutateAsync({
        regraId: janelaRegra,
        diaSemana: Number(janelaDia),
        inicio: janelaInicio,
        fim: janelaFim,
        ultimoInicio: janelaUltimoInicio || null,
        recorrencia: janelaRecorrencia,
        ancoraQuinzenal: janelaRecorrencia === 'quinzenal' ? janelaAncora : null,
      }),
      'Horário adicionado'
    );
  };

  const criarIntervalo = async (event: FormEvent) => {
    event.preventDefault();
    if (!intervaloRegra || intervaloInicio >= intervaloFim || (!intervaloData && intervaloDia === '')) {
      toast.error('Confira a regra, o dia e o intervalo.');
      return;
    }
    await executar(
      agenda.criarIntervalo.mutateAsync({
        regraId: intervaloRegra,
        tipo: intervaloTipo,
        diaSemana: intervaloData ? null : Number(intervaloDia),
        dataEspecifica: intervaloData || null,
        inicio: intervaloInicio,
        fim: intervaloFim,
        descricao: intervaloDescricao,
      }),
      intervaloTipo === 'almoco' ? 'Almoço adicionado' : 'Indisponibilidade adicionada'
    );
    setIntervaloDescricao('');
  };

  if (agenda.loading) {
    return <PageContainer><p className="text-sm text-muted-foreground">Carregando configuração da agenda…</p></PageContainer>;
  }

  if (agenda.error) {
    return (
      <PageContainer>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Não foi possível carregar a agenda</CardTitle>
            <CardDescription>
              Aplique a migração de agenda configurável no Supabase e confirme que seu usuário é administrador.
            </CardDescription>
          </CardHeader>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <CalendarClock className="h-4 w-4" /> Configuração operacional
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Agenda clínica</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Defina quem atende, o que cada profissional atende e quando a agenda fica disponível. O bot e o calendário usam estas mesmas regras.
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5 px-3 py-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> Alterações auditadas
        </Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5" /> Veterinários</CardTitle>
            <CardDescription>Profissionais que aparecem na disponibilidade e nas agendas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={criarProfissional} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="vet-nome">Nome</Label>
                <Input id="vet-nome" value={profissionalNome} onChange={(event) => setProfissionalNome(event.target.value)} placeholder="Ex.: Dra. Ana" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vet-cor">Cor</Label>
                <Input id="vet-cor" className="h-10 w-16 p-1" type="color" value={profissionalCor} onChange={(event) => setProfissionalCor(event.target.value)} />
              </div>
              <Button className="self-end" type="submit"><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
            </form>
            <div className="space-y-2">
              {(agenda.profissionais || []).map((profissional) => (
                <div key={profissional.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: profissional.cor }} />
                    {profissional.nome}
                  </span>
                  <Button variant="ghost" size="icon" aria-label={`Remover ${profissional.nome}`} onClick={() => executar(agenda.remover.mutateAsync({ tabela: 'agenda_profissionais', id: profissional.id }), 'Veterinário removido')}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Especialidades</CardTitle>
            <CardDescription>Duração padrão e retorno definem a grade de horários oferecida pelo atendimento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={criarEspecialidade} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="especialidade-nome">Nome</Label><Input id="especialidade-nome" value={especialidadeNome} onChange={(event) => setEspecialidadeNome(event.target.value)} placeholder="Ex.: Dermatologia" /></div>
              <div className="space-y-1.5"><Label htmlFor="especialidade-chave">Identificador</Label><Input id="especialidade-chave" value={especialidadeChave} onChange={(event) => setEspecialidadeChave(event.target.value)} placeholder="gerado automaticamente" /></div>
              <div className="space-y-1.5"><Label htmlFor="duracao-padrao">Consulta (min)</Label><Input id="duracao-padrao" type="number" min="5" max="480" value={duracaoPadrao} onChange={(event) => setDuracaoPadrao(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="duracao-retorno">Retorno (min)</Label><Input id="duracao-retorno" type="number" min="5" max="480" value={duracaoRetorno} onChange={(event) => setDuracaoRetorno(event.target.value)} /></div>
              <Button className="sm:col-span-2" type="submit"><Plus className="mr-1 h-4 w-4" />Adicionar especialidade</Button>
            </form>
            <div className="flex flex-wrap gap-2">
              {(agenda.especialidades || []).map((especialidade) => (
                <Badge key={especialidade.id} variant="secondary" className="gap-1.5 py-1.5 pl-2.5">
                  {especialidade.nome} · {especialidade.duracao_padrao_minutos} min
                  <button type="button" aria-label={`Remover ${especialidade.nome}`} onClick={() => executar(agenda.remover.mutateAsync({ tabela: 'agenda_especialidades', id: especialidade.id }), 'Especialidade removida')} className="rounded-sm text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Vínculo de agenda</CardTitle><CardDescription>Associe profissional, especialidade e calendário seguro.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={criarRegra} className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="regra-profissional">Veterinário</Label><SelectField id="regra-profissional" value={regraProfissional} onChange={setRegraProfissional}><option value="">Selecione</option>{(agenda.profissionais || []).filter((item) => item.ativo).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</SelectField></div>
              <div className="space-y-1.5"><Label htmlFor="regra-especialidade">Especialidade</Label><SelectField id="regra-especialidade" value={regraEspecialidade} onChange={setRegraEspecialidade}><option value="">Selecione</option>{(agenda.especialidades || []).filter((item) => item.ativo).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</SelectField></div>
              <div className="space-y-1.5"><Label htmlFor="regra-calendario">Agenda conectada</Label><SelectField id="regra-calendario" value={regraCalendario} onChange={setRegraCalendario}><option value="">Selecione</option>{(agenda.calendarios || []).filter((item) => item.ativo).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</SelectField></div>
              <Button type="submit" className="w-full">Vincular agenda</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Regras ativas</CardTitle><CardDescription>O calendário real fica no backend; aqui aparece apenas o nome da agenda.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {regras.map((regra) => (
              <div key={regra.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium"><RegraNome regra={regra} /></p>
                    <p className="text-xs text-muted-foreground">{regra.calendario?.nome || 'Sem agenda conectada'}</p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Remover vínculo" onClick={() => executar(agenda.remover.mutateAsync({ tabela: 'agenda_regras', id: regra.id }), 'Vínculo removido')}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(janelasPorRegra.get(regra.id) || []).map((janela) => <Badge key={janela.id} variant="outline">{DIAS[janela.dia_semana]} · {janela.inicio.slice(0, 5)}–{janela.fim.slice(0, 5)}{janela.recorrencia === 'quinzenal' ? ' · quinzenal' : ''}</Badge>)}
                  {(intervalosPorRegra.get(regra.id) || []).map((intervalo) => <Badge key={intervalo.id} variant="secondary"><Coffee className="mr-1 h-3 w-3" />{intervalo.tipo} {intervalo.inicio.slice(0, 5)}–{intervalo.fim.slice(0, 5)}</Badge>)}
                </div>
              </div>
            ))}
            {regras.length === 0 && <p className="text-sm text-muted-foreground">Crie o primeiro vínculo para liberar os horários.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Horários semanais</CardTitle><CardDescription>Use mais de uma faixa no mesmo dia quando houver turnos diferentes. “Último início” limita o último horário oferecido (vazio = fim menos a duração).</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={criarJanela} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="janela-regra">Agenda</Label><SelectField id="janela-regra" value={janelaRegra} onChange={setJanelaRegra}><option value="">Selecione</option>{regras.map((regra) => <option key={regra.id} value={regra.id}><RegraNome regra={regra} /></option>)}</SelectField></div>
              <div className="space-y-1.5"><Label htmlFor="janela-dia">Dia</Label><SelectField id="janela-dia" value={janelaDia} onChange={setJanelaDia}>{DIAS.map((dia, index) => <option key={dia} value={index}>{dia}</option>)}</SelectField></div>
              <div className="space-y-1.5"><Label htmlFor="janela-ultimo">Último início</Label><Input id="janela-ultimo" type="time" value={janelaUltimoInicio} onChange={(event) => setJanelaUltimoInicio(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="janela-inicio">Início</Label><Input id="janela-inicio" type="time" value={janelaInicio} onChange={(event) => setJanelaInicio(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="janela-fim">Fim</Label><Input id="janela-fim" type="time" value={janelaFim} onChange={(event) => setJanelaFim(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="janela-recorrencia">Frequência</Label><SelectField id="janela-recorrencia" value={janelaRecorrencia} onChange={(value) => setJanelaRecorrencia(value as 'semanal' | 'quinzenal')}><option value="semanal">Toda semana</option><option value="quinzenal">A cada 15 dias</option></SelectField></div>
              {janelaRecorrencia === 'quinzenal' && (
                <div className="space-y-1.5"><Label htmlFor="janela-ancora">Uma data com atendimento</Label><Input id="janela-ancora" type="date" value={janelaAncora} onChange={(event) => setJanelaAncora(event.target.value)} /><p className="text-xs text-muted-foreground">A partir dela, de 15 em 15 dias.</p></div>
              )}
              <Button className="sm:col-span-2" type="submit">Adicionar horário</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Almoço, pausas e bloqueios</CardTitle><CardDescription>Bloqueios entram na disponibilidade antes de consultar o Google Calendar.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={criarIntervalo} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="intervalo-regra">Agenda</Label><SelectField id="intervalo-regra" value={intervaloRegra} onChange={setIntervaloRegra}><option value="">Selecione</option>{regras.map((regra) => <option key={regra.id} value={regra.id}><RegraNome regra={regra} /></option>)}</SelectField></div>
              <div className="space-y-1.5"><Label htmlFor="intervalo-tipo">Tipo</Label><SelectField id="intervalo-tipo" value={intervaloTipo} onChange={(value) => setIntervaloTipo(value as AgendaIntervalo['tipo'])}><option value="almoco">Almoço</option><option value="pausa">Pausa</option><option value="bloqueio">Bloqueio</option></SelectField></div>
              <div className="space-y-1.5"><Label htmlFor="intervalo-dia">Dia recorrente</Label><SelectField id="intervalo-dia" value={intervaloDia} onChange={setIntervaloDia} disabled={!!intervaloData}>{DIAS.map((dia, index) => <option key={dia} value={index}>{dia}</option>)}</SelectField></div>
              <div className="space-y-1.5"><Label htmlFor="intervalo-data">Ou data específica</Label><Input id="intervalo-data" type="date" value={intervaloData} onChange={(event) => setIntervaloData(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="intervalo-descricao">Descrição</Label><Input id="intervalo-descricao" value={intervaloDescricao} onChange={(event) => setIntervaloDescricao(event.target.value)} placeholder="Ex.: almoço" /></div>
              <div className="space-y-1.5"><Label htmlFor="intervalo-inicio">Início</Label><Input id="intervalo-inicio" type="time" value={intervaloInicio} onChange={(event) => setIntervaloInicio(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="intervalo-fim">Fim</Label><Input id="intervalo-fim" type="time" value={intervaloFim} onChange={(event) => setIntervaloFim(event.target.value)} /></div>
              <Button className="sm:col-span-2" type="submit">Salvar indisponibilidade</Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <AgendaAvancadaSection />
    </PageContainer>
  );
}

