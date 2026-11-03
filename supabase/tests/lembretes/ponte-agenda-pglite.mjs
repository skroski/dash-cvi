// Ponte agenda -> lembretes (migração 20261030100000) num Postgres embutido (PGlite).
// Aplica a cadeia real de migrações do repositório (lembretes + agenda) e verifica que cada
// agendamento do assistente cria, remarca e cancela o lembrete certo. Nenhum banco real é tocado.
//   npm --prefix /tmp/pglite install @electric-sql/pglite@0.2.17
//   PGLITE_PATH=/tmp/pglite/node_modules/@electric-sql/pglite/dist/index.js \
//     node --experimental-strip-types supabase/tests/lembretes/ponte-agenda-pglite.mjs
import { ler, criarBanco, ferramentas, MIGRACOES } from '../clinica/harness.mjs';

const PONTE = '20261030100000_agenda_agendamentos_lembretes.sql';

// Estado do banco de produção antes da ponte: módulo de lembretes + agenda configurável.
async function montarBanco({ comLembretes = true } = {}) {
  const db = await criarBanco({ migracoes: [] });
  if (comLembretes) {
    await db.exec(`
      create publication supabase_realtime;
      create schema net;
      create function net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds int)
        returns bigint language sql as $$ select 1::bigint $$;
    `);
    await db.exec(ler('migrations/20260716100000_lembretes.sql'));
    // Campos legados que a migração 20260716140000 acrescenta (ela também mexe em tabelas de pesquisa).
    await db.exec(`alter table public.lembrete_envios
      add column if not exists descricao text, add column if not exists email text,
      add column if not exists porte text, add column if not exists preco numeric(12, 2),
      add column if not exists status_agendamento text`);
    for (const arquivo of [
      '20261013100000_lembretes_envio_supabase.sql',
      '20261013110000_lembretes_regra_vacinacao.sql',
      '20261021110000_lembretes_envio_supabase.sql',
    ]) await db.exec(ler(`migrations/${arquivo}`));
  }
  for (const arquivo of MIGRACOES) await db.exec(ler(`migrations/${arquivo}`));
  return db;
}

const AMANHA_14H = `(((now() at time zone 'America/Sao_Paulo')::date + 1 + time '14:00') at time zone 'America/Sao_Paulo')`;
const DEPOIS_14H = `(((now() at time zone 'America/Sao_Paulo')::date + 2 + time '14:00') at time zone 'America/Sao_Paulo')`;

let contador = 0;
function agendamento(db, { tipo, nome, telefone = '5561999990001', tutor = 'Maria Souza', pet = 'Thor', inicio = AMANHA_14H, status = 'confirmado' }) {
  contador += 1;
  return db.query(
    `insert into public.agenda_agendamentos (session_id, telefone, tipo_chave, tipo_nome, google_event_id, inicio, fim, tutor_nome, pet_nome, status)
     values ($1, $2, $3, $4, $5, ${inicio}, ${inicio} + interval '30 minutes', $6, $7, $8) returning id`,
    [`${telefone}@s.whatsapp.net`, telefone, tipo, nome, `evt-${contador}`, tutor, pet, status],
  ).then((r) => r.rows[0].id);
}

async function semearAgenda(db) {
  await db.exec(`
    insert into public.agenda_especialidades (chave, nome, aliases) values
      ('consultaveterinaria', 'Consulta de Clínica Geral', array['consulta', 'consulta veterinária', 'clinico geral']),
      ('vacinas', 'Vacinas', array['vacina', 'vacinação']),
      ('oncologia', 'Oncologia', '{}');
    update public.lembrete_ajustes set envio_automatico = true;
  `);
}

const db = await montarBanco();
const { q, one, esperaErro, caso, assert, resumo } = ferramentas(db);
await semearAgenda(db);

console.log('Aplicando a ponte');
await caso('a migração aplica sem erro e pode ser reaplicada', async () => {
  await db.exec(ler(`migrations/${PONTE}`));
  await db.exec(ler(`migrations/${PONTE}`));
  const gatilhos = await q(`select tgname from pg_trigger where tgrelid = 'public.agenda_agendamentos'::regclass and not tgisinternal`);
  assert.deepEqual(gatilhos.map((g) => g.tgname), ['agenda_agendamentos_lembrete']);
});

