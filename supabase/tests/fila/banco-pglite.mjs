// Fila presencial v2 no PGlite: carrega a base da fila (migrações REAIS 20260829 + 20260902, ou o
// 01_base_fila.sql da skill) e depois a v2, então prova também o caminho de atualização de um
// dashboard que já usa a fila.
//   npm --prefix /tmp/pglite install @electric-sql/pglite@0.2.17
//   PGLITE_PATH=/tmp/pglite/node_modules/@electric-sql/pglite/dist/index.js \
//     node --experimental-strip-types supabase/tests/fila/banco-pglite.mjs
//
// Variáveis (opcionais, usadas pela skill sistema-fila-presencial-dashboard):
//   FILA_MIGRACOES_DIR  pasta com os .sql (padrão: supabase/migrations deste repositório)
//   FILA_BASE           arquivos da base, separados por vírgula
//   FILA_V2             arquivo da migração v2
//
// LIMITE CONHECIDO: o PGlite tem UMA conexão. Ele prova a lógica (ordem, guardas, unicidade,
// privacidade, permissões), mas NÃO prova o FOR UPDATE SKIP LOCKED entre sessões simultâneas.
// Para isso, teste em um Postgres real com duas conexões (ver a skill, references/cutover.md).
import fs from 'node:fs';
import path from 'node:path';
import nodeAssert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const { PGlite } = await import(process.env.PGLITE_PATH ?? '@electric-sql/pglite');

const aqui = path.dirname(fileURLToPath(import.meta.url));
const MIGRACOES_DIR = process.env.FILA_MIGRACOES_DIR ?? path.resolve(aqui, '../../migrations');
const ler = (arquivo) => fs.readFileSync(path.join(MIGRACOES_DIR, arquivo), 'utf8');

const ADMIN = '11111111-1111-1111-1111-111111111111';
const ATENDENTE = '22222222-2222-2222-2222-222222222222';
const LIDER = '33333333-3333-3333-3333-333333333333';

const BASE_ANTIGA = (process.env.FILA_BASE ?? '20260829120000_chat_web_fila_prompt.sql,20260902120000_evolucao_fila_atendimento.sql').split(',');
const V2 = process.env.FILA_V2 ?? '20261028100000_fila_presencial_v2.sql';
const MIGRACOES = [...BASE_ANTIGA, V2];

