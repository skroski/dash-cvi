// Testes do motor de agenda (puro): jornada, almoço, feriados, quinzenal, capacidade, busca.
// Uso: node --experimental-strip-types --test supabase/tests/clinica/agenda_motor.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buscarHorarios, datasParaBuscar, escolherSlot, eventosOcupados, janelaAplica, mensagemHorarios, segundaDaSemana, slotsDoDia,
  type AgendaMotor,
} from '../../functions/_shared/agenda_motor.ts';

const TZ = 'America/Sao_Paulo';
const em = (iso: string) => new Date(iso).getTime();

const jornadaGeral = [
  ...[1, 2, 3, 4].map((dia_semana) => ({ dia_semana, inicio: '09:00', fim: '18:00' })),
  { dia_semana: 5, inicio: '08:00', fim: '18:00' },
  { dia_semana: 6, inicio: '08:00', fim: '16:00' },
];
const almoco = [1, 2, 3, 4, 5, 6].map((dia_semana) => ({ dia_semana, inicio: '13:00', fim: '14:00' }));

const agenda = (parcial: Partial<AgendaMotor> = {}): AgendaMotor => ({
  regraId: 'r1', profissionalId: 'p1', profissionalNome: 'Clínica Geral', duracao: 60, passo: 30, antecedenciaMin: 0, capacidade: 1,
  janelas: jornadaGeral, intervalos: almoco, feriados: [], ocupados: [], ...parcial,
});

// Domingo 25/10/2026 12:00 (Brasília): tudo de segunda em diante é futuro.
const domingo = { fuso: TZ, agoraMs: em('2026-10-25T15:00:00Z') };
// Segunda 26/10/2026 10:10
const segunda1010 = { fuso: TZ, agoraMs: em('2026-10-26T13:10:00Z') };