await caso('a função da ponte não é chamável pelo navegador', async () => {
  await db.exec('set role authenticated');
  try {
    await esperaErro(() => db.query(`select public.agenda_agendamento_sincronizar_lembrete()`), 'permission denied');
  } finally {
    await db.exec('reset role');
  }
});

const envioDe = (id) => one(`select e.*, s.nome as categoria from public.lembrete_envios e left join public.lembrete_servicos s on s.id = e.servico_id where e.agendamento_chave = $1`, [`agenda:${id}`]);
const amanha = (await one(`select ((now() at time zone 'America/Sao_Paulo')::date + 1)::text d`)).d;
const depois = (await one(`select ((now() at time zone 'America/Sao_Paulo')::date + 2)::text d`)).d;

console.log('\nCriação do lembrete');
let consultaId; let vacinaId; let oncoId;
await caso('consulta: cria o lembrete com a categoria pelo outro nome do tipo e a regra geral', async () => {
  consultaId = await agendamento(db, { tipo: 'consultaveterinaria', nome: 'Consulta de Clínica Geral' });
  const e = await envioDe(consultaId);
  assert.ok(e, 'lembrete criado');
  assert.equal(e.categoria, 'Consulta Veterinária');
  assert.equal(e.configuracao_nome, 'Lembrete do dia anterior');
  assert.equal(e.origem, 'integracao');
  assert.equal(e.status, 'pendente');
  assert.equal(e.status_agendamento, 'CONFIRMADO');
  assert.equal(e.data_agendada.toISOString().slice(0, 10), amanha);
  assert.equal(e.horario_agendado, '14:00:00');
  assert.equal(e.nome_tutor, 'Maria Souza');
  assert.equal(e.nome_pet, 'Thor');
  assert.equal(e.telefone, '5561999990001');
});

await caso('lembrete programado para o dia anterior às 18h (fuso da regra)', async () => {
  const e = await envioDe(consultaId);
  const esperado = (await one(`select (((now() at time zone 'America/Sao_Paulo')::date + time '18:00') at time zone 'America/Sao_Paulo') as t`)).t;
  assert.equal(e.programado_para.toISOString(), esperado.toISOString());
});

await caso('vacina: o tipo "Vacinas" cai na categoria "Vacina" e na regra de vacinação', async () => {
  vacinaId = await agendamento(db, { tipo: 'vacinas', nome: 'Vacinas', telefone: '5561999990002', tutor: 'João Lima', pet: 'Mel' });
  const e = await envioDe(vacinaId);
  assert.equal(e.categoria, 'Vacina');
  assert.equal(e.configuracao_nome, 'Conscientização de vacinação');
  assert.equal(e.status_agendamento, 'CONFIRMADO'); // a regra exige "confirmado"
});

await caso('tipo sem categoria correspondente: mantém o nome do tipo e usa a regra geral', async () => {
  oncoId = await agendamento(db, { tipo: 'oncologia', nome: 'Oncologia', telefone: '5561999990003' });
  const e = await envioDe(oncoId);
  assert.equal(e.servico_id, null);
  assert.equal(e.servico, 'Oncologia');
  assert.equal(e.configuracao_nome, 'Lembrete do dia anterior');
});

await caso('sem nome do tutor o lembrete é criado (a saudação cai no texto neutro)', async () => {
  const id = await agendamento(db, { tipo: 'consultaveterinaria', nome: 'Consulta de Clínica Geral', telefone: '5561999990004', tutor: '   ', pet: '' });
  const e = await envioDe(id);
  assert.equal(e.nome_tutor, '');
  assert.equal(e.nome_pet, null);
});

await caso('telefone inválido ou atendimento no passado não geram lembrete', async () => {
  const curto = await agendamento(db, { tipo: 'consultaveterinaria', nome: 'Consulta', telefone: '12345' });
  assert.equal(await envioDe(curto), undefined);
  const passado = await agendamento(db, {
    tipo: 'consultaveterinaria', nome: 'Consulta', telefone: '5561999990005',
    inicio: `(now() - interval '1 day')`,
  });
  assert.equal(await envioDe(passado), undefined);
});