function ferramentas(db) {
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const one = async (sql, params) => (await q(sql, params))[0];
  async function como(uid, fn, papel = 'authenticated') {
    await db.exec(`set role ${papel}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
    try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
  }
  async function esperaErro(fn, trecho) {
    try { await fn(); } catch (e) {
      if (trecho && !e.message.includes(trecho)) throw new Error(`erro inesperado: ${e.message}`);
      return e.message;
    }
    throw new Error('esperava erro e não houve');
  }
  let ok = 0;
  let falhas = 0;
  async function caso(nome, fn) {
    try { await fn(); ok++; console.log('  ✓', nome); } catch (e) { falhas++; console.log('  ✗', nome, '\n     ', e.message); }
  }
  return {
    q, one, como, esperaErro, caso, assert: nodeAssert,
    comoAdmin: (fn) => como(ADMIN, fn),
    comoAtendente: (fn) => como(ATENDENTE, fn),
    comoLider: (fn) => como(LIDER, fn),
    resumo() { console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0); },
  };
}

const VET = '44444444-4444-4444-4444-444444444444';
const TOTEM = '55555555-5555-5555-5555-555555555555';

async function criarBanco(migracoes = MIGRACOES) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    grant usage on schema auth to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated, service_role;

    -- perfis e papéis (espelho de 20260725100000 + 20260910190000)
    create table public.profiles (id uuid primary key references auth.users(id), nome text, email text,
      papel text not null default 'atendente' check (papel in ('admin','lider','atendente','veterinario')),
      ativo boolean not null default true);
    create table public.usuarios_previstos (email text primary key,
      papel text not null default 'atendente' check (papel in ('admin','lider','atendente','veterinario')), observacao text);
    insert into auth.users values ('${ADMIN}','admin@t.com'),('${ATENDENTE}','atend@t.com'),('${LIDER}','lider@t.com'),
      ('${VET}','vet@t.com'),('${TOTEM}','totem@t.com');
    insert into public.profiles (id, nome, papel) values ('${ADMIN}','Admin','admin'),('${ATENDENTE}','Atendente','atendente'),
      ('${LIDER}','Líder','lider'),('${VET}','Vet','veterinario');
    create function public.perfil_papel() returns text language sql stable security definer set search_path = '' as
      $$ select p.papel from public.profiles p where p.id = (select auth.uid()) and p.ativo $$;
    create function public.sou_gestor() returns boolean language sql stable security definer set search_path = '' as
      $$ select coalesce(public.perfil_papel() in ('admin','lider'), false) $$;
    revoke execute on function public.perfil_papel() from public, anon;
    revoke execute on function public.sou_gestor() from public, anon;

    -- tabela sensível qualquer, com a RLS "qualquer autenticado lê" que o dashboard usa em dezenas de tabelas
    create table public.dados_cliente (id bigint generated by default as identity primary key, nome text, sessionid text);
    alter table public.dados_cliente enable row level security;
    create policy "equipe le clientes" on public.dados_cliente for select to authenticated using (true);
    insert into public.dados_cliente (nome, sessionid) values ('Maria Secreta', '5541999990000@s.whatsapp.net');

    -- atendimento (espelho de 20261021130000 / 20261026100000)
    create table public.atendimento_config (id uuid primary key default gen_random_uuid(),
      singleton boolean not null default true unique, nome_empresa text not null default 'Minha empresa',
      codigo_pais text not null default '55', fuso_horario text not null default 'America/Sao_Paulo');
    insert into public.atendimento_config (nome_empresa) values ('Clínica Teste');
    create table public.atendimento_conversas (session_id text primary key, nome_contato text,
      criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
      ultima_mensagem_em timestamptz, ultima_resposta_bot_em timestamptz);
    create table public.atendimento_outbox (id uuid primary key default gen_random_uuid(),
      session_id text not null references public.atendimento_conversas(session_id) on delete cascade,
      dedupe_key text not null unique, destino text not null, tipo text not null default 'texto',
      conteudo text not null, estado text not null default 'pending', tentativas smallint not null default 0,
      proxima_tentativa_em timestamptz not null default now(), provider_message_id text, ultimo_erro_codigo text,
      criado_em timestamptz not null default now(), enviado_em timestamptz);
    create table public.tick_log (id bigint generated always as identity primary key, em timestamptz default now());
    create function public.atendimento_tick() returns void language sql as $$ insert into public.tick_log default values $$;

    -- Realtime: send() grava o que foi emitido, para o teste conferir o conteúdo
    create schema realtime;
    create table realtime.log (id bigint generated always as identity primary key, payload jsonb, event text, topic text, private boolean);
    create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
      returns void language sql as $$ insert into realtime.log (payload, event, topic, private) values (payload, event, topic, private) $$;

    -- Storage (apenas o que a migração toca)
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant all on storage.objects, storage.buckets to authenticated;
    create publication supabase_realtime;
  `);
  for (const arquivo of migracoes) await db.exec(ler(arquivo));
  return db;
}

const db = await criarBanco();
const { q, one, como, esperaErro, caso, assert, comoAdmin, comoAtendente, comoLider, resumo } = ferramentas(db);
const comoVet = (fn) => como(VET, fn);
const comoTotem = (fn) => como(TOTEM, fn);
const comoAnon = (fn) => como('', fn, 'anon');

const servico = async (prefixo) => (await one('select id from public.fila_servicos where prefixo = $1 limit 1', [prefixo])).id;
const sala = async (nome) => (await one('select id from public.fila_salas where nome = $1', [nome])).id;
const emitir = (args) =>
  comoAtendente(() =>
    one(
      `select * from public.adicionar_item_fila(p_servico_id => $1, p_tutor_nome => $2, p_pet_nome => $3, p_prioridade => $4,
         p_telefone => $5, p_origem => $6, p_sala_id => $7)`,
      [args.servico, args.tutor ?? 'Tutor Teste', args.pet ?? null, args.prioridade ?? 'normal', args.telefone ?? null, args.origem ?? 'balcao', args.sala ?? null],
    ),
  );
const acao = (id, a, extras = {}) =>
  comoAtendente(() => one('select * from public.alterar_status_fila($1, $2, $3, $4, $5)', [id, a, extras.sala ?? null, extras.servico ?? null, extras.motivo ?? null]));
const limpar = () =>
  db.exec(`delete from public.atendimento_outbox; delete from public.atendimento_conversas; delete from public.fila_chamadas;
           delete from public.fila_itens; delete from realtime.log; delete from public.tick_log;`);
const config = (set) => comoAdmin(() => db.exec(`update public.fila_config set ${set}`));

console.log('Fila presencial v2 (migrações reais 0829 + 0902 + v2)');

await caso('a migração é idempotente (rodar de novo não muda nada nem dá erro)', async () => {
  const antes = (await one('select count(*)::int n from pg_policy')).n;
  await db.exec(ler(V2));
  assert.equal((await one('select count(*)::int n from pg_policy')).n, antes);
  assert.equal((await one('select count(*)::int n from public.fila_config')).n, 1);
});

await caso('fuso de fila_config nasce de atendimento_config; nome da TV cai no nome da empresa', async () => {
  await db.exec(`update public.atendimento_config set fuso_horario = 'America/Sao_Paulo'`);
  const painel = await comoAnon(() => one('select public.fila_tv_painel() p'));
  assert.equal(painel.p.config.nome, 'Clínica Teste');
  await config(`nome_exibicao = 'Clínica da Marca'`);
  assert.equal((await comoAnon(() => one('select public.fila_tv_painel() p'))).p.config.nome, 'Clínica da Marca');
  await config('nome_exibicao = null');
});

await caso('papel "totem" é aceito em profiles e usuarios_previstos', async () => {
  await db.exec(`insert into public.profiles (id, nome, papel) values ('${TOTEM}', 'Totem', 'totem')`);
  await db.exec(`insert into public.usuarios_previstos (email, papel) values ('totem@t.com', 'totem')`);
  await esperaErro(() => db.exec(`insert into public.usuarios_previstos (email, papel) values ('x@t.com', 'hacker')`), 'check');
});

await caso('numeração diária: reinicia no novo dia e respeita senha ativa de dia anterior', async () => {
  await limpar();
  const a = await servico('A');
  const s1 = await emitir({ servico: a });
  const s2 = await emitir({ servico: a });
  assert.deepEqual([s1.senha, s2.senha], ['A001', 'A002']);
  assert.equal(s1.ciclo, (await one(`select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') d`)).d);

  // "Virou o dia": os dois ficam no ciclo de ontem; A001 foi finalizada, A002 esqueceram na fila.
  await db.exec(`update public.fila_itens set ciclo = '2000-01-01'`);
  await db.exec(`update public.fila_itens set status = 'finalizado' where senha = 'A001'`);
  const s3 = await emitir({ servico: a });
  assert.equal(s3.senha, 'A003', 'A002 ainda ativa de ontem: o novo dia continua depois dela');
  await db.exec(`update public.fila_itens set status = 'finalizado' where senha in ('A002', 'A003')`);
  await db.exec(`update public.fila_itens set ciclo = '2000-01-02' where senha = 'A003'`);
  const s4 = await emitir({ servico: a });
  assert.equal(s4.senha, 'A001', 'sem nada ativo de dias anteriores, o dia novo recomeça em 001');
});

await caso('índice único (ciclo, senha) impede duplicar a senha no mesmo dia, mas não em dias diferentes', async () => {
  const a = await servico('A');
  const item = await one(`select * from public.fila_itens where senha = 'A001' and ciclo <> '2000-01-01' limit 1`);
  await esperaErro(
    () => db.exec(`insert into public.fila_itens (senha, ciclo, servico_id, tutor_nome) values ('A001', '${item.ciclo}', '${a}', 'Clone')`),
    'fila_itens_ciclo_senha_uq',
  );
  await db.exec(`insert into public.fila_itens (senha, ciclo, servico_id, tutor_nome) values ('A001', '1999-12-31', '${a}', 'Outro dia')`);
});

await caso('ciclo respeita o fuso da clínica na virada do dia; fuso inválido é recusado', async () => {
  // 02:30Z do dia 25 é 23:30 do dia 24 em São Paulo e 11:30 do dia 25 em Tóquio.
  assert.equal((await one(`select public.fila_ciclo('2026-10-25T02:30:00Z') c`)).c, '2026-10-24');
  await config(`fuso_horario = 'Asia/Tokyo'`);
  assert.equal((await one(`select public.fila_ciclo('2026-10-25T02:30:00Z') c`)).c, '2026-10-25');
  await esperaErro(() => config(`fuso_horario = 'Marte/Olympus'`), 'Fuso horário inválido');
  await config(`fuso_horario = 'America/Sao_Paulo'`);
});

await caso('numeração contínua: ciclo único e numeração segue de onde parou', async () => {
  await limpar();
  await config('numeracao_diaria = false');
  const b = await servico('B');
  const x = await emitir({ servico: b });
  const y = await emitir({ servico: b });
  assert.deepEqual([x.ciclo, x.senha, y.senha], ['continuo', 'B001', 'B002']);
  await config('numeracao_diaria = true');
});

await caso('prefixos parecidos (A e AB) não se confundem na numeração', async () => {
  await limpar();
  const srv = await comoAdmin(() => one(`insert into public.fila_servicos (nome, prefixo) values ('Dupla letra', 'AB') returning id`));
  const a = await servico('A');
  await emitir({ servico: a });
  const ab = await emitir({ servico: srv.id });
  assert.equal(ab.senha, 'AB001');
  assert.equal((await emitir({ servico: a })).senha, 'A002');
});

await caso('ordem de chamada: Emergência > Preferencial > Normal; empate por chegada; sala própria só para a sala', async () => {
  await limpar();
  const a = await servico('A');
  const s1 = await sala('Sala 01');
  const s2 = await sala('Sala 02');
  const normal1 = await emitir({ servico: a, tutor: 'N1' });
  const pref = await emitir({ servico: a, tutor: 'P', prioridade: 'prioridade' });
  const normal2 = await emitir({ servico: a, tutor: 'N2' });
  const emerg = await emitir({ servico: a, tutor: 'E', prioridade: 'emergencia' });
  const daSala2 = await emitir({ servico: a, tutor: 'S2', prioridade: 'emergencia', sala: s2 });

  const chamar = (salaId) => comoAtendente(() => one('select * from public.sala_chamar_fila($1) r', [salaId]));
  assert.equal((await chamar(s1)).tutor_nome, 'E', 'emergência sem sala vem primeiro para a sala 1 (a da sala 2 é só dela)');
  assert.equal((await chamar(s1)).tutor_nome, 'P');
  assert.equal((await chamar(s1)).tutor_nome, 'N1');
  assert.equal((await chamar(s2)).tutor_nome, 'S2');
  assert.equal((await chamar(s2)).tutor_nome, 'N2');
  await comoAtendente(() => esperaErro(() => chamar(s2), 'Nenhum paciente aguardando'));
  assert.ok(normal1 && normal2 && emerg && daSala2);
});

await caso('duas chamadas em sequência na mesma transação nunca repetem o paciente', async () => {
  await limpar();
  const a = await servico('A');
  const s1 = await sala('Sala 01');
  await emitir({ servico: a, tutor: 'Um' });
  await emitir({ servico: a, tutor: 'Dois' });
  const r = await comoAtendente(async () => {
    await db.exec('begin');
    try {
      const x = await one('select * from public.sala_chamar_fila($1) r', [s1]);
      const y = await one('select * from public.sala_chamar_fila($1) r', [s1]);
      return [x.id, y.id];
    } finally { await db.exec('commit'); }
  });
  assert.notEqual(r[0], r[1]);
});

await caso('sala desativada não chama', async () => {
  const s3 = await sala('Recepção');
  await comoAdmin(() => db.exec(`update public.fila_salas set ativa = false where id = '${s3}'`));
  await comoAtendente(() => esperaErro(() => one('select * from public.sala_chamar_fila($1) r', [s3]), 'desativada'));
  await comoAdmin(() => db.exec(`update public.fila_salas set ativa = true where id = '${s3}'`));
});

await caso('ações: finalizado e cancelado não aceitam mais nada; retornar zera a chamada; transferir mantém a chegada', async () => {
  await limpar();
  const a = await servico('A');
  const e = await servico('E');
  const s2 = await sala('Sala 02');
  const item = await emitir({ servico: a });
  const chamado = (await acao(item.id, 'chamar'));
  assert.equal(chamado.status, 'chamado');
  assert.ok(chamado.chamado_em);
  const volta = (await acao(item.id, 'retornar'));
  assert.equal([volta.status, volta.chamado_em].join('|'), 'aguardando|');

  const trans = (await acao(item.id, 'transferir', { sala: s2, servico: e, motivo: 'Raio-X' }));
  assert.equal(new Date(trans.chegada_em).getTime(), new Date(item.chegada_em).getTime());
  assert.equal(trans.sala_id, s2);
  assert.equal(trans.servico_id, e);
  assert.equal(trans.historico_transferencias.length, 1);
  assert.equal(trans.historico_transferencias[0].motivo, 'Raio-X');

  await acao(item.id, 'iniciar');
  const fim = (await acao(item.id, 'finalizar'));
  assert.equal(fim.status, 'finalizado');
  assert.ok(fim.finalizado_por);
  for (const a2 of ['chamar', 'retornar', 'cancelar', 'iniciar']) {
    await esperaErro(() => acao(item.id, a2), 'já foi encerrado');
  }
  await esperaErro(() => acao(item.id, 'xyz'), 'encerrado'); // encerrado vence a validação de ação
  const outro = await emitir({ servico: a });
  await esperaErro(() => acao(outro.id, 'xyz'), 'Ação de fila inválida');
  await esperaErro(() => acao(outro.id, 'chamar', { sala: '00000000-0000-0000-0000-000000000000' }), 'Sala inexistente');
});

await caso('repetir chamada: chama de novo, registra outra chamada e atualiza o horário (a TV toca de novo)', async () => {
  await limpar();
  const a = await servico('A');
  const item = await emitir({ servico: a });
  const c1 = (await acao(item.id, 'chamar'));
  await new Promise((r) => setTimeout(r, 15));
  const c2 = (await acao(item.id, 'chamar'));
  assert.ok(new Date(c2.chamado_em) > new Date(c1.chamado_em));
  assert.equal((await one('select count(*)::int n from public.fila_chamadas where item_id = $1', [item.id])).n, 2);
});

await caso('TV pública: privacidade aplicada no servidor, só o primeiro nome do tutor, anon não lê as tabelas', async () => {
  await limpar();
  const a = await servico('A');
  const s1 = await sala('Sala 01');
  const w = await emitir({ servico: a, tutor: 'Carlos Alberto Souza', pet: 'Thor' });
  await emitir({ servico: a, tutor: 'Maria Silva', pet: 'Mel' });
  await acao(w.id, 'chamar', { sala: s1 });

  let p = (await comoAnon(() => one('select public.fila_tv_painel() p'))).p;
  assert.equal(p.atual.senha, w.senha);
  assert.equal(p.atual.pet, 'Thor');
  assert.equal(p.atual.tutor, null, 'por padrão a TV pública não mostra nome de tutor');
  assert.equal(p.atual.sala, 'Sala 01');
  assert.equal(p.proximos[0].pet, 'Mel');
  assert.equal(p.aguardando, 1);
  assert.ok(!JSON.stringify(p).includes('Souza') && !JSON.stringify(p).includes('Silva'));

  await config('tv_mostrar_tutor = true');
  p = (await comoAnon(() => one('select public.fila_tv_painel() p'))).p;
  assert.equal(p.atual.tutor, 'Carlos', 'com a opção ligada, só o PRIMEIRO nome');
  assert.ok(!JSON.stringify(p).includes('Souza') && !JSON.stringify(p).includes('Silva'), 'nunca o nome completo');
  await config('tv_privacidade = true');
  p = (await comoAnon(() => one('select public.fila_tv_painel() p'))).p;
  assert.equal(p.atual.senha, w.senha);
  assert.deepEqual([p.atual.pet, p.atual.tutor, p.atual.veterinario, p.proximos[0].pet], [null, null, null, null]);
  const legado = await comoAnon(() => q('select * from public.fila_tv_estado()'));
  assert.ok(legado.every((l) => l.pet_nome === null && l.veterinario_nome === null), 'a TV antiga também respeita a privacidade');
  await config('tv_privacidade = false, tv_mostrar_tutor = false');

  await como('', () => esperaErro(() => q('select * from public.fila_itens'), 'permission denied'), 'anon');
  await como('', () => esperaErro(() => q('select * from public.fila_config'), 'permission denied'), 'anon');
  await como('', () => esperaErro(() => q('select * from public.fila_chamadas'), 'permission denied'), 'anon');
  await como('', () => esperaErro(() => q(`select * from public.alterar_status_fila('${w.id}', 'cancelar')`), 'permission denied'), 'anon');
  await como('', () => esperaErro(() => q('select * from public.sala_obter_fila()'), 'permission denied'), 'anon');
});

await caso('TV: chamadas recentes vêm do histórico (inclui quem já entrou em atendimento) e não repetem a atual', async () => {
  await limpar();
  const a = await servico('A');
  const s1 = await sala('Sala 01');
  const itens = [];
  for (let i = 0; i < 6; i++) itens.push(await emitir({ servico: a, tutor: `T${i}` }));
  for (const it of itens) { await acao(it.id, 'chamar', { sala: s1 }); await new Promise((r) => setTimeout(r, 5)); }
  await acao(itens[0].id, 'iniciar');
  await acao(itens[5].id, 'chamar', { sala: s1 }); // repete a última
  const p = (await comoAnon(() => one('select public.fila_tv_painel() p'))).p;
  assert.equal(p.atual.senha, itens[5].senha);
  assert.equal(p.recentes.length, 4, 'no máximo 4');
  assert.ok(!p.recentes.some((r) => r.senha === itens[5].senha), 'a atual não aparece nas recentes');
  assert.deepEqual(p.recentes.map((r) => r.senha), [itens[4], itens[3], itens[2], itens[1]].map((i) => i.senha), 'mais recente primeiro');
});

await caso('playlist: só mídias ativas, na ordem; a TV recebe caminho/URL e nada mais', async () => {
  await comoAdmin(() => db.exec(`insert into public.fila_midias (nome, arquivo_path, ordem) values ('B', 'videos/b.mp4', 2), ('A', 'videos/a.mp4', 1);
    insert into public.fila_midias (nome, url_externa, ordem) values ('CDN', 'https://cdn.exemplo.com/c.mp4', 3);
    insert into public.fila_midias (nome, arquivo_path, ordem, ativo) values ('Pausado', 'videos/p.mp4', 0, false)`));
  const p = (await comoAnon(() => one('select public.fila_tv_painel() p'))).p;
  assert.deepEqual(p.midias.map((m) => m.nome), ['A', 'B', 'CDN']);
  assert.equal(p.midias[2].url, 'https://cdn.exemplo.com/c.mp4');
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.fila_midias (nome) values ('sem origem')`), 'check'));
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.fila_midias (nome, url_externa) values ('ftp', 'ftp://x/y.mp4')`), 'check'));
});

