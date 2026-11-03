// Teste das migrações de lembretes num Postgres embutido (PGlite) com stubs do
// ambiente Supabase (papéis, auth.uid(), vault, pg_net, realtime).
// Nenhum banco real é tocado.
//
// Uso:
//   npm --prefix /tmp/pglite install @electric-sql/pglite@0.2.17
//   PGLITE_PATH=/tmp/pglite/node_modules/@electric-sql/pglite/dist/index.js \
//   BASE_SQL=<base das tabelas lembrete_configuracoes/lembrete_envios> \
//   LEMBRETES_SQL=<migração do módulo, já adaptada> \
//   SEED_SQL=<03_regra_vacinacao.sql, opcional> \
//     node banco-pglite.mjs
// Sem as variáveis, usa 01_base_lembretes.sql e 02_lembretes_envio_supabase.sql
// da pasta informada (padrão: ../banco da skill). Se o dashboard já tinha as
// tabelas, BASE_SQL deve recriar o formato atual delas (as migrações antigas
// do próprio projeto, só a parte de lembretes).
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const { PGlite } = await import(process.env.PGLITE_PATH ?? '@electric-sql/pglite');
const pasta = process.argv[2] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../banco');
const arquivoBase = process.env.BASE_SQL ?? path.join(pasta, '01_base_lembretes.sql');
const arquivoModulo = process.env.LEMBRETES_SQL ?? path.join(pasta, '02_lembretes_envio_supabase.sql');
const ler = (arquivo) => fs.readFileSync(arquivo, 'utf8');

const db = new PGlite();
const USER = '11111111-1111-1111-1111-111111111111';
let falhas = 0;
let ok = 0;

