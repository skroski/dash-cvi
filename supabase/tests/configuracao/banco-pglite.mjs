// Testa a migração 20261026100000 (configuração agnóstica) num Postgres embutido
// (PGlite) com stubs do Supabase, com a semente da Clínica VetBots aplicada por cima.
// Nenhum banco real é tocado.
//
//   npm --prefix /tmp/pglite install @electric-sql/pglite@0.2.17
//   PGLITE_PATH=/tmp/pglite/node_modules/@electric-sql/pglite/dist/index.js \
//     node --experimental-strip-types supabase/tests/configuracao/banco-pglite.mjs
import assert from 'node:assert/strict';

const ler = (nome) => lerArquivo(`migrations/${nome}`);

import { criarBanco, ferramentas, ler as lerArquivo } from '../clinica/harness.mjs';
const db = await criarBanco();
await db.exec(lerArquivo('seeds/clinica-vetbots.sql'));
const sqlMigracao = ler('20261026100000_configuracao_atendimento_agnostica.sql');
const { q, one, como, esperaErro, comoAdmin, comoAtendente } = ferramentas(db);
const ADMIN = '11111111-1111-1111-1111-111111111111';
let ok = 0;
let falhas = 0;
async function caso(nome, fn) {
  try { await fn(); ok++; console.log('  ✓', nome); } catch (e) { falhas++; console.log('  ✗', nome, '\n     ', e.message); }
}

console.log('Migração de configuração agnóstica');

await caso('é idempotente (reaplicar não duplica nem falha)', async () => {
  await db.exec(sqlMigracao);
  assert.equal((await one('select count(*)::int n from public.atendimento_estados')).n, 3);
  assert.equal((await one('select count(*)::int n from public.notificacao_destinatarios')).n, 2);
  assert.equal((await one('select count(*)::int n from public.atendimento_config')).n, 1);
});

await caso('sementes reproduzem o fluxo n8n (humano, finalizado, 2 destinatários)', async () => {
  const estados = await q('select chave, deteccao, pausar_bot, pausa_horas, notificar, frase_gatilho from public.atendimento_estados order by ordem');
  assert.deepEqual(estados.map((e) => e.chave), ['em_andamento', 'atendimento_humano', 'finalizado']);
  assert.equal(estados[1].pausa_horas, 8);
  assert.equal(estados[1].deteccao, 'mensagem_cliente');
  assert.equal(estados[2].frase_gatilho, '{{frase_encerramento}}'); // a frase vem da configuração da empresa
  const tels = (await q('select telefone from public.notificacao_destinatarios order by telefone')).map((r) => r.telefone);
  assert.deepEqual(tels, ['554199861335', '554199865410']);
});

await caso('aliases do antigo mapa fixo foram migrados para os tipos', async () => {
  const a = await one(`select aliases from public.agenda_especialidades where chave = 'gastroenterologia'`);
  assert.deepEqual(a.aliases, ['gastro', 'gastroenterologista']);
});

await caso('RLS: atendente e anon não leem nem escrevem configuração', async () => {
  for (const tabela of ['atendimento_config', 'atendimento_estados', 'notificacao_destinatarios', 'agenda_modelos']) {
    const linhas = await comoAtendente(() => q(`select * from public.${tabela}`));
    assert.equal(linhas.length, 0, `${tabela} visível para atendente`);
  }
  await comoAtendente(() => db.exec(`update public.notificacao_destinatarios set ativo = false`));
  await comoAtendente(() => db.exec(`delete from public.atendimento_estados`));
  assert.equal((await one(`select count(*)::int n from public.notificacao_destinatarios where ativo`)).n, 2, 'atendente alterou destinatários');
  assert.equal((await one(`select count(*)::int n from public.atendimento_estados`)).n, 3, 'atendente apagou estados');
  await como('', () => esperaErro(() => q('select * from public.atendimento_estados'), 'permission denied'), 'anon');
});

await caso('admin cadastra destinatário; telefone é normalizado e validado', async () => {
  await comoAdmin(() => db.exec(`insert into public.notificacao_destinatarios (nome, telefone, eventos) values ('Recepção', '(41) 99999-0000 ', array['finalizado'])`));
  const r = await one(`select telefone from public.notificacao_destinatarios where nome = 'Recepção'`);
  assert.equal(r.telefone, '41999990000'); // só dígitos; o código do país é acrescentado pela tela/worker
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.notificacao_destinatarios (nome, telefone, eventos) values ('Ruim', '123', array['finalizado'])`), 'telefone'));
});

await caso('evento desconhecido é recusado; evento de estado novo passa a valer', async () => {
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.notificacao_destinatarios (nome, telefone, eventos) values ('X', '5541911112222', array['inexistente'])`), 'Evento de notificação desconhecido'));
  await comoAdmin(() => db.exec(`insert into public.atendimento_estados (chave, nome, deteccao, criterios, notificar) values ('reclamacao', 'Reclamação', 'mensagem_cliente', 'cliente reclamando', true)`));
  await comoAdmin(() => db.exec(`insert into public.notificacao_destinatarios (nome, telefone, eventos) values ('Gerente', '5541911112222', array['reclamacao','agendamento_criado'])`));
});