await caso('permissões: só gestor altera a configuração e a playlist; anon e atendente não', async () => {
  await comoAtendente(async () => {
    assert.equal((await q('select * from public.fila_config')).length, 1, 'equipe lê');
    assert.equal((await one(`with u as (update public.fila_config set cor_marca = '#ff0000' returning 1) select count(*)::int n from u`)).n, 0);
    await esperaErro(() => db.exec(`insert into public.fila_midias (nome, url_externa) values ('x', 'https://a.b/c.mp4')`), 'row-level security');
    assert.equal((await one(`with u as (update public.fila_midias set ativo = false returning 1) select count(*)::int n from u`)).n, 0);
    assert.equal((await one(`with d as (delete from public.fila_midias returning 1) select count(*)::int n from d`)).n, 0);
  });
  await comoLider(async () => {
    await db.exec(`update public.fila_config set cor_marca = '#112233'`);
    assert.equal((await one('select cor_marca from public.fila_config')).cor_marca, '#112233');
  });
  await comoAdmin(() => esperaErro(() => db.exec(`update public.fila_config set cor_marca = 'vermelho'`), 'check'));
  await comoAdmin(() => esperaErro(() => db.exec(`update public.fila_config set tv_layout = 'cinema'`), 'check'));
  await comoAdmin(() => esperaErro(() => db.exec(`update public.fila_config set tv_aviso_segundos = 1`), 'check'));
  await config(`cor_marca = '#2294aa'`);
});