async function q(sql, params) {
  return (await db.query(sql, params)).rows;
}
async function one(sql, params) {
  return (await q(sql, params))[0];
}
async function caso(nome, fn) {
  try {
    await fn();
    ok++;
    console.log('  ✓', nome);
  } catch (e) {
    falhas++;
    console.log('  ✗', nome, '\n     ', e.message);
  }
}
async function comoUsuario(fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${USER}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
async function comoAnon(fn) {
  await db.exec(`set role anon;`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role;`);
  }
}
async function esperaErro(fn, trecho) {
  try {
    await fn();
  } catch (e) {
    if (trecho && !e.message.includes(trecho)) throw new Error(`erro inesperado: ${e.message}`);
    return e.message;
  }
  throw new Error('esperava erro e não houve');
}

// ---------------------------------------------------------------------------
// Ambiente Supabase simulado
// ---------------------------------------------------------------------------
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create publication supabase_realtime;
  create schema vault;
  create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
  create schema net;
  create table net.chamadas (url text, body jsonb, headers jsonb);
  create function net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds int)
    returns bigint language sql as
    $$ insert into net.chamadas values (url, body, headers); select 1::bigint $$;
`);

// Base do módulo (tabelas de regras e agenda).
await db.exec(ler(arquivoBase));
await db.exec(`
  create policy "lembrete_envios_anon_all" on public.lembrete_envios
    for all to anon using (true) with check (true);
  -- Simula produção com nomes de constraint diferentes dos gerados aqui.
  alter table public.lembrete_configuracoes
    rename constraint lembrete_configuracoes_dias_antecedencia_check to ck_antecedencia_prod;
  alter table public.lembrete_envios
    rename constraint lembrete_envios_status_check to ck_status_prod;
`);

// Dados antigos (antes da migração nova), como uma importação faria.
await db.exec(`
  insert into public.lembrete_envios
    (configuracao_id, configuracao_nome, agendamento_chave, data_agendada, servico,
     nome_tutor, nome_pet, telefone, programado_para, status, status_agendamento)
  values
    (1, 'Lembrete do dia anterior', 'antigo:1', '2026-09-25', 'vacina', 'ADA', 'BRUCE E NINA',
     '556196810330@s.whatsapp.net', '2026-09-24 21:00+00', 'enviado', 'ENVIADO'),
    (1, 'Lembrete do dia anterior', 'antigo:2', '2026-09-25', 'Banho', 'ALEX', 'OLAF',
     '556196552605', '2026-09-24 21:00+00', 'enviado', 'ENVIADO');
`);

console.log('\nAplicando a migração nova...');
await db.exec(ler(arquivoModulo));
console.log('  ✓ migração aplicada sem erro');
// Reaplicar precisa ser seguro (idempotência).
await db.exec(ler(arquivoModulo));
console.log('  ✓ migração reaplicada sem erro (idempotente)');

const hojeSP = (await one(`select (now() at time zone 'America/Sao_Paulo')::date::text as d`)).d;
const amanha = (await one(`select ((now() at time zone 'America/Sao_Paulo')::date + 1)::text as d`)).d;
const depois = (await one(`select ((now() at time zone 'America/Sao_Paulo')::date + 2)::text as d`)).d;
const ontem = (await one(`select ((now() at time zone 'America/Sao_Paulo')::date - 1)::text as d`)).d;
const as = (hora) => `(('${hojeSP}'::date + time '${hora}') at time zone 'America/Sao_Paulo')`;

console.log('\nHelpers e dados existentes');
await caso('telefone canônico', async () => {
  const r = await one(`select
    public.lembrete_telefone_chave('556196810330@s.whatsapp.net') a,
    public.lembrete_telefone_chave('5561993111008') b,
    public.lembrete_telefone_chave('556193111008') c,
    public.lembrete_telefone_chave('(61) 99311-1008') d,
    public.lembrete_telefone_chave('556132221111') e`);
  assert.equal(r.a, '556196810330');
  assert.equal(r.b, '556193111008');
  assert.equal(r.c, '556193111008');
  assert.equal(r.d, '556193111008');
  assert.equal(r.e, '556132221111');
});
await caso('serviços padrão + serviço legado "Banho" virou categoria', async () => {
  const nomes = (await q(`select nome from public.lembrete_servicos order by ordem, nome`)).map((r) => r.nome);
  assert.deepEqual(nomes.slice(0, 6), ['Consulta Veterinária', 'Retorno', 'Exame', 'Vacina', 'Banho e Tosa', 'Cirurgia']);
  assert.ok(nomes.includes('Banho'));
  assert.ok(!nomes.includes('vacina'), '"vacina" deveria casar com "Vacina"');
});
await caso('agenda antiga ligada à categoria', async () => {
  const r = await q(`select e.servico, s.nome from public.lembrete_envios e join public.lembrete_servicos s on s.id = e.servico_id order by e.id`);
  assert.equal(r.length, 2);
  assert.equal(r[0].nome, 'Vacina');
});
await caso('regra existente ganhou 5 frases e antecedência configurável', async () => {
  const r = await one(`select cardinality(exemplos) n, usar_ia, intervalo_min_segundos mi, intervalo_max_segundos ma from public.lembrete_configuracoes where id = 1`);
  assert.equal(r.n, 5);
  assert.equal(r.usar_ia, true);
  assert.equal(r.mi, 20);
  assert.equal(r.ma, 50);
  await db.exec(`update public.lembrete_configuracoes set dias_antecedencia = 2 where id = 1`);
  await db.exec(`update public.lembrete_configuracoes set dias_antecedencia = 1 where id = 1`);
  await esperaErro(() => db.exec(`update public.lembrete_configuracoes set dias_antecedencia = 9 where id = 1`), 'dias_antecedencia');
});
await caso('frases padrão não falam de vacina', async () => {
  const r = await one(`select array_to_string(public.lembrete_exemplos_padrao(), ' ') t`);
  assert.ok(!/vacin/i.test(r.t));
  for (const v of ['{{nome_tutor}}', '{{nome_pet}}', '{{servico}}', '{{data}}', '{{horario}}', '{{quando}}']) {
    assert.ok(r.t.includes(v), `faltou ${v}`);
  }
});

console.log('\nSegurança');
await caso('anon não lê nem grava a agenda', async () => {
  await esperaErro(() => comoAnon(() => q(`select * from public.lembrete_envios`)), 'permission denied');
  await esperaErro(() => comoAnon(() => q(`select * from public.lembrete_mensagens`)), 'permission denied');
  await esperaErro(() => comoAnon(() => q(`select public.lembretes_disparar_agora(1)`)), 'permission denied');
});
await caso('painel não grava mensagens direto nem chama funções internas', async () => {
  await esperaErro(() => comoUsuario(() => q(`insert into public.lembrete_mensagens (dia_envio, telefone, telefone_chave, nome_tutor, data_agendada, programado_para) values (current_date, '1', '1', 'x', current_date, now())`)), 'permission denied');
  await esperaErro(() => comoUsuario(() => q(`select public.lembretes_planejar()`)), 'permission denied');
  await esperaErro(() => comoUsuario(() => q(`select * from public.lembretes_reivindicar()`)), 'permission denied');
  await esperaErro(() => comoUsuario(() => q(`select public.lembretes_tick()`)), 'permission denied');
});
await caso('RPC do painel exige login', async () => {
  await db.exec(`set role authenticated;`);
  try {
    await esperaErro(() => q(`select public.lembretes_disparar_agora(1)`), 'Sessão expirada');
  } finally {
    await db.exec(`reset role;`);
  }
});

console.log('\nAgenda (inserida pelo painel)');
await comoUsuario(() =>
  db.exec(`
    insert into public.lembrete_envios
      (agendamento_chave, data_agendada, horario_agendado, servico, nome_tutor, nome_pet, telefone, origem, status_agendamento, configuracao_nome)
    values
      ('manual:a1', '${amanha}', '10:30', 'Consulta Veterinária', 'ANDRÉ', 'TOBY', '5561992074568', 'manual', 'CONFIRMADO', ''),
      ('manual:a2', '${amanha}', '14:00', 'exame', 'André', 'Mel', '556192074568@s.whatsapp.net', 'manual', 'CONFIRMADO', ''),
      ('manual:b1', '${amanha}', null, 'Vacina', 'WALTER', 'DONATELLO', '556182513546', 'manual', 'CONFIRMADO', ''),
      ('manual:c1', '${amanha}', '09:00', 'Consulta Veterinária', 'CLAUDIO', 'SUNKA', '556199965616', 'manual', 'CANCELADO', ''),
      ('manual:d1', '${ontem}', '09:00', 'Consulta Veterinária', 'DORA', 'AMY', '556196342705', 'manual', 'CONFIRMADO', ''),
      ('manual:e1', '${depois}', '09:00', 'Retorno', 'ELISA', 'AGATHA', '556196268680', 'manual', 'CONFIRMADO', '');
  `)
);
await caso('gatilho preencheu serviço, regra e horário previsto', async () => {
  const r = await one(`select e.servico, e.configuracao_id, e.configuracao_nome,
      to_char(e.programado_para at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI') prog,
      e.created_by::text cb
    from public.lembrete_envios e where agendamento_chave = 'manual:a2'`);
  assert.equal(r.servico, 'Exame');
  assert.equal(r.configuracao_id, 1);
  assert.equal(r.configuracao_nome, 'Lembrete do dia anterior');
  assert.equal(r.prog, `${hojeSP} 18:00`);
  assert.equal(r.cb, USER);
});

console.log('\nPlanejamento automático');
await caso('chave geral desligada: nada é planejado', async () => {
  assert.equal((await one(`select public.lembretes_planejar(${as('18:05')}) n`)).n, 0);
});
await db.exec(`update public.lembrete_ajustes set envio_automatico = true`);
await caso('antes do horário da regra: nada é planejado', async () => {
  assert.equal((await one(`select public.lembretes_planejar(${as('17:59')}) n`)).n, 0);
});
await caso('depois da janela (3h): nada é planejado', async () => {
  assert.equal((await one(`select public.lembretes_planejar(${as('21:01')}) n`)).n, 0);
});
await caso('no horário: 1 mensagem por tutor (André com 2 pets = 1)', async () => {
  const n = (await one(`select public.lembretes_planejar(${as('18:05')}) n`)).n;
  assert.equal(n, 2, 'esperava André e Walter (Claudio cancelado, Dora no passado, Elisa depois de amanhã)');
  const andre = await one(`select * from public.lembrete_mensagens where telefone_chave = '556192074568'`);
  assert.deepEqual([...andre.nomes_pets].sort(), ['Mel', 'TOBY']);
  assert.deepEqual([...andre.servicos].sort(), ['Consulta Veterinária', 'Exame']);
  assert.equal(andre.horario_agendado, '10:30:00');
  assert.equal(andre.disparo, 'automatico');
  const ligados = await one(`select count(*)::int n from public.lembrete_envios where mensagem_id = $1`, [andre.id]);
  assert.equal(ligados.n, 2);
});
await caso('intervalo aleatório de 20 a 50 s entre mensagens', async () => {
  const r = await q(`select extract(epoch from programado_para - ${as('18:05')})::int s from public.lembrete_mensagens where disparo = 'automatico' order by programado_para`);
  assert.ok(r[0].s >= 0 && r[0].s <= 50, `1º: ${r[0].s}s`);
  const gap = r[1].s - r[0].s;
  assert.ok(gap >= 20 && gap <= 50, `intervalo: ${gap}s`);
});
await caso('rodar de novo não duplica (idempotente)', async () => {
  assert.equal((await one(`select public.lembretes_planejar(${as('18:06')}) n`)).n, 0);
  assert.equal((await one(`select count(*)::int n from public.lembrete_mensagens`)).n, 2);
});
await caso('agendamento novo do mesmo tutor entra na mensagem pendente', async () => {
  await comoUsuario(() =>
    db.exec(`insert into public.lembrete_envios (agendamento_chave, data_agendada, horario_agendado, servico, nome_tutor, nome_pet, telefone, origem, configuracao_nome)
      values ('manual:a3', '${amanha}', '16:00', 'Banho e Tosa', 'André', 'Bob', '61992074568', 'manual', '')`)
  );
  assert.equal((await one(`select public.lembretes_planejar(${as('18:10')}) n`)).n, 0);
  const andre = await one(`select nomes_pets from public.lembrete_mensagens where telefone_chave = '556192074568'`);
  assert.equal(andre.nomes_pets.length, 3);
});
await caso('segunda regra no mesmo dia não gera 2º lembrete para o tutor', async () => {
  await db.exec(`insert into public.lembrete_configuracoes (nome, horario_envio, servico_ids)
    values ('Vacinas', '18:00', array[(select id from public.lembrete_servicos where nome = 'Vacina')])`);
  await comoUsuario(() =>
    db.exec(`insert into public.lembrete_envios (agendamento_chave, data_agendada, servico, nome_tutor, nome_pet, telefone, origem, configuracao_nome)
      values ('manual:b2', '${amanha}', 'Vacina', 'Walter', 'Leo', '556182513546', 'manual', '')`)
  );
  const regra = await one(`select configuracao_id, configuracao_nome from public.lembrete_envios where agendamento_chave = 'manual:b2'`);
  assert.equal(regra.configuracao_nome, 'Vacinas', 'serviço Vacina deveria cair na regra de vacinas');
  assert.equal((await one(`select public.lembretes_planejar(${as('18:12')}) n`)).n, 0);
  const walter = await q(`select id, nomes_pets from public.lembrete_mensagens where telefone_chave = '556182513546'`);
  assert.equal(walter.length, 1);
  assert.equal(walter[0].nomes_pets.length, 2);
});

console.log('\nFila e envio');
// Traz a fila para "agora" para poder reivindicar.
await db.exec(`update public.lembrete_mensagens set programado_para = now() + (id * interval '1 second')`);
let reivindicadas;
await caso('reivindicar marca como processando e conta tentativa', async () => {
  reivindicadas = await q(`select * from public.lembretes_reivindicar(10, 55)`);
  assert.equal(reivindicadas.length, 2);
  for (const m of reivindicadas) {
    assert.equal(m.status, 'processando');
    assert.equal(m.tentativas, 1);
  }
  const agenda = await one(`select count(*)::int n from public.lembrete_envios where status = 'processando'`);
  assert.equal(agenda.n, 5);
});
await caso('reivindicar de novo não pega as mesmas (sem envio duplo)', async () => {
  assert.equal((await q(`select * from public.lembretes_reivindicar(10, 55)`)).length, 0);
});
await caso('envio confirmado propaga para a agenda e registra evento', async () => {
  const m = reivindicadas[0];
  await db.exec(`update public.lembrete_mensagens set texto = 'Olá!', origem_texto = 'ia', modelo_ia = 'gpt-4.1-mini' where id = ${m.id}`);
  await db.exec(`update public.lembrete_mensagens set status = 'enviado', enviado_em = now(), provider_message_id = 'ABC', processando_desde = null where id = ${m.id}`);
  const agenda = await q(`select status, provider_message_id, enviado_em from public.lembrete_envios where mensagem_id = ${m.id}`);
  assert.ok(agenda.length >= 2);
  for (const a of agenda) {
    assert.equal(a.status, 'enviado');
    assert.equal(a.provider_message_id, 'ABC');
    assert.ok(a.enviado_em);
  }
  const ev = await q(`select tipo from public.lembrete_eventos where mensagem_id = ${m.id} order by id`);
  assert.deepEqual(ev.map((e) => e.tipo), ['planejado', 'enviado']);
});
await caso('falha propaga erro para a agenda', async () => {
  const m = reivindicadas[1];
  await db.exec(`update public.lembrete_mensagens set status = 'falha', erro = 'uazapi 500' where id = ${m.id}`);
  const a = await one(`select status, erro from public.lembrete_envios where mensagem_id = ${m.id} limit 1`);
  assert.equal(a.status, 'falha');
  assert.equal(a.erro, 'uazapi 500');
});
await caso('1 por dia: tutor que já recebeu não recebe de novo', async () => {
  const enviada = reivindicadas[0];
  const tel = enviada.telefone_chave;
  await comoUsuario(() =>
    db.exec(`insert into public.lembrete_envios (agendamento_chave, data_agendada, servico, nome_tutor, nome_pet, telefone, origem, configuracao_id, configuracao_nome)
      values ('manual:x1', '${amanha}', 'Exame', 'Mesmo Tutor', 'Rex', '${tel}', 'manual', ${enviada.configuracao_id}, '')`)
  );
  await comoUsuario(() => q(`select public.lembretes_disparar_agora(${enviada.configuracao_id})`));
  const x = await one(`select status, erro, mensagem_id from public.lembrete_envios where agendamento_chave = 'manual:x1'`);
  assert.equal(x.status, 'ignorado');
  assert.match(x.erro, /1 por dia/);
  assert.equal(x.mensagem_id, enviada.id);
  const msg = await esperaErro(() => comoUsuario(() => q(`select public.lembretes_enviar_agendamento((select id from public.lembrete_envios where agendamento_chave = 'manual:x1'))`)), '1 por dia');
  assert.ok(msg);
});
await caso('reenviar mensagem com falha volta para a fila sem texto', async () => {
  const m = reivindicadas[1];
  await comoUsuario(() => q(`select public.lembretes_reenviar_mensagem(${m.id})`));
  const r = await one(`select status, disparo, texto, erro from public.lembrete_mensagens where id = ${m.id}`);
  assert.equal(r.status, 'pendente');
  assert.equal(r.disparo, 'manual');
  assert.equal(r.texto, null);
  const a = await one(`select status from public.lembrete_envios where mensagem_id = ${m.id} limit 1`);
  assert.equal(a.status, 'pendente');
  const ev = await q(`select tipo from public.lembrete_eventos where mensagem_id = ${m.id} order by id`);
  assert.equal(ev.at(-1).tipo, 'reagendado');
});
await caso('cancelar mensagem na fila', async () => {
  const m = reivindicadas[1];
  await comoUsuario(() => q(`select public.lembretes_cancelar_mensagem(${m.id})`));
  assert.equal((await one(`select status from public.lembrete_mensagens where id = ${m.id}`)).status, 'cancelado');
  assert.equal((await one(`select status from public.lembrete_envios where mensagem_id = ${m.id} limit 1`)).status, 'ignorado');
  await esperaErro(() => comoUsuario(() => q(`select public.lembretes_cancelar_mensagem(${m.id})`)), 'ainda estão na fila');
});
await caso('enviar lembrete de um agendamento agora (tutor sem mensagem)', async () => {
  const id = (await one(`select id from public.lembrete_envios where agendamento_chave = 'manual:e1'`)).id;
  const mid = (await comoUsuario(() => one(`select public.lembretes_enviar_agendamento(${id}) mid`))).mid;
  assert.ok(mid);
  const m = await one(`select disparo, status, extract(epoch from (now() - programado_para))::int atraso, nomes_pets from public.lembrete_mensagens where id = ${mid}`);
  assert.equal(m.disparo, 'manual');
  assert.equal(m.status, 'pendente');
  assert.ok(m.atraso <= 2 && m.atraso >= -51, `sai na hora ou no próximo intervalo livre (${m.atraso}s)`);
  assert.deepEqual(m.nomes_pets, ['AGATHA']);
});
await caso('agendamento no passado não é enviado', async () => {
  const id = (await one(`select id from public.lembrete_envios where agendamento_chave = 'manual:d1'`)).id;
  await esperaErro(() => comoUsuario(() => q(`select public.lembretes_enviar_agendamento(${id})`)), 'já passou');
});

console.log('\nAgenda muda depois do planejamento');
await comoUsuario(() =>
  db.exec(`
    insert into public.lembrete_envios (agendamento_chave, data_agendada, horario_agendado, servico, nome_tutor, nome_pet, telefone, origem, configuracao_id, configuracao_nome)
    values
      ('fila:z1', '${amanha}', '08:00', 'Exame', 'Zuleide', 'Faísca', '5561977770001', 'manual', 1, ''),
      ('fila:z2', '${amanha}', '09:00', 'Retorno', 'Zuleide', 'Brisa', '5561977770001', 'manual', 1, ''),
      ('fila:y1', '${amanha}', '10:00', 'Exame', 'Yara', 'Nino', '5561977770002', 'manual', 1, '');
  `)
);
await comoUsuario(() => q(`select public.lembretes_disparar_agora(1)`));
const msgDe = (tel) => one(`select m.* from public.lembrete_mensagens m where m.telefone_chave = public.lembrete_telefone_chave('${tel}') and m.disparo <> 'teste'`);
await caso('cancelar o único atendimento cancela a mensagem da fila', async () => {
  assert.equal((await msgDe('5561977770002')).status, 'pendente');
  await comoUsuario(() => q(`update public.lembrete_envios set status = 'cancelado' where agendamento_chave = 'fila:y1'`));
  const m = await msgDe('5561977770002');
  assert.equal(m.status, 'cancelado');
  assert.match(m.erro, /cancelado ou removido/);
});
await caso('cancelar um de dois atendimentos tira o pet da mensagem', async () => {
  assert.equal((await msgDe('5561977770001')).nomes_pets.length, 2);
  await comoUsuario(() => q(`update public.lembrete_envios set status = 'cancelado' where agendamento_chave = 'fila:z2'`));
  const m = await msgDe('5561977770001');
  assert.equal(m.status, 'pendente');
  assert.deepEqual(m.nomes_pets, ['Faísca']);
  assert.deepEqual(m.servicos, ['Exame']);
});
await caso('excluir o atendimento restante cancela a mensagem', async () => {
  await comoUsuario(() => q(`delete from public.lembrete_envios where agendamento_chave = 'fila:z1'`));
  assert.equal((await msgDe('5561977770001')).status, 'cancelado');
});
await caso('remarcar atendimento já lembrado volta a aguardar na nova data', async () => {
  const antes = await one(`select status, mensagem_id from public.lembrete_envios where agendamento_chave = 'manual:a1'`);
  assert.equal(antes.status, 'enviado');
  await comoUsuario(() => q(`update public.lembrete_envios set data_agendada = '${depois}' where agendamento_chave = 'manual:a1'`));
  const depoisEdit = await one(`select status, mensagem_id, enviado_em from public.lembrete_envios where agendamento_chave = 'manual:a1'`);
  assert.equal(depoisEdit.status, 'pendente');
  assert.equal(depoisEdit.mensagem_id, null);
  assert.equal(depoisEdit.enviado_em, null);
  assert.equal((await one(`select status from public.lembrete_mensagens where id = ${antes.mensagem_id}`)).status, 'enviado');
});
await caso('reenvio respeita o intervalo depois do último envio', async () => {
  await db.exec(`update public.lembrete_mensagens set status = 'enviado', enviado_em = now() where id = (select min(id) from public.lembrete_mensagens where disparo <> 'teste' and status = 'enviado')`);
  const falha = (await one(`insert into public.lembrete_mensagens (configuracao_id, disparo, dia_envio, telefone, telefone_chave, nome_tutor, data_agendada, programado_para, status, erro)
    values (1, 'manual', '${hojeSP}', '5511900000099', '551100000099', 'Reenvio', '${amanha}', now(), 'falha', 'x') returning id`)).id;
  await comoUsuario(() => q(`select public.lembretes_reenviar_mensagem(${falha})`));
  const r = await one(`select extract(epoch from programado_para - now())::int s from public.lembrete_mensagens where id = ${falha}`);
  assert.ok(r.s >= 15, `reenvio colado no último envio (${r.s}s)`);
});

console.log('\nTravas de segurança');
await caso('mensagem atrasada além da janela vira ignorada (sem disparo em massa)', async () => {
  await db.exec(`update public.lembrete_mensagens set status = 'pendente', programado_para = now() - interval '4 hours' where disparo = 'manual' and status = 'pendente'`);
  const r = await q(`select * from public.lembretes_reivindicar(10, 55)`);
  assert.equal(r.length, 0);
  const m = await one(`select status, erro from public.lembrete_mensagens where disparo = 'manual' order by id desc limit 1`);
  assert.equal(m.status, 'ignorado');
  assert.match(m.erro, /janela/);
});
await caso('mensagem presa em processando vira falha (sem reenvio automático)', async () => {
  await db.exec(`update public.lembrete_mensagens set status = 'processando', processando_desde = now() - interval '11 minutes' where id = (select min(id) from public.lembrete_mensagens)`);
  await q(`select * from public.lembretes_reivindicar(10, 55)`);
  const m = await one(`select status, erro from public.lembrete_mensagens where id = (select min(id) from public.lembrete_mensagens)`);
  assert.equal(m.status, 'falha');
  assert.match(m.erro, /interrompido/);
});
await caso('chave geral desligada: automáticas ficam, manuais e testes saem', async () => {
  await db.exec(`update public.lembrete_ajustes set envio_automatico = false`);
  await db.exec(`
    with m as (
      insert into public.lembrete_mensagens (configuracao_id, disparo, dia_envio, telefone, telefone_chave, nome_tutor, data_agendada, programado_para)
      values (1, 'automatico', '${hojeSP}', '5511900000001', '551100000001', 'Auto', '${amanha}', now()),
             (1, 'manual', '${hojeSP}', '5511900000002', '551100000002', 'Manual', '${amanha}', now())
      returning id, nome_tutor, telefone
    )
    insert into public.lembrete_envios (configuracao_id, agendamento_chave, data_agendada, nome_tutor, telefone, mensagem_id, configuracao_nome)
    select 1, 'chave:' || m.id, '${amanha}', m.nome_tutor, m.telefone, m.id, '' from m`);
  const r = await q(`select nome_tutor from public.lembretes_reivindicar(10, 55)`);
  assert.deepEqual(r.map((x) => x.nome_tutor), ['Manual']);
  await db.exec(`update public.lembrete_ajustes set envio_automatico = true`);
});

console.log('\nTeste e diagnóstico');
await caso('envio de teste exige número e pode repetir no mesmo dia', async () => {
  await esperaErro(() => comoUsuario(() => q(`select public.lembretes_enviar_teste(1, null)`)), 'WhatsApp de teste');
  const a = (await comoUsuario(() => one(`select public.lembretes_enviar_teste(1, '(61) 99999-0000') id`))).id;
  const b = (await comoUsuario(() => one(`select public.lembretes_enviar_teste(1, '61999990000') id`))).id;
  assert.notEqual(a, b);
  const m = await one(`select telefone, disparo, nomes_pets from public.lembrete_mensagens where id = ${a}`);
  assert.equal(m.telefone, '5561999990000');
  assert.equal(m.disparo, 'teste');
});
await caso('diagnóstico responde sem pg_cron instalado', async () => {
  const d = (await comoUsuario(() => one(`select public.lembretes_diagnostico() d`))).d;
  assert.equal(d.cron_ativo, false);
  assert.equal(d.vault_configurado, false);
});
await caso('tick sem Vault registra erro uma vez e não chama a edge', async () => {
  await db.exec(`insert into public.lembrete_mensagens (disparo, dia_envio, telefone, telefone_chave, nome_tutor, data_agendada, programado_para)
    values ('manual', '${hojeSP}', '5511900000003', '551100000003', 'Fila', '${amanha}', now())`);
  await q(`select public.lembretes_tick()`);
  await q(`select public.lembretes_tick()`);
  const ev = await one(`select count(*)::int n from public.lembrete_eventos where tipo = 'erro_sistema'`);
  assert.equal(ev.n, 1);
  assert.equal((await one(`select count(*)::int n from net.chamadas`)).n, 0);
});
await caso('tick com Vault chama a edge com o segredo no header', async () => {
  await db.exec(`insert into vault.decrypted_secrets values
    ('lembretes_function_url', 'https://exemplo.supabase.co/functions/v1/lembretes'),
    ('lembretes_cron_secret', 'segredo-de-teste')`);
  await q(`select public.lembretes_tick()`);
  const c = await one(`select url, body, headers from net.chamadas`);
  assert.equal(c.body.acao, 'processar');
  assert.equal(c.headers['X-Cron-Secret'], 'segredo-de-teste');
});
await caso('painel lê mensagens, eventos, serviços e ajustes', async () => {
  await comoUsuario(async () => {
    assert.ok((await q(`select id from public.lembrete_mensagens`)).length > 0);
    assert.ok((await q(`select id from public.lembrete_eventos`)).length > 0);
    assert.ok((await q(`select id from public.lembrete_servicos`)).length > 0);
    await q(`update public.lembrete_ajustes set nome_clinica = 'Clínica Veterinária' where id = 1`);
    const ex = await one(`select public.lembrete_exemplos_padrao() e`);
    assert.equal(ex.e.length, 5);
  });
});
await caso('criar categoria liga agendamentos antigos sem categoria', async () => {
  await db.exec(`insert into public.lembrete_envios (agendamento_chave, data_agendada, servico, nome_tutor, telefone, origem, configuracao_nome)
    values ('imp:z', '${amanha}', 'Fisioterapia', 'Zé', '5561988887777', 'importacao', '')`);
  assert.equal((await one(`select servico_id from public.lembrete_envios where agendamento_chave = 'imp:z'`)).servico_id, null);
  await comoUsuario(() => q(`insert into public.lembrete_servicos (nome) values ('fisioterapia')`));
  const r = await one(`select e.servico, s.nome from public.lembrete_envios e join public.lembrete_servicos s on s.id = e.servico_id where agendamento_chave = 'imp:z'`);
  assert.equal(r.nome, 'fisioterapia');
});

await caso('remover serviço tira o id das regras', async () => {
  const vacina = (await one(`select id from public.lembrete_servicos where nome = 'Vacina'`)).id;
  await comoUsuario(() => q(`delete from public.lembrete_servicos where id = ${vacina}`));
  const r = await one(`select servico_ids from public.lembrete_configuracoes where nome = 'Vacinas'`);
  assert.deepEqual(r.servico_ids, []);
  const a = await one(`select servico, servico_id from public.lembrete_envios where agendamento_chave = 'manual:b2'`);
  assert.equal(a.servico_id, null);
  assert.equal(a.servico, 'Vacina', 'agendamento mantém o nome do serviço');
});

console.log('\nTexto do serviço na mensagem');
await caso('categorias padrão vêm com o texto escrito para a frase', async () => {
  const r = await one(`select texto_mensagem from public.lembrete_servicos where nome_normalizado = 'consulta veterinaria'`);
  assert.equal(r.texto_mensagem, 'consulta veterinária');
});
await caso('texto da categoria, texto do agendamento e atualização na fila', async () => {
  await comoUsuario(() => q(`insert into public.lembrete_servicos (nome, texto_mensagem) values ('Ultrassom', 'ultrassom abdominal')`));
  await comoUsuario(() =>
    db.exec(`insert into public.lembrete_envios
        (agendamento_chave, data_agendada, horario_agendado, servico, nome_tutor, nome_pet, telefone, origem, status_agendamento, configuracao_id, configuracao_nome)
      values
        ('txt:a', '${amanha}', '11:00', 'Ultrassom', 'Tânia', 'Lia', '5561955510001', 'manual', 'CONFIRMADO', (select id from public.lembrete_configuracoes where nome = 'Lembrete do dia anterior'), ''),
        ('txt:b', '${amanha}', '12:00', 'Ultrassom', 'Ugo', 'Max', '5561955510002', 'manual', 'CONFIRMADO', (select id from public.lembrete_configuracoes where nome = 'Lembrete do dia anterior'), '')`)
  );
  await db.exec(`update public.lembrete_ajustes set envio_automatico = true where id = 1`);
  await db.exec(`select public.lembretes_planejar(${as('18:15')})`);
  const get = async (chave) =>
    one(`select servicos, servicos_texto from public.lembrete_mensagens where telefone_chave = $1 and disparo = 'automatico'`, [chave]);
  let a = await get('556155510001');
  assert.deepEqual(a.servicos, ['Ultrassom'], 'o nome da categoria continua em servicos');
  assert.deepEqual(a.servicos_texto, ['ultrassom abdominal']);

  await comoUsuario(() => q(`update public.lembrete_envios set servico_texto = '  ultrassom de abdômen total ' where agendamento_chave = 'txt:a'`));
  a = await get('556155510001');
  assert.deepEqual(a.servicos_texto, ['ultrassom de abdômen total'], 'texto do agendamento vence o da categoria');

  await comoUsuario(() => q(`update public.lembrete_servicos set texto_mensagem = 'ultrassonografia' where nome = 'Ultrassom'`));
  const b = await get('556155510002');
  assert.deepEqual(b.servicos_texto, ['ultrassonografia'], 'mensagem na fila acompanha o texto novo da categoria');
  a = await get('556155510001');
  assert.deepEqual(a.servicos_texto, ['ultrassom de abdômen total'], 'texto próprio do agendamento não muda');

  await comoUsuario(() => q(`update public.lembrete_servicos set texto_mensagem = null where nome = 'Ultrassom'`));
  assert.deepEqual((await get('556155510002')).servicos_texto, ['Ultrassom'], 'sem texto, volta ao nome');
});

console.log('\nEnvio manual direto pelo painel');
await caso('reservar, enviar e concluir: o cron não reenvia e a agenda acompanha', async () => {
  await comoUsuario(() =>
    db.exec(`insert into public.lembrete_envios
        (agendamento_chave, data_agendada, horario_agendado, servico, nome_tutor, nome_pet, telefone, origem, status_agendamento, configuracao_id, configuracao_nome)
      values
        ('man:a', '${amanha}', '14:00', 'Exame', 'Marta', 'Nina', '5561955520001', 'manual', 'CONFIRMADO', (select id from public.lembrete_configuracoes where nome = 'Lembrete do dia anterior'), ''),
        ('man:b', '${amanha}', '15:00', 'Exame', 'Nilo', 'Bob', '5561955520002', 'manual', 'CONFIRMADO', (select id from public.lembrete_configuracoes where nome = 'Lembrete do dia anterior'), '')`)
  );
  await db.exec(`select public.lembretes_planejar(${as('18:20')})`);
  const a = await one(`select id from public.lembrete_mensagens where telefone_chave = '556155520001' and disparo = 'automatico'`);
  const b = await one(`select id from public.lembrete_mensagens where telefone_chave = '556155520002' and disparo = 'automatico'`);

  await esperaErro(() => comoUsuario(() => q(`select public.lembretes_reservar_envio_manual(${a.id}, 'oi')`)), 'entre 5 e 1200');
  await comoUsuario(() => q(`select public.lembretes_reservar_envio_manual(${a.id}, '  Olá, Marta! Texto revisado.  ')`));
  let m = await one(`select status, texto, origem_texto, tentativas from public.lembrete_mensagens where id = ${a.id}`);
  assert.equal(m.status, 'processando');
  assert.equal(m.texto, 'Olá, Marta! Texto revisado.');
  assert.equal(m.origem_texto, 'manual');
  assert.equal(m.tentativas, 1);
  assert.equal((await one(`select status from public.lembrete_envios where agendamento_chave = 'man:a'`)).status, 'processando');

  await esperaErro(() => comoUsuario(() => q(`select public.lembretes_reservar_envio_manual(${a.id}, 'Outro texto qualquer')`)), 'já foi enviada ou está sendo enviada');
  await db.exec(`update public.lembrete_mensagens set programado_para = now() - interval '1 minute' where id = ${a.id}`);
  const pegas = await q(`select id from public.lembretes_reivindicar(20, 55)`);
  assert.ok(!pegas.some((r) => r.id === a.id), 'o agendador não pode pegar a mensagem reservada');

  await comoUsuario(() => q(`select public.lembretes_concluir_envio_manual(${a.id}, true, 'WA-MANUAL-1')`));
  m = await one(`select status, provider_message_id, enviado_em, processando_desde from public.lembrete_mensagens where id = ${a.id}`);
  assert.equal(m.status, 'enviado');
  assert.equal(m.provider_message_id, 'WA-MANUAL-1');
  assert.ok(m.enviado_em);
  assert.equal(m.processando_desde, null);
  assert.equal((await one(`select status from public.lembrete_envios where agendamento_chave = 'man:a'`)).status, 'enviado');
  const ev = await one(`select descricao from public.lembrete_eventos where mensagem_id = ${a.id} and tipo = 'enviado'`);
  assert.match(ev.descricao, /revisado no painel/);

  // Falha na uazapi: vira falha com orientação, e pode ser reenviada depois.
  await comoUsuario(() => q(`select public.lembretes_reservar_envio_manual(${b.id}, 'Olá, Nilo! Texto revisado.')`));
  await comoUsuario(() => q(`select public.lembretes_concluir_envio_manual(${b.id}, false, null, 'Timeout. Confira no WhatsApp.')`));
  m = await one(`select status, erro from public.lembrete_mensagens where id = ${b.id}`);
  assert.equal(m.status, 'falha');
  assert.match(m.erro, /Confira no WhatsApp/);
  await esperaErro(() => comoUsuario(() => q(`select public.lembretes_concluir_envio_manual(${b.id}, true)`)), 'não está em envio manual');
});
await caso('anon não executa o envio manual', async () => {
  await esperaErro(() => comoAnon(() => q(`select public.lembretes_reservar_envio_manual(1, 'Texto qualquer')`)));
  await esperaErro(() => comoAnon(() => q(`select public.lembretes_concluir_envio_manual(1, true)`)));
});

console.log('\nRegra de vacinação (fluxo n8n LembretesVacinas)');
const arquivoSeed = process.env.SEED_SQL ?? path.join(pasta, '03_regra_vacinacao.sql');
if (!fs.existsSync(arquivoSeed)) {
  console.log('  (seed da regra de vacinação não informado: seção ignorada)');
} else {
  await db.exec(ler(arquivoSeed));
  await db.exec(ler(arquivoSeed));
  const NOME = 'Conscientização de vacinação';
  await caso('seed idempotente e com os parâmetros do fluxo original', async () => {
    const r = await q(`select * from public.lembrete_configuracoes where nome = '${NOME}'`);
    assert.equal(r.length, 1);
    assert.equal(r[0].dias_antecedencia, 0, 'mesmo dia (Data Agendada = hoje)');
    assert.equal(r[0].horario_envio.slice(0, 5), '20:00');
    assert.equal(r[0].somente_confirmados, true);
    assert.equal(r[0].intervalo_min_segundos, 20);
    assert.equal(r[0].intervalo_max_segundos, 50);
    assert.equal(r[0].usar_ia, true);
    assert.equal(r[0].exemplos.length, 5);
    const vacina = (await one(`select id from public.lembrete_servicos where nome_normalizado = 'vacina'`)).id;
    assert.deepEqual(r[0].servico_ids.map(Number), [Number(vacina)]);
    for (const ex of r[0].exemplos) assert.ok(!/rkdbbus|Pet com Pet|Bras[ií]lia/i.test(ex), 'sem marca nem fato local');
  });
  await caso('só CONFIRMADO entra; PENDENTE fica de fora; um por telefone', async () => {
    await comoUsuario(() =>
      db.exec(`insert into public.lembrete_envios
          (agendamento_chave, data_agendada, horario_agendado, servico, nome_tutor, nome_pet, telefone, origem, status_agendamento, configuracao_nome)
        values
          ('vac:ana1', '${hojeSP}', '09:00', 'Vacina', 'Ana', 'Rex', '5561988880001', 'importacao', 'CONFIRMADO', ''),
          ('vac:ana2', '${hojeSP}', '15:00', 'Vacina', 'Ana', 'Mia', '5561988880001', 'importacao', 'CONFIRMADO', ''),
          ('vac:beto', '${hojeSP}', '10:00', 'Vacina', 'Beto', 'Thor', '5561988880002', 'importacao', 'PENDENTE', '')`)
    );
    const regras = await q(`select agendamento_chave, configuracao_nome from public.lembrete_envios where agendamento_chave like 'vac:%' order by 1`);
    for (const r of regras) assert.equal(r.configuracao_nome, NOME, 'serviço Vacina cai na regra de vacinação');
    await db.exec(`update public.lembrete_ajustes set envio_automatico = true where id = 1`);
    await db.exec(`select public.lembretes_planejar(${as('20:05')})`);
    const ana = await q(`select * from public.lembrete_mensagens where telefone_chave = '556188880001' and disparo = 'automatico'`);
    assert.equal(ana.length, 1, 'uma mensagem por tutor por dia');
    assert.equal(ana[0].configuracao_nome, NOME);
    assert.equal(ana[0].nomes_pets.length, 2);
    const beto = await q(`select * from public.lembrete_mensagens where telefone_chave = '556188880002'`);
    assert.equal(beto.length, 0, 'PENDENTE não entra quando a regra exige CONFIRMADO');
  });
  await caso('desligar "somente confirmados" libera o PENDENTE', async () => {
    await db.exec(`update public.lembrete_configuracoes set somente_confirmados = false where nome = '${NOME}'`);
    await db.exec(`select public.lembretes_planejar(${as('20:10')})`);
    const beto = await q(`select * from public.lembrete_mensagens where telefone_chave = '556188880002'`);
    assert.equal(beto.length, 1);
  });
}

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