test('jornada: segunda 09–18 com almoço 13–14, passo 30 e duração 60', () => {
  const horas = slotsDoDia(agenda(), '2026-10-26', domingo).map((s) => s.inicio);
  assert.deepEqual(horas, ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']);
  const primeiro = slotsDoDia(agenda(), '2026-10-26', domingo)[0];
  assert.equal(primeiro.dateStart, '2026-10-26T09:00:00-03:00');
  assert.equal(primeiro.dateFinish, '2026-10-26T10:00:00-03:00');
});

test('jornada: sexta abre 08:00, sábado fecha 16:00 e domingo não tem horários', () => {
  assert.equal(slotsDoDia(agenda(), '2026-10-30', domingo)[0].inicio, '08:00');
  assert.equal(slotsDoDia(agenda(), '2026-10-31', domingo).at(-1)!.fim, '16:00');
  assert.deepEqual(slotsDoDia(agenda(), '2026-11-01', domingo), []);
});

test('retorno de 30 min usa o último início = fim - duração (17:30)', () => {
  const horas = slotsDoDia(agenda({ duracao: 30 }), '2026-10-26', domingo).map((s) => s.inicio);
  assert.equal(horas.at(-1), '17:30');
  assert.ok(!horas.includes('13:00') && !horas.includes('13:30'));
});

test('último início explícito (ex.: 17:00 com fim às 18:00 e 30 min)', () => {
  const a = agenda({ duracao: 30, janelas: [{ dia_semana: 1, inicio: '09:00', fim: '18:00', ultimo_inicio: '17:00' }], intervalos: [] });
  assert.equal(slotsDoDia(a, '2026-10-26', domingo).at(-1)!.inicio, '17:00');
});

test('horários passados do dia atual nunca são oferecidos; antecedência mínima desloca o limite', () => {
  assert.equal(slotsDoDia(agenda({ intervalos: [] }), '2026-10-26', segunda1010)[0].inicio, '10:30');
  assert.equal(slotsDoDia(agenda({ intervalos: [], antecedenciaMin: 120 }), '2026-10-26', segunda1010)[0].inicio, '12:30');
  assert.equal(slotsDoDia(agenda(), '2026-10-19', segunda1010).length, 0); // semana passada
});

test('feriado de dia inteiro e bloqueio parcial; feriado de outra agenda não vale', () => {
  const dia = [{ data: '2026-10-26', dia_inteiro: true }];
  assert.deepEqual(slotsDoDia(agenda({ feriados: dia }), '2026-10-26', domingo), []);
  const parcial = [{ data: '2026-10-26', dia_inteiro: false, inicio: '15:00', fim: '16:00' }];
  const horas = slotsDoDia(agenda({ feriados: parcial }), '2026-10-26', domingo).map((s) => s.inicio);
  assert.ok(!['14:30', '15:00', '15:30'].some((h) => horas.includes(h)), 'horários que invadem 15–16 devem sumir');
  assert.ok(horas.includes('14:00') && horas.includes('16:00'));
  const outra = [{ data: '2026-10-26', dia_inteiro: true, regra_id: 'outra' }];
  assert.ok(slotsDoDia(agenda({ feriados: outra }), '2026-10-26', domingo).length > 0);
  const daMesma = [{ data: '2026-10-26', dia_inteiro: true, regra_id: 'r1' }];
  assert.equal(slotsDoDia(agenda({ feriados: daMesma }), '2026-10-26', domingo).length, 0);
});

test('quinzenal: âncora define as semanas com atendimento (qualquer dia da semana)', () => {
  const j = { dia_semana: 1, inicio: '11:00', fim: '13:30', recorrencia: 'quinzenal', ancora_quinzenal: '2026-10-26' };
  assert.equal(janelaAplica(j, '2026-10-26'), true);
  assert.equal(janelaAplica(j, '2026-11-02'), false);
  assert.equal(janelaAplica(j, '2026-11-09'), true);
  assert.equal(janelaAplica(j, '2026-10-12'), true); // duas semanas antes
  assert.equal(janelaAplica(j, '2026-10-19'), false);
  // âncora numa quinta da mesma semana da segunda 26/10
  assert.equal(janelaAplica({ ...j, ancora_quinzenal: '2026-10-29' }, '2026-10-26'), true);
  assert.equal(janelaAplica({ ...j, ancora_quinzenal: '2026-10-29' }, '2026-11-02'), false);
  assert.equal(janelaAplica({ ...j, recorrencia: 'semanal' }, '2026-11-02'), true);
  assert.equal(segundaDaSemana('2026-10-25'), '2026-10-19'); // domingo pertence à semana que começou na segunda anterior
});

test('capacidade simultânea: só some o horário quando a lotação é atingida', () => {
  const evento = (id: string) => ({ id, inicioMs: em('2026-10-26T12:00:00Z'), fimMs: em('2026-10-26T13:00:00Z') }); // 09:00–10:00
  const livre = (a: AgendaMotor) => slotsDoDia(a, '2026-10-26', domingo).some((s) => s.inicio === '09:00');
  assert.equal(livre(agenda({ ocupados: [evento('a')] })), false);
  assert.equal(livre(agenda({ ocupados: [evento('a')], capacidade: 2 })), true);
  assert.equal(livre(agenda({ ocupados: [evento('a'), evento('b')], capacidade: 2 })), false);
  // 09:30 também conflita com o evento das 09:00–10:00
  assert.equal(slotsDoDia(agenda({ ocupados: [evento('a')] }), '2026-10-26', domingo).some((s) => s.inicio === '09:30'), false);
  assert.equal(slotsDoDia(agenda({ ocupados: [evento('a')] }), '2026-10-26', domingo).some((s) => s.inicio === '10:00'), true);
});

test('remarcação ignora o próprio evento, mas não outros', () => {
  const ocupados = [
    { id: 'meu', inicioMs: em('2026-10-26T12:00:00Z'), fimMs: em('2026-10-26T13:00:00Z') },
    { id: 'outro', inicioMs: em('2026-10-26T14:00:00Z'), fimMs: em('2026-10-26T15:00:00Z') },
  ];
  const horas = slotsDoDia(agenda({ ocupados }), '2026-10-26', { ...domingo, ignorarEventoId: 'meu' }).map((s) => s.inicio);
  assert.ok(horas.includes('09:00'));
  assert.ok(!horas.includes('11:00') && !horas.includes('11:30'));
});

test('eventos do Google: dia inteiro bloqueia o dia local; livre e cancelado não bloqueiam', () => {
  const ocupados = eventosOcupados([
    { id: 'a', start: { date: '2026-10-27' }, end: { date: '2026-10-28' } },
    { id: 'b', status: 'cancelled', start: { dateTime: '2026-10-26T09:00:00-03:00' }, end: { dateTime: '2026-10-26T10:00:00-03:00' } },
    { id: 'c', transparency: 'transparent', start: { dateTime: '2026-10-26T09:00:00-03:00' }, end: { dateTime: '2026-10-26T10:00:00-03:00' } },
    { id: 'd', start: { dateTime: '2026-10-26T14:00:00-03:00' }, end: { dateTime: '2026-10-26T14:30:00-03:00' } },
    { id: 'sem-fim', start: { dateTime: '2026-10-26T16:00:00-03:00' } },
  ], TZ);
  assert.deepEqual(ocupados.map((e) => e.id), ['a', 'd', 'sem-fim']);
  const a = agenda({ ocupados });
  assert.deepEqual(slotsDoDia(a, '2026-10-27', domingo), []); // terça inteira bloqueada
  assert.ok(slotsDoDia(a, '2026-10-26', domingo).some((s) => s.inicio === '09:00')); // cancelado/livre não bloqueiam
  assert.ok(!slotsDoDia(a, '2026-10-26', domingo).some((s) => s.inicio === '14:00'));
  assert.ok(slotsDoDia(a, '2026-10-28', domingo).length > 0); // fim exclusivo do Google
});

test('busca a partir de domingo: pula dias sem jornada, respeita limite de dias com vaga e de horários', () => {
  const dias = buscarHorarios([agenda()], domingo, { horizonteDias: 20, maxDiasComVaga: 3, maxHorariosPorDia: 4, ordem: 'proximos' });
  assert.deepEqual(dias.map((d) => d.data), ['2026-10-26', '2026-10-27', '2026-10-28']);
  assert.equal(dias[0].diaSemana, 'segunda-feira');
  assert.equal(dias[0].horarios.length, 4);
});

test('busca sem vagas dentro do horizonte devolve lista vazia', () => {
  const dias = buscarHorarios([agenda({ janelas: [] })], domingo, { horizonteDias: 20, maxDiasComVaga: 3, maxHorariosPorDia: 4, ordem: 'proximos' });
  assert.deepEqual(dias, []);
});

test('busca em torno da data: alterna antes/depois, nunca antes de hoje, saída cronológica', () => {
  const ordem = datasParaBuscar('2026-10-25', { dataReferencia: '2026-10-28', horizonteDias: 4, ordem: 'em_torno_da_data' });
  assert.deepEqual(ordem, ['2026-10-28', '2026-10-29', '2026-10-27', '2026-10-30', '2026-10-26', '2026-10-31', '2026-10-25']);
  const dias = buscarHorarios([agenda()], domingo, { dataReferencia: '2026-10-28', horizonteDias: 5, maxDiasComVaga: 3, maxHorariosPorDia: 2, ordem: 'em_torno_da_data' });
  assert.deepEqual(dias.map((d) => d.data), ['2026-10-27', '2026-10-28', '2026-10-29']);
  // data de referência no passado parte de hoje
  assert.deepEqual(datasParaBuscar('2026-10-25', { dataReferencia: '2026-10-01', horizonteDias: 3, ordem: 'proximos' }), ['2026-10-25', '2026-10-26', '2026-10-27']);
});

test('vários profissionais no mesmo tipo: horários dos dois, escolha do menos ocupado e filtro por profissional', () => {
  const a = agenda({ regraId: 'ra', profissionalNome: 'Dra. Ana', ocupados: [{ id: 'x', inicioMs: em('2026-10-26T12:00:00Z'), fimMs: em('2026-10-26T13:00:00Z') }] });
  const b = agenda({ regraId: 'rb', profissionalNome: 'Dr. Bruno', ocupados: [] });
  const dia = buscarHorarios([a, b], domingo, { horizonteDias: 3, maxDiasComVaga: 1, maxHorariosPorDia: 50, ordem: 'proximos' })[0];
  assert.equal(dia.horarios.filter((h) => h.inicio === '10:00').length, 2);
  assert.equal(dia.horarios.filter((h) => h.inicio === '09:00').length, 1); // Ana ocupada 09–10
  const dezHoras = em('2026-10-26T13:00:00Z');
  assert.equal(escolherSlot([a, b], domingo, dezHoras)?.profissional, 'Dr. Bruno'); // Ana tem 1 evento no dia
  assert.equal(escolherSlot([a, b], domingo, dezHoras, 'Dra. Ana')?.profissional, 'Dra. Ana');
  assert.equal(escolherSlot([a, b], domingo, em('2026-10-26T12:00:00Z'), 'Dra. Ana'), undefined); // ocupado
  assert.equal(escolherSlot([a, b], domingo, em('2026-10-26T16:00:00Z')), undefined); // 13:00 cai no almoço de ambos
});

test('fuso configurável: Manaus gera horários com -04:00', () => {
  const s = slotsDoDia(agenda({ intervalos: [] }), '2026-10-26', { fuso: 'America/Manaus', agoraMs: em('2026-10-25T15:00:00Z') })[0];
  assert.equal(s.dateStart, '2026-10-26T09:00:00-04:00');
  assert.equal(new Date(s.dateStart).getTime(), s.inicioMs);
});

test('mensagem de horários: formato para WhatsApp, profissional só quando há vários, alternativas', () => {
  const dias = buscarHorarios([agenda({ intervalos: [] })], domingo, { horizonteDias: 5, maxDiasComVaga: 2, maxHorariosPorDia: 3, ordem: 'proximos' });
  const base = { servicoNome: 'Consulta', dias, duracaoMinutos: 60, mostrarProfissional: false, maxDatas: 1, maxHorarios: 2, horizonteDias: 20 };
  assert.equal(
    mensagemHorarios(base),
    '✅ *Próximos horários disponíveis — Consulta:*\n\n📅 *segunda-feira, 26/10/2026*\n🕒 09:00 às 10:00\n🕒 09:30 às 10:30\n\n⏰ Duração do atendimento: 60 minutos.',
  );
  assert.match(mensagemHorarios({ ...base, mostrarProfissional: true }), /🕒 09:00 às 10:00 — Clínica Geral/);
  assert.match(mensagemHorarios({ ...base, dataSolicitada: '2026-10-28', dataSolicitadaIndisponivel: true }), /O horário solicitado \(28\/10\/2026\) está indisponível/);
  assert.match(mensagemHorarios({ ...base, dias: [] }), /Não encontrei horários disponíveis para Consulta nos próximos 20 dias/);
  assert.match(mensagemHorarios({ ...base, dias: [], dataSolicitada: '2026-10-28' }), /próximos de 28\/10\/2026/);
});