await caso('Storage: bucket público criado; só gestor envia/remove arquivos', async () => {
  const b = await one(`select * from storage.buckets where id = 'fila-midias'`);
  assert.equal(b.public, true);
  assert.ok(b.allowed_mime_types.includes('video/mp4'));
  await comoAtendente(() => esperaErro(() => db.exec(`insert into storage.objects (bucket_id, name) values ('fila-midias', 'videos/x.mp4')`), 'row-level security'));
  await comoLider(() => db.exec(`insert into storage.objects (bucket_id, name) values ('fila-midias', 'videos/x.mp4')`));
  await comoAtendente(async () => {
    await db.exec(`delete from storage.objects where bucket_id = 'fila-midias'`);
  });
  assert.equal((await one(`select count(*)::int n from storage.objects`)).n, 1, 'atendente não removeu');
});

await caso('Broadcast para a TV: um "tick" vazio no tópico público, sem nenhum dado pessoal', async () => {
  await limpar();
  const a = await servico('A');
  await emitir({ servico: a, tutor: 'Carlos Segredo', pet: 'Thor', telefone: '41999990000' });
  const logs = await q('select * from realtime.log');
  assert.ok(logs.length >= 1);
  for (const l of logs) {
    assert.equal(l.topic, 'fila-tv');
    assert.equal(l.private, false);
    assert.equal(l.event, 'tick');
    assert.deepEqual(l.payload, {});
  }
});