await caso('o horário respeita o fuso da empresa (Manaus, UTC-4)', async () => {
  await db.exec(`update public.atendimento_config set fuso_horario = 'America/Manaus'`);
  try {
    const id = await agendamento(db, {
      tipo: 'consultaveterinaria', nome: 'Consulta', telefone: '5561999990006',
      inicio: `(((now() at time zone 'America/Manaus')::date + 1 + time '09:30') at time zone 'America/Manaus')`,
    });
    const e = await envioDe(id);
    assert.equal(e.horario_agendado, '09:30:00');
  } finally {
    await db.exec(`update public.atendimento_config set fuso_horario = 'America/Sao_Paulo'`);
  }
});

console.log('\nRemarcação');
await caso('remarcar muda a data/hora do MESMO lembrete (sem duplicar)', async () => {
  await db.exec(`update public.agenda_agendamentos set inicio = ${DEPOIS_14H} + interval '1 hour', fim = ${DEPOIS_14H} + interval '90 minutes' where id = '${oncoId}'`);
  const linhas = await q(`select count(*)::int n from public.lembrete_envios where agendamento_chave = $1`, [`agenda:${oncoId}`]);
  assert.equal(linhas[0].n, 1);
  const e = await envioDe(oncoId);
  assert.equal(e.data_agendada.toISOString().slice(0, 10), depois);
  assert.equal(e.horario_agendado, '15:00:00');
  assert.equal(e.status, 'pendente');
});

await caso('mudança que não é de data/hora/status não mexe no lembrete', async () => {
  const antes = await envioDe(oncoId);
  await db.exec(`update public.agenda_agendamentos set atualizado_em = now() where id = '${oncoId}'`);
  const depoisLinha = await envioDe(oncoId);
  assert.equal(depoisLinha.updated_at.toISOString(), antes.updated_at.toISOString());
});

console.log('\nCancelamento antes do planejamento');
await caso('cancelar o agendamento cancela o lembrete pendente', async () => {
  await db.exec(`update public.agenda_agendamentos set status = 'cancelado', cancelado_em = now() where id = '${vacinaId}'`);
  const e = await envioDe(vacinaId);
  assert.equal(e.status, 'cancelado');
  assert.equal(e.status_agendamento, 'CANCELADO');
});

await caso('lembrete cancelado à mão no painel continua cancelado após remarcar', async () => {
  await db.exec(`update public.lembrete_envios set status = 'cancelado' where agendamento_chave = 'agenda:${oncoId}'`);
  await db.exec(`update public.agenda_agendamentos set inicio = ${AMANHA_14H}, fim = ${AMANHA_14H} + interval '30 minutes' where id = '${oncoId}'`);
  const e = await envioDe(oncoId);
  assert.equal(e.status, 'cancelado'); // decisão da equipe: não ressuscita
  const linhas = await one(`select count(*)::int n from public.lembrete_envios where agendamento_chave = $1`, [`agenda:${oncoId}`]);
  assert.equal(linhas.n, 1); // e também não cria um segundo lembrete
});

console.log('\nCom a mensagem já planejada na fila');
await caso('planejamento enfileira a mensagem do atendimento criado pela ponte', async () => {
  const id = await agendamento(db, { tipo: 'consultaveterinaria', nome: 'Consulta de Clínica Geral', telefone: '5561999990010', tutor: 'Ana Paula', pet: 'Bidu' });
  consultaId = id;
  const planejadas = (await one(`select public.lembretes_planejar(now(), null, true) as n`)).n;
  assert.ok(planejadas >= 1, 'ao menos uma mensagem');
  const e = await envioDe(id);
  assert.ok(e.mensagem_id, 'envio ligado a uma mensagem');
  const m = await one(`select status, nome_tutor, data_agendada from public.lembrete_mensagens where id = $1`, [e.mensagem_id]);
  assert.equal(m.status, 'pendente');
  assert.equal(m.nome_tutor, 'Ana Paula');
});

