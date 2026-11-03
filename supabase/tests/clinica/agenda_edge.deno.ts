// Roda a Edge Function `agenda` DE VERDADE (Deno) contra um backend falso em memória.
//   npx deno@2 test -A supabase/tests/clinica/agenda_edge.deno.ts
import assert from 'node:assert/strict';
import { carregarFuncao, chamar, instalar, type Backend, type EventoGoogle } from './fake_backend.ts';

import { AGORA, SESSAO, dadosClinica as dados } from './fixture_clinica.ts';

async function comAgenda(fn: (ctx: { backend: Backend; agenda: (corpo: unknown, cab?: Record<string, string>) => Promise<{ status: number; corpo: any }> }) => Promise<void>) {
  const backend = dados();
  const restaurar = instalar(backend, { agoraIso: AGORA });
  try {
    const handler = await carregarFuncao(backend, 'agenda');
    await fn({
      backend,
      agenda: async (corpo, cab) => {
        const r = await chamar(handler, corpo, cab);
        return { status: r.status, corpo: await r.json() };
      },
    });
  } finally {
    restaurar();
  }
}

const contexto = (extra: Record<string, unknown> = {}) => ({ sessionId: SESSAO, telefone: '5541999990001', ...extra });
const GERAL = 'cal-geral@group';

Deno.test('disponibilidade sem data: próximos dias, valor particular, almoço fora e mensagem formatada', async () => {
  await comAgenda(async ({ agenda }) => {
    const { status, corpo } = await agenda({ acao: 'disponibilidade', agendaType: 'consultaveterinaria', contexto: contexto() });
    assert.equal(status, 200);
    assert.equal(corpo.ok, true);
    assert.equal(corpo.valor_particular, 'R$ 120,00');
    assert.equal(corpo.dias[0].data, '2026-10-26');
    assert.equal(corpo.dias[0].dia_semana, 'segunda-feira');
    const horas = corpo.dias[0].horarios.map((h: { inicio: string }) => h.inicio);
    assert.equal(horas[0], '09:00');
    assert.ok(!horas.includes('13:00') && !horas.includes('13:30') && !horas.includes('12:30'));
    assert.equal(corpo.dias[0].horarios[0].date_start, '2026-10-26T09:00:00-03:00');
    assert.match(corpo.mensagem, /segunda-feira, 26\/10\/2026/);
    assert.match(corpo.mensagem, /Duração do atendimento: 60 minutos/);
    assert.match(corpo.instrucao_apresentacao, /no máximo 2 data\(s\) com até 4 horários/);
    assert.equal(corpo.dias.length, 10);
  });
});

Deno.test('disponibilidade: evento no Google bloqueia; horário exato livre/ocupado; dia fechado traz alternativas', async () => {
  await comAgenda(async ({ agenda, backend }) => {
    backend.calendarios[GERAL].push({ id: 'x1', start: { dateTime: '2026-10-26T09:00:00-03:00' }, end: { dateTime: '2026-10-26T10:00:00-03:00' } } as EventoGoogle);
    const ocupado = await agenda({ acao: 'disponibilidade', agendaType: 'consultaveterinaria', dataHora: '2026-10-26T09:00:00' });
    assert.equal(ocupado.corpo.horario_solicitado_disponivel, false);
    assert.equal(ocupado.corpo.data_solicitada_indisponivel, false);
    assert.ok(!ocupado.corpo.dias[0].horarios.some((h: { inicio: string }) => ['09:00', '09:30'].includes(h.inicio)));
    const livre = await agenda({ acao: 'disponibilidade', agendaType: 'consultaveterinaria', dataHora: '2026-10-26T10:00:00' });
    assert.equal(livre.corpo.horario_solicitado_disponivel, true);
    const domingo = await agenda({ acao: 'disponibilidade', agendaType: 'consultaveterinaria', data: '2026-11-01' });
    assert.equal(domingo.corpo.data_solicitada_indisponivel, true);
    assert.match(domingo.corpo.mensagem, /O horário solicitado \(01\/11\/2026\) está indisponível/);
    assert.ok(domingo.corpo.dias.length > 0);
    const invalida = await agenda({ acao: 'disponibilidade', agendaType: 'consultaveterinaria', data: 'amanhã' });
    assert.equal(invalida.status, 400);
  });
});