await caso('WhatsApp nasce DESLIGADO: emitir e chamar com telefone não enfileira nada', async () => {
  await limpar();
  assert.equal((await one('select whatsapp_ativo from public.fila_config')).whatsapp_ativo, false);
  const a = await servico('A');
  const it = await emitir({ servico: a, telefone: '(41) 99999-0000' });
  assert.equal(it.telefone, '5541999990000', 'o telefone é normalizado mesmo desligado');
  await acao(it.id, 'chamar');
  assert.equal((await one('select count(*)::int n from public.atendimento_outbox')).n, 0);
  assert.equal((await one('select count(*)::int n from public.tick_log')).n, 0);
});

await caso('WhatsApp ligado: confirmação, "sua vez está chegando" e chamada — uma vez cada, na outbox', async () => {
  await limpar();
  await config(`whatsapp_ativo = true, wpp_somente_conhecidos = false, wpp_avisar_proximo = 1`);
  // Conversa já existente SEM o 9º dígito: deve ser reaproveitada.
  await db.exec(`insert into public.atendimento_conversas (session_id, nome_contato, ultima_mensagem_em) values ('554199990000@s.whatsapp.net', 'Cliente antigo', now())`);
  const a = await servico('A');
  const s1 = await sala('Sala 01');
  const i1 = await emitir({ servico: a, tutor: 'Ana Paula Lima', pet: 'Bidu', telefone: '41 99999-0000' });
  const i2 = await emitir({ servico: a, tutor: 'Beto', telefone: '41988887777' });
  const i3 = await emitir({ servico: a, tutor: 'Caio', telefone: '41977776666' });
  const i4 = await emitir({ servico: a, tutor: 'Duda', telefone: '41966665555' });
  await emitir({ servico: a, tutor: 'Sem telefone' });

  let outbox = await q(`select * from public.atendimento_outbox order by criado_em, dedupe_key`);
  assert.equal(outbox.length, 4, 'uma confirmação por senha com telefone');
  const o1 = outbox.find((o) => o.dedupe_key === `fila:${i1.id}:emissao`);
  assert.equal(o1.tipo, 'notificacao');
  assert.equal(o1.destino, '5541999990000');
  assert.equal(o1.session_id, '554199990000@s.whatsapp.net', 'reaproveitou a conversa existente');
  assert.match(o1.conteudo, /Ana, sua senha|Olá, Ana!/);
  assert.match(o1.conteudo, /\*A001\*/);
  assert.match(o1.conteudo, /Clínica Teste/);
  assert.ok(!o1.conteudo.includes('{{'), 'nenhuma variável sobra no texto');
  assert.ok((await one('select count(*)::int n from public.tick_log')).n >= 1, 'acionou a entrega imediata');

  // i1 sai da espera (chamada): i2 (0 à frente) e i3 (1 à frente) recebem "sua vez está chegando"; i4 (2 à frente) não.
  await acao(i1.id, 'chamar', { sala: s1 });
  outbox = await q(`select dedupe_key from public.atendimento_outbox`);
  const chaves = new Set(outbox.map((o) => o.dedupe_key));
  assert.ok(chaves.has(`fila:${i1.id}:chamada`));
  assert.ok(chaves.has(`fila:${i2.id}:proximo`) && chaves.has(`fila:${i3.id}:proximo`));
  assert.ok(!chaves.has(`fila:${i4.id}:proximo`));
  const chamada = (await q(`select conteudo from public.atendimento_outbox where dedupe_key = 'fila:${i1.id}:chamada'`))[0].conteudo;
  assert.match(chamada, /Bidu/);
  assert.match(chamada, /Sala 01/);

  // Repetir a chamada NÃO manda outra mensagem; i2 sair avisa o i4.
  const antes = (await one('select count(*)::int n from public.atendimento_outbox')).n;
  await acao(i1.id, 'chamar', { sala: s1 });
  assert.equal((await one('select count(*)::int n from public.atendimento_outbox')).n, antes);
  await acao(i2.id, 'chamar', { sala: s1 });
  assert.ok((await q(`select 1 from public.atendimento_outbox where dedupe_key = 'fila:${i4.id}:proximo'`)).length === 1);
  assert.ok((await one('select avisos from public.fila_itens where id = $1', [i4.id])).avisos.proximo);

  // Telefone nunca vai na TV.
  assert.ok(!JSON.stringify((await comoAnon(() => one('select public.fila_tv_painel() p'))).p).includes('9999'));
});

await caso('WhatsApp: por padrão só avisa quem JÁ conversou com a clínica (primeiro contato não envia nem cria conversa)', async () => {
  await limpar();
  assert.match((await one(`select column_default from information_schema.columns where table_name = 'fila_config' and column_name = 'wpp_somente_conhecidos'`)).column_default, /true/, 'o padrão da coluna é o seguro');
  await config('whatsapp_ativo = true, wpp_somente_conhecidos = true');
  const a = await servico('A');
  const desconhecido = await emitir({ servico: a, telefone: '41911112222' });
  assert.equal((await one('select count(*)::int n from public.atendimento_outbox')).n, 0, 'sem conversa prévia: nada é enfileirado');
  assert.equal((await one('select count(*)::int n from public.atendimento_conversas')).n, 0, 'e nenhuma conversa é criada à toa');
  assert.equal((await one('select avisos from public.fila_itens where id = $1', [desconhecido.id])).avisos.emissao, undefined);

  await db.exec(`insert into public.atendimento_conversas (session_id, nome_contato, ultima_mensagem_em) values ('5541933334444@s.whatsapp.net', 'Já conversou', now())`);
  const conhecido = await emitir({ servico: a, telefone: '41933334444' });
  const o = await one(`select session_id from public.atendimento_outbox where dedupe_key = 'fila:${conhecido.id}:emissao'`);
  assert.equal(o.session_id, '5541933334444@s.whatsapp.net');

  await config('wpp_somente_conhecidos = false');
  const novo = await emitir({ servico: a, telefone: '41955556666' });
  assert.equal((await one(`select count(*)::int n from public.atendimento_outbox where dedupe_key = 'fila:${novo.id}:emissao'`)).n, 1, 'com a opção desligada, primeiro contato envia');
  assert.equal((await one(`select count(*)::int n from public.atendimento_conversas where session_id = '5541955556666@s.whatsapp.net'`)).n, 1);
  await config('whatsapp_ativo = false, wpp_somente_conhecidos = true');
});