await caso('escopo exige o alvo correspondente', async () => {
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.notificacao_destinatarios (nome, telefone, eventos, escopo) values ('P', '5541911113333', array['finalizado'], 'profissional')`)));
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.notificacao_destinatarios (nome, telefone, eventos, escopo) values ('U', '5541911113333', array['finalizado'], 'unidade')`)));
});

await caso('estados: um só padrão ativo; critérios/frase obrigatórios; fábrica não é apagada', async () => {
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.atendimento_estados (chave, nome, deteccao) values ('outro_padrao', 'Outro', 'padrao')`)));
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.atendimento_estados (chave, nome, deteccao) values ('sem_criterio', 'Sem', 'mensagem_cliente')`)));
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.atendimento_estados (chave, nome, deteccao) values ('sem_frase', 'Sem', 'resposta_assistente')`)));
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.atendimento_estados (chave, nome, deteccao, pausar_bot) values ('pausa_sem_horas', 'P', 'manual', true)`)));
  await comoAdmin(() => esperaErro(() => db.exec(`delete from public.atendimento_estados where chave = 'finalizado'`), 'Estados de fábrica'));
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.atendimento_estados (chave, nome, deteccao) values ('Chave Ruim', 'X', 'manual')`)));
  await comoAdmin(() => db.exec(`delete from public.atendimento_estados where chave = 'reclamacao'`));
});

await caso('tipo a partir de modelo: cria com aliases/campos, é idempotente, só admin', async () => {
  const id = await comoAdmin(() => one(`select public.agenda_aplicar_modelo_tipo('tipo-ultrassonografia') id`));
  const t = await one(`select * from public.agenda_especialidades where id = $1`, [id.id]);
  assert.equal(t.chave, 'ultrassonografia');
  assert.deepEqual(t.aliases, ['ultrassom', 'ultra']);
  assert.deepEqual(t.campos_obrigatorios, ['email']);
  const de_novo = await comoAdmin(() => one(`select public.agenda_aplicar_modelo_tipo('tipo-ultrassonografia') id`));
  assert.equal(de_novo.id, id.id);
  await comoAtendente(() => esperaErro(() => q(`select public.agenda_aplicar_modelo_tipo('tipo-retorno')`), 'forbidden'));
});

await caso('novo veterinário reutiliza tipo + modelo de jornada; agenda nasce desativada', async () => {
  const prof = await comoAdmin(() => one(`insert into public.agenda_profissionais (nome, unidade) values ('Dr. Novo', 'Asa Sul') returning id`));
  const tipo = await one(`select id from public.agenda_especialidades where chave = 'consultaveterinaria'`);
  const regra = await comoAdmin(() => one(`select public.agenda_criar_regra_de_modelo('agenda-seg-sex-comercial', $1, $2, null) id`, [prof.id, tipo.id]));
  const r = await one(`select ativo from public.agenda_regras where id = $1`, [regra.id]);
  assert.equal(r.ativo, false);
  assert.equal((await one(`select count(*)::int n from public.agenda_janelas_semanais where regra_id = $1`, [regra.id])).n, 5);
  assert.equal((await one(`select count(*)::int n from public.agenda_intervalos where regra_id = $1 and tipo = 'almoco'`, [regra.id])).n, 5);
  await comoAdmin(() => esperaErro(() => q(`select public.agenda_criar_regra_de_modelo('agenda-seg-sex-comercial', $1, $2, null)`, [prof.id, tipo.id]), 'já tem uma agenda'));
  // dois profissionais agora atendem o mesmo tipo: a unicidade é por (profissional, tipo)
  assert.equal((await one(`select count(*)::int n from public.agenda_regras where especialidade_id = $1`, [tipo.id])).n, 2);
});

await caso('duplicar agenda copia sobrescritas, jornada e intervalos para outro profissional', async () => {
  const origem = await one(`select r.id from public.agenda_regras r join public.agenda_especialidades e on e.id = r.especialidade_id where e.chave = 'oncologia'`);
  await comoAdmin(() => db.exec(`update public.agenda_regras set duracao_padrao_minutos = 45, instrucoes_prompt = 'Levar exames' where id = '${origem.id}'`));
  await comoAdmin(() => db.exec(`insert into public.agenda_intervalos (regra_id, tipo, dia_semana, inicio, fim) values ('${origem.id}', 'almoco', 1, '12:00', '13:00')`));
  const prof = await comoAdmin(() => one(`insert into public.agenda_profissionais (nome) values ('Dr. Clone') returning id`));
  const nova = await comoAdmin(() => one(`select public.agenda_duplicar_regra($1, $2, null) id`, [origem.id, prof.id]));
  const r = await one(`select ativo, duracao_padrao_minutos, instrucoes_prompt from public.agenda_regras where id = $1`, [nova.id]);
  assert.deepEqual(r, { ativo: false, duracao_padrao_minutos: 45, instrucoes_prompt: 'Levar exames' });
  const orig = (await one(`select count(*)::int n from public.agenda_janelas_semanais where regra_id = $1`, [origem.id])).n;
  assert.equal((await one(`select count(*)::int n from public.agenda_janelas_semanais where regra_id = $1`, [nova.id])).n, orig);
  assert.equal((await one(`select count(*)::int n from public.agenda_intervalos where regra_id = $1`, [nova.id])).n, 1);
});

await caso('sobrescritas da agenda são validadas', async () => {
  await comoAdmin(() => esperaErro(() => db.exec(`update public.agenda_regras set duracao_padrao_minutos = 1`)));
  await comoAdmin(() => esperaErro(() => db.exec(`update public.agenda_regras set operacoes_permitidas = array['apagar_tudo']`)));
  await comoAdmin(() => esperaErro(() => db.exec(`update public.agenda_especialidades set campos_obrigatorios = array['cpf']`)));
});

await caso('calendário: ID vai para o Vault, volta só para service_role', async () => {
  const cal = await comoAdmin(() => one(`select public.agenda_salvar_calendario('Dr. Novo', 'abc@group.calendar.google.com') id`));
  const interno = await como('', () => one(`select public.agenda_calendario_id_interno($1) v`, [cal.id]), 'service_role');
  assert.equal(interno.v, 'abc@group.calendar.google.com');
  await comoAdmin(() => esperaErro(() => q(`select public.agenda_calendario_id_interno($1)`, [cal.id]), 'permission denied'));
  const linhaCal = await one(`select secret_key from public.agenda_calendarios where id = $1`, [cal.id]);
  assert.match(linhaCal.secret_key, /^GOOGLE_CALENDAR_[A-F0-9]{12}$/);
  const status = await comoAdmin(() => q('select * from public.agenda_status_calendarios()'));
  assert.equal(status.find((s) => s.id === cal.id).origem, 'painel');
  assert.equal(status.find((s) => s.nome === 'Dra. Carol — Clínica e Oncologia').origem, 'secret_do_ambiente');
  await comoAtendente(() => esperaErro(() => q(`select public.agenda_salvar_calendario('X', 'y')`), 'forbidden'));
  await comoAdmin(() => esperaErro(() => q(`select public.agenda_salvar_calendario('X', 'com espaço')`), 'inválido'));
  // trocar o ID atualiza em vez de duplicar
  await comoAdmin(() => db.exec(`select public.agenda_salvar_calendario('Dr. Novo', 'novo@group.calendar.google.com', '${cal.id}')`));
  assert.equal((await one(`select count(*)::int n from vault.secrets where name = 'agenda_calendario_${cal.id}'`)).n, 1);
});

await caso('prompt compilado mantém os marcadores {{...}} (resolvidos a cada mensagem, não ao salvar)', async () => {
  await db.exec(`insert into public.prompt_regras (codigo, titulo, categoria, conteudo) values ('r1', 'Identidade', 'comportamento', 'Você atende pela {{nome_empresa}} como {{nome_assistente}}. Fone {{telefone_contato}}.')`);
  await comoAdmin(() => db.exec(`update public.atendimento_config set nome_empresa = 'Clínica Exemplo', nome_assistente = 'Luna', telefone_contato = '(11) 1111-1111'`));
  const p = await comoAdmin(() => one('select prompt_completo from public.obter_prompt_compilado()'));
  assert.match(p.prompt_completo, /Você atende pela \{\{nome_empresa\}\} como \{\{nome_assistente\}\}\. Fone \{\{telefone_contato\}\}\./);
  assert.match(p.prompt_completo, /^# Assistente Virtual de \{\{nome_empresa\}\}/);
  assert.doesNotMatch(p.prompt_completo, /Clínica Exemplo|Luna/); // dados atuais entram só na renderização
});

await caso('alterações de configuração são auditadas', async () => {
  const n = await one(`select count(*)::int n from public.agenda_config_auditoria where tabela in ('atendimento_estados','notificacao_destinatarios','atendimento_config')`);
  assert.ok(n.n >= 3, `auditoria vazia (${n.n})`);
  const a = await one(`select autor_id from public.agenda_config_auditoria where tabela = 'atendimento_config' and operacao = 'UPDATE' order by id desc limit 1`);
  assert.equal(a.autor_id, ADMIN);
});

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