Deno.test('disponibilidade: feriado e antecedência mínima respeitados', async () => {
  await comAgenda(async ({ agenda, backend }) => {
    backend.tabelas.agenda_feriados.push({ id: 'f1', data: '2026-10-27', dia_inteiro: true, inicio: null, fim: null, regra_id: null });
    const r = await agenda({ acao: 'disponibilidade', agendaType: 'consultaveterinaria' });
    assert.ok(!r.corpo.dias.some((d: { data: string }) => d.data === '2026-10-27'));
    backend.tabelas.agenda_especialidades[0].antecedencia_minima_minutos = 60 * 24 * 2; // 2 dias
    const r2 = await agenda({ acao: 'disponibilidade', agendaType: 'consultaveterinaria' });
    assert.equal(r2.corpo.dias[0].data, '2026-10-28'); // 26 e 27(feriado) fora; 27 já seria <48h
  });
});

Deno.test('agendar: cria o evento com título/local/convite, registra, aplica a tag e devolve o resumo', async () => {
  await comAgenda(async ({ agenda, backend }) => {
    const r = await agenda({ acao: 'criar', agendaType: 'consultaveterinaria', inicio: '2026-10-26T10:00:00-03:00', contexto: contexto() });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.ok, true, JSON.stringify(r.corpo));
    assert.equal(r.corpo.agendamento.date_start, '2026-10-26T10:00:00-03:00');
    assert.equal(r.corpo.agendamento.date_finish, '2026-10-26T11:00:00-03:00');
    assert.equal(r.corpo.agendamento.profissional, 'Clínica Geral');
    const evento = backend.calendarios[GERAL][0];
    assert.equal(evento.summary, 'Consulta de Clínica Geral para: Thor | Tutor: Maria | Telefone: (41) 9 9999-0001');
    assert.equal(evento.location, 'Unidade Centro');
    assert.deepEqual(evento.attendees, [{ email: 'maria@email.com' }]);
    assert.deepEqual(evento.extendedProperties, { private: { origem: 'assistente' } });
    assert.equal(evento.start.dateTime, '2026-10-26T10:00:00-03:00');
    assert.match(backend.chamadasGoogle.find((c) => c.metodo === 'POST')!.caminho, /sendUpdates=all/);
    const log = backend.tabelas.agenda_agendamentos;
    assert.equal(log.length, 1);
    assert.deepEqual([log[0].status, log[0].tipo_chave, log[0].pet_nome, log[0].google_event_id], ['confirmado', 'consultaveterinaria', 'Thor', evento.id]);
    assert.deepEqual(backend.tabelas.client_tags.map((t) => [t.client_id, t.tag_id]), [[1, 7]]);
    // o mesmo horário não pode ser agendado duas vezes
    const dupla = await agenda({ acao: 'criar', agendaType: 'consultaveterinaria', inicio: '2026-10-26T10:00:00-03:00', contexto: contexto() });
    assert.equal(dupla.corpo.ok, false);
    assert.equal(dupla.corpo.motivo, 'horario_indisponivel');
    assert.ok(dupla.corpo.alternativas.length > 0);
    assert.equal(backend.calendarios[GERAL].length, 1);
  });
});