await caso('WhatsApp: antiabuso (3 confirmações/hora por telefone) e "ausente" só se a clínica ligar', async () => {
  await limpar();
  await config(`whatsapp_ativo = true, wpp_somente_conhecidos = false, wpp_avisar_ausente = false`);
  const a = await servico('A');
  const itens = [];
  for (let i = 0; i < 4; i++) itens.push(await emitir({ servico: a, telefone: '41999991111' }));
  assert.equal((await one(`select count(*)::int n from public.atendimento_outbox where dedupe_key like '%:emissao'`)).n, 3);
  await acao(itens[0].id, 'ausente');
  assert.equal((await one(`select count(*)::int n from public.atendimento_outbox where dedupe_key like '%:ausente'`)).n, 0);
  await config('wpp_avisar_ausente = true');
  await acao(itens[1].id, 'ausente');
  assert.equal((await one(`select count(*)::int n from public.atendimento_outbox where dedupe_key like '%:ausente'`)).n, 1);
});

await caso('WhatsApp: falha na outbox NÃO impede emitir nem chamar senha', async () => {
  await limpar();
  await config('whatsapp_ativo = true, wpp_somente_conhecidos = false');
  await db.exec(`create function public.quebra() returns trigger language plpgsql as $$ begin raise exception 'outbox fora do ar'; end $$;
    create trigger outbox_quebrada before insert on public.atendimento_outbox for each row execute function public.quebra()`);
  try {
    const a = await servico('A');
    const it = await emitir({ servico: a, telefone: '41999992222' });
    assert.ok(it.senha);
    assert.equal((await acao(it.id, 'chamar')).status, 'chamado');
    assert.equal((await one('select count(*)::int n from public.atendimento_outbox')).n, 0);
  } finally {
    await db.exec(`drop trigger outbox_quebrada on public.atendimento_outbox; drop function public.quebra()`);
  }
});

await caso('WhatsApp: texto sem variável desconhecida sobrando e modelos editáveis', async () => {
  await limpar();
  await config(`whatsapp_ativo = true, wpp_somente_conhecidos = false, wpp_msg_emissao = 'Oi {{tutor}}, {{senha}} {{inexistente}} fim'`);
  const a = await servico('A');
  const it = await emitir({ servico: a, tutor: 'Zé Carlos', telefone: '41999993333' });
  const texto = (await one(`select conteudo from public.atendimento_outbox where dedupe_key = 'fila:${it.id}:emissao'`)).conteudo;
  assert.equal(texto, 'Oi Zé, A001  fim', 'a variável desconhecida some; as conhecidas são trocadas');
  await comoAdmin(() => esperaErro(() => db.exec(`update public.fila_config set wpp_msg_emissao = ''`), 'check'));
  await config(`wpp_msg_emissao = 'Olá, {{tutor}}! Sua senha na {{clinica}} é *{{senha}}* ({{servico}}). Acompanhe pelo painel da sala de espera. 🐾', whatsapp_ativo = false, wpp_somente_conhecidos = true`);
});

await caso('totem: emite senha, mas origem/vínculos são forçados e o telefone só vale se a clínica pedir', async () => {
  await limpar();
  const a = await servico('A');
  const s1 = await sala('Sala 01');
  const r = await comoTotem(() =>
    one(`select * from public.adicionar_item_fila(p_servico_id => $1, p_tutor_nome => 'Visitante', p_pet_nome => 'Rex',
          p_veterinario_nome => 'Dr. X', p_sala_id => $2, p_cliente_id => 1, p_origem => 'agenda', p_telefone => '41999994444')`, [a, s1]),
  );
  assert.equal(r.origem, 'totem');
  assert.deepEqual([r.sala_id, r.cliente_id, r.veterinario_nome, r.telefone], [null, null, null, null]);
  await config('totem_pede_telefone = true');
  const r2 = await comoTotem(() => one(`select * from public.adicionar_item_fila(p_servico_id => $1, p_tutor_nome => 'V2', p_telefone => '41999994444')`, [a]));
  assert.equal(r2.telefone, '5541999994444');
  await config('totem_pede_telefone = false');
});

await caso('totem: não opera a fila, não lê dados de ninguém e não passa pelas outras tabelas', async () => {
  const a = await servico('A');
  const s1 = await sala('Sala 01');
  const it = await emitir({ servico: a });
  await comoTotem(async () => {
    await esperaErro(() => one(`select * from public.alterar_status_fila('${it.id}', 'cancelar') r`), 'Não autorizado');
    await esperaErro(() => one(`select public.sala_obter_fila() r`), 'Não autorizado');
    await esperaErro(() => one(`select * from public.sala_chamar_fila('${s1}') r`), 'Não autorizado');
    // A trava é restritiva: as tabelas seguem com RLS "qualquer autenticado lê", mas o totem vê 0 linhas.
    assert.equal((await q('select * from public.fila_itens')).length, 0);
    assert.equal((await q('select * from public.fila_chamadas')).length, 0);
    assert.equal((await q('select * from public.dados_cliente')).length, 0);
    assert.equal((await q('select * from public.fila_midias')).length, 0);
    // O que o totem precisa para funcionar:
    assert.ok((await q('select * from public.fila_servicos where ativo')).length >= 4);
    assert.equal((await q('select * from public.fila_config')).length, 1);
    assert.equal((await q('select * from public.profiles where id = auth.uid()')).length, 1);
  });
  // A mesma consulta, feita por quem é da equipe, enxerga.
  assert.equal((await comoAtendente(() => q('select * from public.dados_cliente'))).length, 1);
  assert.ok((await comoAtendente(() => q('select * from public.fila_itens'))).length >= 1);
});