await caso('cancelar depois de planejado cancela a mensagem da fila (não envia para atendimento desmarcado)', async () => {
  const e = await envioDe(consultaId);
  await db.exec(`update public.agenda_agendamentos set status = 'cancelado', cancelado_em = now() where id = '${consultaId}'`);
  const depoisEnvio = await envioDe(consultaId);
  assert.equal(depoisEnvio.status, 'cancelado');
  const m = await one(`select status from public.lembrete_mensagens where id = $1`, [e.mensagem_id]);
  assert.equal(m.status, 'cancelado');
});

await caso('remarcar depois de planejado tira o atendimento da mensagem antiga e volta a aguardar a nova data', async () => {
  const id = await agendamento(db, { tipo: 'consultaveterinaria', nome: 'Consulta de Clínica Geral', telefone: '5561999990011', tutor: 'Carlos Dias', pet: 'Nina' });
  await db.query(`select public.lembretes_planejar(now(), null, true)`);
  const planejado = await envioDe(id);
  assert.ok(planejado.mensagem_id);
  await db.exec(`update public.agenda_agendamentos set inicio = ${DEPOIS_14H}, fim = ${DEPOIS_14H} + interval '30 minutes' where id = '${id}'`);
  const e = await envioDe(id);
  assert.equal(e.status, 'pendente');
  assert.equal(e.mensagem_id, null);
  assert.equal(e.data_agendada.toISOString().slice(0, 10), depois);
  const antiga = await one(`select status from public.lembrete_mensagens where id = $1`, [planejado.mensagem_id]);
  assert.equal(antiga.status, 'cancelado'); // era a única consulta do tutor
});

await caso('lembrete que já foi enviado fica como histórico quando o agendamento é cancelado', async () => {
  const id = await agendamento(db, { tipo: 'consultaveterinaria', nome: 'Consulta', telefone: '5561999990012' });
  await db.exec(`update public.lembrete_envios set status = 'enviado', enviado_em = now() where agendamento_chave = 'agenda:${id}'`);
  await db.exec(`update public.agenda_agendamentos set status = 'cancelado', cancelado_em = now() where id = '${id}'`);
  const e = await envioDe(id);
  assert.equal(e.status, 'enviado');
});

console.log('\nInstalações e dados anteriores');
await caso('sem o módulo de lembretes a ponte não atrapalha o agendamento', async () => {
  const sem = await montarBanco({ comLembretes: false });
  await sem.exec(ler(`migrations/${PONTE}`));
  await sem.exec(`insert into public.agenda_especialidades (chave, nome) values ('consultaveterinaria', 'Consulta')`);
  const id = await agendamento(sem, { tipo: 'consultaveterinaria', nome: 'Consulta' });
  assert.ok(id);
  await sem.exec(`update public.agenda_agendamentos set status = 'cancelado' where id = '${id}'`);
});

await caso('agendamentos futuros anteriores à ponte ganham lembrete na migração (sem duplicar ao reaplicar)', async () => {
  const antigo = await montarBanco();
  await antigo.exec(`
    insert into public.agenda_especialidades (chave, nome, aliases) values ('vacinas', 'Vacinas', array['vacina']);
  `);
  const futuro = await agendamento(antigo, { tipo: 'vacinas', nome: 'Vacinas', telefone: '5561999990020' });
  const cancelado = await agendamento(antigo, { tipo: 'vacinas', nome: 'Vacinas', telefone: '5561999990021', status: 'cancelado' });
  const passado = await agendamento(antigo, { tipo: 'vacinas', nome: 'Vacinas', telefone: '5561999990022', inicio: `(now() - interval '2 days')` });
  assert.equal((await antigo.query(`select count(*)::int n from public.lembrete_envios`)).rows[0].n, 0);
  await antigo.exec(ler(`migrations/${PONTE}`));
  await antigo.exec(ler(`migrations/${PONTE}`));
  const chaves = (await antigo.query(`select agendamento_chave from public.lembrete_envios order by 1`)).rows.map((r) => r.agendamento_chave);
  assert.deepEqual(chaves, [`agenda:${futuro}`]);
  assert.ok(cancelado && passado);
});

resumo();