Deno.test('agendar: almoço, data passada, pets demais e operação bloqueada', async () => {
  await comAgenda(async ({ agenda, backend }) => {
    const almoco = await agenda({ acao: 'criar', agendaType: 'consultaveterinaria', inicio: '2026-10-26T13:00:00-03:00', contexto: contexto() });
    assert.equal(almoco.corpo.motivo, 'horario_indisponivel');
    const passada = await agenda({ acao: 'criar', agendaType: 'consultaveterinaria', inicio: '2026-10-24T10:00:00-03:00', contexto: contexto() });
    assert.equal(passada.corpo.motivo, 'data_passada');
    const pets = await agenda({ acao: 'criar', agendaType: 'consultaveterinaria', inicio: '2026-10-26T10:00:00-03:00', contexto: contexto({ nomePet: 'A, B e C' }) });
    assert.equal(pets.corpo.motivo, 'pets_demais');
    const dois = await agenda({ acao: 'criar', agendaType: 'consultaveterinaria', inicio: '2026-10-26T10:00:00-03:00', contexto: contexto({ nomePet: 'Thor e Mel' }) });
    assert.equal(dois.corpo.ok, true);
    assert.match(backend.calendarios[GERAL][0].summary!, /para: Thor e Mel \|/);
    const onco = await agenda({ acao: 'criar', agendaType: 'oncologia', inicio: '2026-10-26T10:00:00-03:00', contexto: contexto() });
    assert.equal(onco.status, 403);
    assert.equal(onco.corpo.error, 'operation_not_allowed');
    const semAuth = await agenda({ acao: 'disponibilidade', agendaType: 'consultaveterinaria' }, {});
    assert.equal(semAuth.status, 401);
    const segredoErrado = await agenda({ acao: 'disponibilidade', agendaType: 'consultaveterinaria' }, { 'x-internal-secret': 'errado' });
    assert.equal(segredoErrado.status, 401);
  });
});

Deno.test('reagendar e cancelar: só o que o assistente agendou; evento da equipe é encaminhado; inexistente é informado', async () => {
  await comAgenda(async ({ agenda, backend }) => {
    await agenda({ acao: 'criar', agendaType: 'consultaveterinaria', inicio: '2026-10-26T10:00:00-03:00', contexto: contexto() });
    const evento = backend.calendarios[GERAL][0];

    // reagendar para um horário livre
    const re = await agenda({ acao: 'editar', agendaType: 'consultaveterinaria', inicio: '2026-10-27T15:00:00-03:00', dataAntiga: '2026-10-26T10:00:00-03:00', contexto: contexto() });
    assert.equal(re.corpo.ok, true, JSON.stringify(re.corpo));
    assert.equal(evento.start.dateTime, '2026-10-27T15:00:00-03:00');
    assert.equal(evento.end.dateTime, '2026-10-27T16:00:00-03:00');
    assert.equal(backend.tabelas.agenda_agendamentos[0].inicio, '2026-10-27T18:00:00.000Z');

    // reagendar para um horário ocupado por outro evento
    backend.calendarios[GERAL].push({ id: 'equipe1', start: { dateTime: '2026-10-28T09:00:00-03:00' }, end: { dateTime: '2026-10-28T10:00:00-03:00' } } as EventoGoogle);
    const ocupado = await agenda({ acao: 'editar', agendaType: 'consultaveterinaria', inicio: '2026-10-28T09:00:00-03:00', dataAntiga: '2026-10-27T15:00:00-03:00', contexto: contexto() });
    assert.equal(ocupado.corpo.ok, false);
    assert.equal(ocupado.corpo.motivo, 'horario_indisponivel');
    assert.equal(evento.start.dateTime, '2026-10-27T15:00:00-03:00');

    // evento criado pela equipe NÃO é alterado
    const equipe = await agenda({ acao: 'excluir', agendaType: 'consultaveterinaria', dataAntiga: '2026-10-28T09:00:00-03:00', contexto: contexto() });
    assert.equal(equipe.corpo.motivo, 'agendamento_da_equipe');
    assert.equal(equipe.corpo.encaminhar_para_humano, true);
    assert.equal(equipe.corpo.mensagem, 'Feito pela equipe.');
    assert.ok(backend.calendarios[GERAL].some((e) => e.id === 'equipe1'));

    // agendamento de outro cliente nunca é tocado
    const outro = await agenda({ acao: 'excluir', agendaType: 'consultaveterinaria', dataAntiga: '2026-10-27T15:00:00-03:00', contexto: { sessionId: '5511000000000@s.whatsapp.net' } });
    assert.notEqual(outro.corpo.ok, true);
    assert.equal(backend.calendarios[GERAL].length, 2);

    // inexistente
    const nada = await agenda({ acao: 'excluir', agendaType: 'consultaveterinaria', dataAntiga: '2026-11-03T09:00:00-03:00', contexto: contexto() });
    assert.equal(nada.corpo.motivo, 'nao_encontrado');

    // cancelar o próprio
    const cancelado = await agenda({ acao: 'excluir', agendaType: 'consultaveterinaria', dataAntiga: '2026-10-27T15:00:00-03:00', contexto: contexto() });
    assert.equal(cancelado.corpo.ok, true);
    assert.ok(!backend.calendarios[GERAL].some((e) => e.id === evento.id));
    assert.equal(backend.tabelas.agenda_agendamentos[0].status, 'cancelado');
    assert.match(backend.chamadasGoogle.find((c) => c.metodo === 'DELETE')!.caminho, /sendUpdates=all/);
    // e o horário volta a ficar livre
    const livre = await agenda({ acao: 'disponibilidade', agendaType: 'consultaveterinaria', dataHora: '2026-10-27T15:00:00' });
    assert.equal(livre.corpo.horario_solicitado_disponivel, true);
  });
});