await caso('totem DESATIVADO continua sem acesso a nada (aparelho perdido e desligado depois)', async () => {
  await db.exec(`update public.profiles set ativo = false where id = '${TOTEM}'`);
  try {
    await comoTotem(async () => {
      assert.equal((await q('select * from public.dados_cliente')).length, 0, 'a trava não depende do perfil estar ativo');
      assert.equal((await q('select * from public.fila_itens')).length, 0);
      const a = await servico('A');
      await esperaErro(() => one(`select * from public.adicionar_item_fila(p_servico_id => $1, p_tutor_nome => 'X')`, [a]), 'Não autorizado');
    });
  } finally {
    await db.exec(`update public.profiles set ativo = true where id = '${TOTEM}'`);
  }
});

await caso('totem: limite de 30 senhas em 5 minutos', async () => {
  await limpar();
  const a = await servico('A');
  for (let i = 0; i < 30; i++) await comoTotem(() => one(`select * from public.adicionar_item_fila(p_servico_id => $1, p_tutor_nome => 'V')`, [a]));
  await comoTotem(() => esperaErro(() => one(`select * from public.adicionar_item_fila(p_servico_id => $1, p_tutor_nome => 'V')`, [a]), 'Muitas senhas'));
});

await caso('INSERT direto em fila_itens foi fechado (só o RPC cria senha)', async () => {
  const a = await servico('A');
  await comoAtendente(() =>
    esperaErro(() => db.exec(`insert into public.fila_itens (senha, servico_id, tutor_nome, criado_por) values ('Z999', '${a}', 'X', '${ATENDENTE}')`), 'permission denied'),
  );
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.fila_itens (senha, servico_id, tutor_nome) values ('Z998', '${a}', 'X')`), 'permission denied'));
});

await caso('a trava do totem é reaplicável e cobre tabela criada depois', async () => {
  assert.equal((await one('select public.fila_travar_totem() n')).n, 0);
  await db.exec(`create table public.tabela_nova (id int primary key, segredo text); alter table public.tabela_nova enable row level security;
    create policy "todos leem" on public.tabela_nova for select to authenticated using (true);
    insert into public.tabela_nova values (1, 'x')`);
  assert.equal((await comoTotem(() => q('select * from public.tabela_nova'))).length, 1, 'ainda sem a trava: é o aviso para rodar de novo');
  assert.equal((await one('select public.fila_travar_totem() n')).n, 1);
  assert.equal((await comoTotem(() => q('select * from public.tabela_nova'))).length, 0);
  assert.equal((await comoAtendente(() => q('select * from public.tabela_nova'))).length, 1);
});

await caso('Storage: o totem fica de fora de TODOS os buckets (ex.: mídias privadas das conversas), a equipe segue igual', async () => {
  await db.exec(`create policy "conversa-midias leitura autenticada" on storage.objects for select to authenticated using (bucket_id = 'conversa-midias');
    create policy "conversa-midias escrita autenticada" on storage.objects for insert to authenticated with check (bucket_id = 'conversa-midias');
    insert into storage.objects (bucket_id, name) values ('conversa-midias', 'laudo-do-cliente.pdf')`);
  assert.equal((await comoAtendente(() => q(`select * from storage.objects where bucket_id = 'conversa-midias'`))).length, 1);
  await comoAtendente(() => db.exec(`insert into storage.objects (bucket_id, name) values ('conversa-midias', 'novo.pdf')`));
  await comoTotem(async () => {
    assert.equal((await q(`select * from storage.objects where bucket_id = 'conversa-midias'`)).length, 0, 'o totem não lista');
    await esperaErro(() => db.exec(`insert into storage.objects (bucket_id, name) values ('conversa-midias', 'x.pdf')`), 'row-level security');
  });
  await db.exec(`update public.profiles set ativo = false where id = '${TOTEM}'`);
  try {
    assert.equal((await comoTotem(() => q(`select * from storage.objects`))).length, 0, 'nem com o perfil desativado');
  } finally {
    await db.exec(`update public.profiles set ativo = true where id = '${TOTEM}'`);
  }
});

await caso('auditoria do totem aponta função sem guarda, view que ignora a RLS e tabela sem RLS (e não acusa o que é da fila)', async () => {
  await db.exec(`create function public.exposta_sem_guarda() returns int language sql security definer as $$ select 1 $$;
    create function public.exposta_com_guarda() returns int language sql security definer as $$ select case when public.perfil_papel() is not null then 1 end $$;
    create view public.vw_aberta as select * from public.dados_cliente;
    create view public.vw_segura with (security_invoker = on) as select * from public.dados_cliente;
    create table public.sem_rls (id int)`);
  const achados = await q('select tipo, objeto from public.fila_auditar_totem()');
  const objetos = achados.map((a) => `${a.tipo}:${a.objeto}`);
  assert.ok(objetos.includes('funcao:public.exposta_sem_guarda()'));
  assert.ok(objetos.includes('view:public.vw_aberta'));
  assert.ok(objetos.includes('tabela_sem_rls:public.sem_rls'));
  assert.ok(!objetos.includes('funcao:public.exposta_com_guarda()'), 'função com checagem de papel não é acusada');
  assert.ok(!objetos.includes('view:public.vw_segura'), 'view com security_invoker não é acusada');
  assert.ok(!achados.some((a) => /adicionar_item_fila|alterar_status_fila|sala_chamar_fila|sala_obter_fila|fila_tv_painel/.test(a.objeto)), 'as funções da fila estão protegidas');
  await como('', () => esperaErro(() => q('select * from public.fila_auditar_totem()'), 'permission denied'), 'anon');
  await comoAtendente(() => esperaErro(() => q('select * from public.fila_auditar_totem()'), 'permission denied'));
  await db.exec(`drop view public.vw_aberta; drop view public.vw_segura; drop table public.sem_rls; drop function public.exposta_sem_guarda(); drop function public.exposta_com_guarda()`);
});

// Só roda quando a skill aponta para os scripts SQL de apoio (FILA_SCRIPTS_DIR=assets/banco).
if (process.env.FILA_SCRIPTS_DIR) {
  await caso('scripts de diagnóstico, verificação e freio de mão executam e dão o resultado esperado', async () => {
    const sql = (nome) => fs.readFileSync(path.join(process.env.FILA_SCRIPTS_DIR, nome), 'utf8');

    const verificacao = await db.exec(sql('99_verificacao.sql'));
    const linhas = (i) => verificacao[i].rows;
    assert.deepEqual(linhas(0).map((r) => [r.proname, Number(r.assinaturas)]), [['adicionar_item_fila', 1], ['alterar_status_fila', 1]]);
    const execucao = Object.fromEntries(linhas(1).map((r) => [r.proname, [r.anon, r.authenticated]]));
    assert.deepEqual(
      Object.keys(execucao).filter((f) => execucao[f][0]).sort(),
      ['fila_tv_estado', 'fila_tv_painel'],
      'anon só executa a leitura da TV',
    );
    for (const interna of ['fila_itens_avisos', 'fila_tv_tick', 'fila_wpp_texto', 'fila_enfileirar_whatsapp', 'fila_travar_totem', 'fila_normalizar_telefone']) {
      assert.deepEqual(execucao[interna], [false, false], `${interna} é interna`);
    }
    assert.ok(linhas(2).every((r) => r.anon_le === false), 'anon não lê tabela da fila');
    assert.equal(linhas(3)[0].insert_direto, false);
    assert.deepEqual(linhas(4), [], 'todas as tabelas com RLS têm a trava do totem');
    assert.equal(linhas(5).length, 1, 'o storage também tem a trava do totem');
    assert.ok(Array.isArray(linhas(6)), 'a auditoria do totem executa');
    assert.equal(linhas(8).length, 1, 'índice (ciclo, senha)');
    assert.equal(linhas(9).length, 0, 'sem a senha única para sempre');
    assert.equal(linhas(10)[0].public, true);
    assert.equal(linhas(11)[0].whatsapp_ativo, false);
    assert.deepEqual(linhas(12), []);

    const diagnostico = await db.exec(sql('00_diagnostico.sql'));
    const existe = Object.fromEntries(diagnostico[0].rows.map((r) => [r.objeto, r.existe]));
    assert.equal(existe['tabela fila_itens'], true);
    assert.equal(existe['tabela fila_config (v2 já aplicada?)'], true);
    assert.equal(existe['tabela atendimento_outbox (avisos por WhatsApp)'], true);
    assert.ok(diagnostico.length >= 8, 'os blocos 5a, 5b, 5c e 6 do diagnóstico executam');

    // Freio de mão: liga, enfileira, aciona o freio e confere.
    await limpar();
    await config('whatsapp_ativo = true, wpp_somente_conhecidos = false');
    const a = await servico('A');
    await emitir({ servico: a, telefone: '41999995555' });
    assert.equal((await one(`select count(*)::int n from public.atendimento_outbox where estado = 'pending'`)).n, 1);
    await db.exec(sql('98_desligar_avisos.sql'));
    assert.equal((await one('select whatsapp_ativo from public.fila_config')).whatsapp_ativo, false);
    assert.equal((await one(`select count(*)::int n from public.atendimento_outbox where estado = 'pending'`)).n, 0);
    assert.equal((await one(`select ultimo_erro_codigo from public.atendimento_outbox`)).ultimo_erro_codigo, 'cancelado_fila');
  });
}

await caso('veterinário opera o chamador mas não altera configuração', async () => {
  await limpar();
  const a = await servico('A');
  const s1 = await sala('Sala 01');
  const it = await emitir({ servico: a });
  const chamado = await comoVet(() => one('select * from public.sala_chamar_fila($1) r', [s1]));
  assert.equal(chamado.id, it.id);
  await comoVet(async () => {
    assert.equal((await one(`with u as (update public.fila_config set cor_marca = '#000000' returning 1) select count(*)::int n from u`)).n, 0);
  });
});

console.log('\nAtualização de um dashboard que já tem senhas emitidas');

await caso('senhas antigas ganham o ciclo do dia certo (no fuso da clínica), a senha deixa de ser única para sempre e as chamadas antigas do front seguem valendo', async () => {
  const velho = await criarBanco(BASE_ANTIGA);
  const f = ferramentas(velho);
  await f.como(ATENDENTE, async () => {
    const a = (await f.one(`select id from public.fila_servicos where prefixo = 'A'`)).id;
    // Assinatura ANTIGA (9 parâmetros nomeados), exatamente como o front enviava.
    for (const t of ['Um', 'Dois', 'Três']) {
      await f.one(`select * from public.adicionar_item_fila(p_servico_id => $1, p_tutor_nome => $2, p_pet_nome => null,
        p_veterinario_nome => null, p_prioridade => 'normal', p_cliente_id => null, p_pet_id => null, p_motivo_resumido => null, p_sala_id => null)`, [a, t]);
    }
  });
  await velho.exec(`update public.fila_itens set chegada_em = '2026-10-23T12:00:00Z' where tutor_nome = 'Um';
                    update public.fila_itens set chegada_em = '2026-10-24T12:00:00Z' where tutor_nome = 'Dois';
                    update public.fila_itens set chegada_em = '2026-10-25T02:30:00Z' where tutor_nome = 'Três'`);

  await velho.exec(ler(V2));
  const itens = await f.q(`select tutor_nome, senha, ciclo, origem, avisos from public.fila_itens order by senha`);
  assert.deepEqual(itens.map((i) => i.ciclo), ['2026-10-23', '2026-10-24', '2026-10-24'], '02:30Z é 23:30 do dia 24 em São Paulo');
  assert.ok(itens.every((i) => i.origem === 'balcao' && Object.keys(i.avisos).length === 0));

  // A senha única global caiu: o mesmo texto pode existir em outro ciclo.
  const a = (await f.one(`select id from public.fila_servicos where prefixo = 'A'`)).id;
  await velho.exec(`insert into public.fila_itens (senha, ciclo, servico_id, tutor_nome) values ('A001', '2030-01-01', '${a}', 'Futuro')`);

  // Mesma chamada do front antigo (5 parâmetros) continua funcionando na assinatura nova.
  const nova = await f.como(ATENDENTE, () =>
    f.one(`select * from public.adicionar_item_fila(p_servico_id => $1, p_tutor_nome => 'Compat', p_pet_nome => null, p_veterinario_nome => null, p_prioridade => 'normal')`, [a]));
  assert.equal(nova.senha, 'A004', 'as três antigas ainda estão ativas, então o número segue');
  assert.equal((await f.one(`select count(*)::int n from pg_proc where proname = 'adicionar_item_fila'`)).n, 1, 'uma única assinatura (sem sobrecarga)');
  // E o front antigo, que lia a TV por fila_tv_estado(), continua com as mesmas colunas.
  const tv = await f.como('', () => f.q('select * from public.fila_tv_estado()'), 'anon');
  assert.deepEqual(Object.keys(tv[0]), ['senha', 'pet_nome', 'veterinario_nome', 'sala', 'status', 'chamado_em']);
});

resumo();