Deno.test('listar do cliente: só agendamentos futuros confirmados dele, com horário no fuso da empresa', async () => {
  await comAgenda(async ({ agenda }) => {
    await agenda({ acao: 'criar', agendaType: 'consultaveterinaria', inicio: '2026-10-26T10:00:00-03:00', contexto: contexto() });
    await agenda({ acao: 'criar', agendaType: 'consultaveterinaria', inicio: '2026-10-29T16:30:00-03:00', contexto: contexto() });
    const r = await agenda({ acao: 'cliente', contexto: contexto() });
    assert.equal(r.corpo.ok, true);
    assert.deepEqual(r.corpo.agendamentos.map((a: { date_start: string }) => a.date_start), ['2026-10-26T10:00:00-03:00', '2026-10-29T16:30:00-03:00']);
    const vazio = await agenda({ acao: 'cliente', contexto: { sessionId: '5500@s.whatsapp.net' } });
    assert.deepEqual(vazio.corpo.agendamentos, []);
    const bloqueado = await agenda({ acao: 'cliente', contexto: contexto() }, {});
    assert.equal(bloqueado.status, 401);
  });
});

Deno.test('testar uma agenda ainda desativada: gera os horários só com as regras e checa o calendário', async () => {
  await comAgenda(async ({ agenda, backend }) => {
    backend.tabelas.agenda_regras[0].ativo = false;
    const r = await agenda({ acao: 'testar', regraId: '11111111-1111-4111-8111-111111111111', dias: 3 }, { 'x-internal-secret': 'segredo-interno' });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal(r.corpo.ativa, false);
    assert.equal(r.corpo.calendarioConfigurado, true);
    assert.equal(r.corpo.calendarioAcessivel, true);
    assert.equal(r.corpo.fusoHorario, 'America/Sao_Paulo');
    assert.equal(r.corpo.duracaoMinutos, 60);
    assert.deepEqual(r.corpo.dias[0].horarios.slice(0, 2), ['09:00', '09:30']);
  });
});

Deno.test('operações da equipe pelo painel: listar e criar evento cru continuam funcionando', async () => {
  await comAgenda(async ({ agenda, backend }) => {
    backend.tabelas.profiles = [{ id: 'u1', papel: 'admin', ativo: true }];
    // sem JWT válido a equipe também não passa
    const sem = await agenda({ acao: 'listar', agendaType: 'consultaveterinaria' }, {});
    assert.equal(sem.status, 401);
    // com o segredo interno (caminho da equipe via função) o evento cru é criado no horário livre
    const criado = await agenda({ acao: 'criar', agendaType: 'consultaveterinaria', event: { summary: 'Manual', start: '2026-10-30T09:00:00-03:00', end: '2026-10-30T10:00:00-03:00' } });
    assert.equal(criado.corpo.ok, true, JSON.stringify(criado.corpo));
    assert.equal(backend.calendarios[GERAL][0].summary, 'Manual');
    assert.equal(backend.tabelas.agenda_agendamentos.length, 0); // evento da equipe não entra no registro do assistente
    const lista = await agenda({ acao: 'listar', agendaType: 'consultaveterinaria', start: '2026-10-30T00:00:00-03:00', end: '2026-10-30T23:59:00-03:00' });
    assert.equal(lista.corpo.events.length, 1);
  });
});
