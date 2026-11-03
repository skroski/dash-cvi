// Migrações NEUTRAS (nenhum dado de clínica) + semente da Clínica VetBots aplicada por cima.
//   PGLITE_PATH=/tmp/pglite/node_modules/@electric-sql/pglite/dist/index.js \
//     node --experimental-strip-types supabase/tests/clinica/banco-pglite.mjs
import { ADMIN, ATENDENTE, ler, criarBanco, ferramentas } from './harness.mjs';
import { VARIAVEIS, ALIASES_VARIAVEIS, renderizarPrompt } from '../../functions/_shared/prompt_variaveis.ts';
import { montarCatalogo, parametrosEfetivos } from '../../functions/_shared/agenda_catalogo.ts';
import { textoHorariosTipo } from '../../functions/_shared/horarios_texto.ts';

const db = await criarBanco();
const { q, one, esperaErro, caso, assert, comoAdmin, comoAtendente, comoLider, como, resumo } = ferramentas(db);

console.log('Instalação neutra (sem seeds)');

await caso('nenhum dado de cliente nas tabelas de configuração', async () => {
  const cfg = await one('select * from public.atendimento_config');
  assert.equal(cfg.nome_empresa, 'Minha empresa');
  assert.equal(cfg.telefone_contato, null);
  for (const [tabela, esperado] of Object.entries({
    notificacao_destinatarios: 0, agenda_calendarios: 0, agenda_profissionais: 0, agenda_especialidades: 0,
    agenda_regras: 0, clinica_servicos: 0, agenda_feriados: 0, agenda_agendamentos: 0,
  })) {
    assert.equal((await one(`select count(*)::int n from public.${tabela}`)).n, esperado, tabela);
  }
  const estados = await q('select chave, frase_gatilho from public.atendimento_estados order by ordem');
  assert.deepEqual(estados.map((e) => e.chave), ['em_andamento', 'atendimento_humano', 'finalizado']);
  assert.equal(estados[2].frase_gatilho, '{{frase_encerramento}}');
});

await caso('o prompt compilado e as regras iniciais não citam nenhuma clínica (aceite de "qualquer clínica")', async () => {
  const { prompt_completo: texto } = await one('select * from public.obter_prompt_compilado()');
  for (const proibido of [/Galv/i, /Maia/i, /Balthazar/i, /Amparo/i, /4141/, /\bn8n\b/i, /\$now/, /Redis/i]) {
    assert.doesNotMatch(texto, proibido, String(proibido));
  }
  const regras = await q('select codigo, padrao from public.prompt_regras');
  assert.equal(regras.length, 18);
  assert.ok(regras.every((r) => r.padrao));
  const versao = await one('select count(*)::int n, max(versao) v from public.meu_prompt_versoes');
  assert.equal(versao.n, 1);
  const ultima = await one('select conteudo from public.meu_prompt_versoes order by versao desc limit 1');
  assert.equal(ultima.conteudo, texto);
});

await caso('o modelo salvo só tem variáveis conhecidas e mantém os marcadores (resolvidos a cada mensagem)', async () => {
  const { conteudo } = await one('select conteudo from public.meu_prompt_versoes order by versao desc limit 1');
  assert.deepEqual((await one(`select public.prompt_marcadores_invalidos($1) m`, [conteudo])).m, []);
  for (const marcador of ['{{nome_empresa}}', '{{data_hoje_extenso}}', '{{hora_atual}}', '{{cliente_nome}}', '{{saudacao}}', '{{catalogo_servicos}}', '{{frase_encerramento}}']) {
    assert.ok(conteudo.includes(marcador), marcador);
  }
});

await caso('validação de variáveis: expressões do n8n e nomes desconhecidos são recusados; aliases e parâmetros passam', async () => {
  const inserir = (conteudo) => comoAdmin(() => db.exec(`insert into public.prompt_regras (codigo, titulo, categoria, conteudo) values ('t_${Math.random().toString(36).slice(2, 8)}', 'T', 'personalizadas', $x$${conteudo}$x$)`));
  await esperaErro(() => inserir('Hoje é {{ $now.format("dd/MM") }}'), 'Variáveis desconhecidas');
  await esperaErro(() => inserir('Olá {{nome_do_gato}}'), 'Variáveis desconhecidas');
  await esperaErro(() => inserir('{{nome_empresa:x}}'), 'Variáveis desconhecidas'); // parâmetro onde não cabe
  await esperaErro(() => inserir('{{preco}}'), 'Variáveis desconhecidas'); // falta o parâmetro
  await inserir('{{nome_clinica}} {{preco:consulta}} {{servico:x}} {{horarios:consulta}} {{ nome_empresa }}');
  await comoAdmin(() => db.exec(`delete from public.prompt_regras where codigo like 't\\_%'`));
});

await caso('registro de variáveis do banco == registro do código (paridade)', async () => {
  const linhas = await q('select nome, parametro, alias_de from public.prompt_variaveis');
  const doBanco = new Map(linhas.filter((l) => !l.alias_de).map((l) => [l.nome, l.parametro ?? null]));
  const doCodigo = new Map(VARIAVEIS.map((v) => [v.nome, v.parametro ?? null]));
  assert.deepEqual([...doBanco].sort(), [...doCodigo].sort());
  const aliasesBanco = Object.fromEntries(linhas.filter((l) => l.alias_de).map((l) => [l.nome, l.alias_de]));
  assert.deepEqual(aliasesBanco, ALIASES_VARIAVEIS);
});

await caso('só administradores editam o prompt; versões são compiladas no banco e podem ser revertidas', async () => {
  await comoAtendente(() => esperaErro(() => db.query(`select public.prompt_salvar_versao('x')`), 'forbidden'));
  await comoLider(() => esperaErro(() => db.query(`select public.prompt_salvar_versao('x')`), 'forbidden'));
  await como('', () => esperaErro(() => db.query(`select public.prompt_salvar_versao('x')`), 'permission denied'), 'anon');
  await como('', () => esperaErro(() => db.query(`select * from public.obter_prompt_compilado()`), 'permission denied'), 'anon');

  const v1 = (await comoAdmin(() => one(`select public.prompt_salvar_versao('Primeira edição') v`))).v;
  assert.equal(v1, 2);
  const antes = await one(`select conteudo from public.prompt_regras where codigo = 'coleta_uma_por_vez'`);
  await comoAdmin(() => db.exec(`update public.prompt_regras set conteudo = 'Texto novo da regra {{nome_empresa}}' where codigo = 'coleta_uma_por_vez'`));
  const v2 = (await comoAdmin(() => one(`select public.prompt_salvar_versao(null) v`))).v;
  assert.equal(v2, 3);
  const salva = await one(`select conteudo, autor_nome, descricao, snapshot_regras from public.meu_prompt_versoes where versao = 3`);
  assert.match(salva.conteudo, /Texto novo da regra \{\{nome_empresa\}\}/);
  assert.equal(salva.autor_nome, 'Admin Teste');
  assert.match(salva.descricao, /18 regras ativas/);
  assert.equal(salva.snapshot_regras.length, 18);

  const revertida = (await comoAdmin(() => one(`select public.prompt_reverter_versao(2) v`))).v;
  assert.equal(revertida, 4);
  assert.equal((await one(`select conteudo from public.prompt_regras where codigo = 'coleta_uma_por_vez'`)).conteudo, antes.conteudo);
  assert.equal((await one(`select descricao from public.meu_prompt_versoes where versao = 4`)).descricao, 'Revertido para a versão v2');
  await comoAdmin(() => esperaErro(() => db.query(`select public.prompt_reverter_versao(99)`), 'Versão não encontrada'));
});

await caso('reverter para a v1 desativa (sem apagar) as regras criadas depois, e a próxima publicação não as traz de volta', async () => {
  const v1 = await one('select conteudo, snapshot_regras from public.meu_prompt_versoes where versao = 1');
  const coletaV1 = v1.snapshot_regras.find((r) => r.codigo === 'coleta_uma_por_vez');
  await comoAdmin(() => db.exec(`
    insert into public.prompt_regras (codigo, titulo, categoria, conteudo) values ('regra_pos_v1', 'Regra criada depois da v1', 'informacoes', 'Atenda em nome de {{nome_empresa}}.');
    update public.prompt_regras set conteudo = 'Outra redação {{nome_empresa}}' where codigo = 'coleta_uma_por_vez';`));
  const publicada = (await comoAdmin(() => one(`select public.prompt_salvar_versao('Regra nova depois da v1') v`))).v;
  assert.match((await one('select conteudo from public.meu_prompt_versoes where versao = $1', [publicada])).conteudo, /Regra criada depois da v1/);

  await comoAdmin(() => db.query('select public.prompt_reverter_versao(1)'));
  assert.equal((await one(`select ativa from public.prompt_regras where codigo = 'regra_pos_v1'`))?.ativa, false, 'regra criada depois da v1 fica desativada, mas continua cadastrada');
  assert.equal((await one(`select conteudo from public.prompt_regras where codigo = 'coleta_uma_por_vez'`)).conteudo, coletaV1.conteudo);
  const { prompt_completo: texto, total_regras_ativas: total } = await one('select * from public.obter_prompt_compilado()');
  assert.equal(texto, v1.conteudo, 'o compilado volta a ser o da v1');
  assert.equal(total, v1.snapshot_regras.filter((r) => r.ativa).length);

  const seguinte = (await comoAdmin(() => one(`select public.prompt_salvar_versao('Publicação depois do rollback') v`))).v;
  assert.equal((await one('select conteudo from public.meu_prompt_versoes where versao = $1', [seguinte])).conteudo, v1.conteudo, 'a próxima publicação não traz a regra de volta');
});

await caso('RLS: atendente não lê nem altera serviços, variáveis ou feriados; anon não toca em nada', async () => {
  for (const tabela of ['clinica_servicos', 'prompt_variaveis', 'agenda_feriados']) {
    assert.equal((await comoAtendente(() => q(`select * from public.${tabela}`))).length, 0, tabela);
  }
  assert.ok((await comoAdmin(() => q('select * from public.prompt_variaveis'))).length >= VARIAVEIS.length);
  await como('', () => esperaErro(() => q('select * from public.clinica_servicos'), 'permission denied'), 'anon');
  await comoAtendente(() => esperaErro(() => db.exec(`insert into public.clinica_servicos (chave, nome) values ('x1', 'X')`), 'row-level security'));
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.prompt_variaveis (nome, grupo, descricao) values ('hack', 'data', 'x')`), 'permission denied'));
});

await caso('catálogo de serviços: validações e exigência de tipo de agenda para o assistente', async () => {
  const ins = (cols, vals) => comoAdmin(() => db.exec(`insert into public.clinica_servicos (${cols}) values (${vals})`));
  await esperaErro(() => ins('chave, nome, quem_agenda', `'consulta', 'Consulta', 'assistente'`));
  await esperaErro(() => ins('chave, nome, preco', `'Chave Ruim', 'X', 10`));
  await esperaErro(() => ins('chave, nome, preco', `'preco_negativo', 'X', -1`));
  await esperaErro(() => ins('chave, nome, quem_agenda', `'quem', 'X', 'qualquer'`));
  await ins('chave, nome, preco, quem_agenda', `'cirurgia', 'Cirurgia', null, 'recepcao'`);
  await esperaErro(() => ins('chave, nome', `'cirurgia', 'Duplicada'`));
  const tipo = await comoAdmin(() => one(`insert into public.agenda_especialidades (chave, nome) values ('consulta', 'Consulta') returning id`));
  await ins('chave, nome, preco, quem_agenda, tipo_agenda_id', `'consulta', 'Consulta', 120, 'assistente', '${tipo.id}'`);
  await comoAdmin(() => esperaErro(() => db.exec(`delete from public.agenda_especialidades where id = '${tipo.id}'`), 'violates foreign key'));
  assert.ok((await one(`select count(*)::int n from public.agenda_config_auditoria where tabela = 'clinica_servicos'`)).n >= 2);
});

await caso('configuração institucional: horário de funcionamento e faixas de saudação são validados', async () => {
  const atualizar = (set) => comoAdmin(() => db.exec(`update public.atendimento_config set ${set}`));
  await atualizar(`endereco = 'Rua A, 1', horario_funcionamento = '[{"dias":[1,2,3,4,5],"abre":"08:00","fecha":"18:00"}]'::jsonb`);
  await esperaErro(() => atualizar(`horario_funcionamento = '[{"dias":[1],"abre":"18:00","fecha":"08:00"}]'::jsonb`));
  await esperaErro(() => atualizar(`horario_funcionamento = '[{"dias":[9],"abre":"08:00","fecha":"18:00"}]'::jsonb`));
  await esperaErro(() => atualizar(`horario_funcionamento = '[{"dias":[],"abre":"08:00","fecha":"18:00"}]'::jsonb`));
  await esperaErro(() => atualizar(`horario_funcionamento = '{"dias":[1]}'::jsonb`));
  await esperaErro(() => atualizar(`saudacao_boa_tarde_inicio = '06:00'`));
  await esperaErro(() => atualizar(`max_caracteres_mensagem = 10`));
  await comoAtendente(() => db.exec(`update public.atendimento_config set endereco = 'invasor'`));
  assert.equal((await one('select endereco from public.atendimento_config')).endereco, 'Rua A, 1');
});

await caso('motor de agenda: padrões, limites e recorrência quinzenal', async () => {
  const t = await one(`select * from public.agenda_especialidades where chave = 'consulta'`);
  assert.deepEqual(
    [t.antecedencia_minima_minutos, t.busca_horizonte_dias, t.busca_max_dias_com_vaga, t.busca_max_horarios_por_dia,
      t.busca_apresentar_max_datas, t.busca_apresentar_max_horarios, t.busca_ordem, t.max_pets_por_agendamento, t.capacidade_simultanea, t.enviar_convite_cliente],
    [0, 20, 10, 30, 2, 4, 'proximos', 1, 1, true],
  );
  for (const set of [`busca_ordem = 'aleatoria'`, `capacidade_simultanea = 0`, `max_pets_por_agendamento = 11`, `busca_horizonte_dias = 0`, `campos_obrigatorios = array['cpf']`]) {
    await comoAdmin(() => esperaErro(() => db.exec(`update public.agenda_especialidades set ${set} where chave = 'consulta'`), undefined));
  }
  await comoAdmin(() => db.exec(`update public.agenda_especialidades set campos_obrigatorios = array['email','nome_pet','raca_pet'], busca_ordem = 'em_torno_da_data' where chave = 'consulta'`));

  const prof = await comoAdmin(() => one(`insert into public.agenda_profissionais (nome, email, convidar_por_email) values ('Dra. Ana', 'ana@clinica.com', true) returning id`));
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.agenda_profissionais (nome, email) values ('Ruim', 'sem-arroba')`)));
  const regra = await comoAdmin(() => one(`insert into public.agenda_regras (profissional_id, especialidade_id, capacidade_simultanea, local_evento) values ('${prof.id}', '${t.id}', 2, 'Sala 3') returning id`));
  await comoAdmin(() => db.exec(`insert into public.agenda_janelas_semanais (regra_id, dia_semana, inicio, fim, recorrencia, ancora_quinzenal) values ('${regra.id}', 1, '11:00', '13:30', 'quinzenal', '2026-10-26')`));
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.agenda_janelas_semanais (regra_id, dia_semana, inicio, fim, recorrencia) values ('${regra.id}', 2, '11:00', '13:30', 'quinzenal')`)));
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.agenda_janelas_semanais (regra_id, dia_semana, inicio, fim, recorrencia) values ('${regra.id}', 3, '11:00', '13:30', 'mensal')`)));
  await comoAdmin(() => esperaErro(() => db.exec(`update public.agenda_regras set capacidade_simultanea = 0 where id = '${regra.id}'`)));

  // feriados: dia inteiro ou faixa; únicos por (data, agenda, início)
  await comoAdmin(() => db.exec(`insert into public.agenda_feriados (data, descricao) values ('2026-12-25', 'Natal')`));
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.agenda_feriados (data, descricao) values ('2026-12-25', 'Natal de novo')`)));
  await comoAdmin(() => db.exec(`insert into public.agenda_feriados (data, dia_inteiro, inicio, fim, regra_id) values ('2026-12-24', false, '14:00', '18:00', '${regra.id}')`));
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.agenda_feriados (data, dia_inteiro, inicio, fim) values ('2026-12-31', false, '18:00', '14:00')`)));
  await comoAdmin(() => esperaErro(() => db.exec(`insert into public.agenda_feriados (data, dia_inteiro) values ('2026-12-31', false)`)));

  // duplicar copia sobrescritas, recorrência e âncora
  const outro = await comoAdmin(() => one(`insert into public.agenda_profissionais (nome) values ('Dr. Clone') returning id`));
  const nova = await comoAdmin(() => one(`select public.agenda_duplicar_regra('${regra.id}', '${outro.id}', null) id`));
  const copia = await one(`select capacidade_simultanea, local_evento, ativo from public.agenda_regras where id = $1`, [nova.id]);
  assert.deepEqual(copia, { capacidade_simultanea: 2, local_evento: 'Sala 3', ativo: false });
  const janela = await one(`select recorrencia, to_char(ancora_quinzenal, 'YYYY-MM-DD') ancora from public.agenda_janelas_semanais where regra_id = $1`, [nova.id]);
  assert.deepEqual(janela, { recorrencia: 'quinzenal', ancora: '2026-10-26' });
});

await caso('registro de agendamentos: gestor lê, atendente não; só o serviço grava', async () => {
  const regra = await one('select id from public.agenda_regras limit 1');
  const linha = `insert into public.agenda_agendamentos (session_id, regra_id, tipo_chave, tipo_nome, google_event_id, inicio, fim) values ('5541@s.whatsapp.net', '${regra.id}', 'consulta', 'Consulta', 'ev1', now(), now() + interval '1 hour')`;
  await como('', () => db.exec(linha), 'service_role');
  await comoAdmin(() => esperaErro(() => db.exec(linha.replace('ev1', 'ev2')), 'permission denied'));
  assert.equal((await comoLider(() => q('select * from public.agenda_agendamentos'))).length, 1);
  assert.equal((await comoAtendente(() => q('select * from public.agenda_agendamentos'))).length, 0);
  await como('', () => esperaErro(() => db.exec(linha.replace('ev1', 'ev3').replace('now() + interval \'1 hour\'', 'now() - interval \'1 hour\'')), 'check'), 'service_role');
  await como('', () => esperaErro(() => db.exec(linha), 'duplicate'), 'service_role'); // mesmo evento do Google
});

await caso('migrações são idempotentes (reaplicar não duplica nem falha)', async () => {
  const regrasAntes = (await one('select count(*)::int n from public.prompt_regras')).n;
  const versoesAntes = (await one('select count(*)::int n from public.meu_prompt_versoes')).n;
  for (const f of ['20261027100000_clinica_configuracao_prompt.sql', '20261027110000_agenda_motor_configuravel.sql', '20261101150000_prompt_reverter_desativa_regras_novas.sql']) await db.exec(ler(`migrations/${f}`));
  assert.equal((await one('select count(*)::int n from public.prompt_regras')).n, regrasAntes);
  assert.equal((await one('select count(*)::int n from public.meu_prompt_versoes')).n, versoesAntes);
});

// ---------------------------------------------------------------------------
console.log('\nSemente da Clínica VetBots (fictícia) sobre a instalação neutra');

// Volta ao estado limpo das tabelas de cliente (o teste anterior criou dados de exemplo).
await db.exec(`
  truncate public.agenda_agendamentos, public.agenda_feriados, public.clinica_servicos, public.agenda_regras,
    public.agenda_profissionais, public.agenda_especialidades, public.agenda_calendarios cascade;
`);
const seed = ler('seeds/clinica-vetbots.sql');
await db.exec(seed);

await caso('empresa, estados e notificações vêm do seed (e não da migração)', async () => {
  const c = await one('select * from public.atendimento_config');
  assert.equal(c.nome_empresa, 'Clínica VetBots');
  assert.equal(c.nome_assistente, 'Luna');
  assert.equal(c.frase_encerramento, 'Seu pet é especial para nós');
  assert.deepEqual(c.planos_aceitos, ['Petlove Saúde', 'Porto.Pet (Porto Seguro)', 'DogLife']);
  assert.equal(c.horario_funcionamento.length, 2);
  assert.equal((await q('select telefone from public.notificacao_destinatarios')).length, 2);
});

await caso('agendas: tipos, durações, jornadas, almoço e calendário compartilhado como no n8n', async () => {
  const tipos = await q(`select chave, duracao_padrao_minutos d, duracao_retorno_minutos r, intervalo_slots_minutos p, operacoes_permitidas ops, campos_obrigatorios campos, max_pets_por_agendamento pets, tag_id from public.agenda_especialidades order by chave`);
  const por = Object.fromEntries(tipos.map((t) => [t.chave, t]));
  assert.deepEqual(Object.keys(por), ['consultaveterinaria', 'exame', 'gastroenterologia', 'oncologia', 'vacinas']);
  assert.deepEqual([por.consultaveterinaria.d, por.consultaveterinaria.r, por.consultaveterinaria.p, por.consultaveterinaria.pets], [60, 30, 30, 4]);
  assert.deepEqual([por.vacinas.d, por.exame.d, por.vacinas.pets, por.exame.pets], [30, 30, 1, 1]);
  assert.deepEqual(por.oncologia.ops, []); // o assistente não agenda oncologia/gastro (nós desativados no n8n)
  assert.deepEqual(por.gastroenterologia.ops, []);
  assert.deepEqual(por.consultaveterinaria.campos, ['email', 'nome_pet']);
  assert.ok(por.consultaveterinaria.tag_id && !por.oncologia.tag_id);

  const regras = await q(`select e.chave tipo, c.nome calendario, p.nome profissional from public.agenda_regras r join public.agenda_especialidades e on e.id = r.especialidade_id join public.agenda_calendarios c on c.id = r.calendario_id join public.agenda_profissionais p on p.id = r.profissional_id order by e.chave`);
  assert.equal(regras.length, 5);
  assert.deepEqual([...new Set(regras.filter((r) => ['consultaveterinaria', 'vacinas', 'exame'].includes(r.tipo)).map((r) => r.calendario))], ['Clínica Geral']);

  const janelas = await q(`select e.chave, j.dia_semana d, to_char(j.inicio, 'HH24:MI') i, to_char(j.fim, 'HH24:MI') f, j.ultimo_inicio from public.agenda_janelas_semanais j join public.agenda_regras r on r.id = j.regra_id join public.agenda_especialidades e on e.id = r.especialidade_id order by e.chave, j.dia_semana`);
  const geral = janelas.filter((j) => j.chave === 'consultaveterinaria').map((j) => `${j.d} ${j.i}-${j.f}`);
  assert.deepEqual(geral, ['1 09:00-18:00', '2 09:00-18:00', '3 09:00-18:00', '4 09:00-18:00', '5 08:00-18:00', '6 08:00-16:00']);
  assert.deepEqual(janelas.filter((j) => j.chave === 'gastroenterologia').map((j) => `${j.d} ${j.i}-${j.f}`), ['2 10:00-18:00', '4 10:00-18:00']);
  assert.ok(janelas.every((j) => j.ultimo_inicio === null));
  assert.equal((await one(`select count(*)::int n from public.agenda_intervalos where tipo = 'almoco'`)).n, 18);
});

await caso('serviços: preços únicos no catálogo; assistente só agenda o que tem agenda', async () => {
  const s = await q(`select chave, preco::float p, quem_agenda from public.clinica_servicos`);
  const por = Object.fromEntries(s.map((x) => [x.chave, x]));
  assert.equal(por.consulta_clinica_geral.p, 120);
  assert.equal(por.consulta_oncologia.p, 300);
  assert.equal(por.vacina_felina_v5.p, 140);
  assert.equal(por.ultrassonografia.quem_agenda, 'recepcao');
  assert.equal(por.internacao.quem_agenda, 'nao_oferece');
  assert.equal(s.length, 22);
});

await caso('regras da Clínica VetBots: ~50 regras com variáveis válidas; nada de expressão do n8n; versão nova é a última', async () => {
  const regras = await q(`select codigo, conteudo from public.prompt_regras where codigo like 'vb\\_%'`);
  assert.ok(regras.length >= 45, `só ${regras.length}`);
  const { prompt_completo: texto, total_regras_ativas: total } = await one('select * from public.obter_prompt_compilado()');
  assert.equal(total, (await one(`select count(*)::int n from public.prompt_regras where ativa`)).n);
  assert.deepEqual((await one(`select public.prompt_marcadores_invalidos($1) m`, [texto])).m, []);
  assert.doesNotMatch(texto, /\{\{\s*\$/);
  const ultima = await one('select conteudo, descricao from public.meu_prompt_versoes order by versao desc limit 1');
  assert.equal(ultima.conteudo, texto);
  assert.match(ultima.descricao, /Clínica VetBots/);
  // regras específicas removidas da migração genérica
  assert.equal((await one(`select count(*)::int n from public.prompt_regras where codigo in ('limite_pets_horario','horarios_fim_de_semana','plantao_emergencia_noturno')`)).n, 0);
});

await caso('ponta a ponta: o prompt da Clínica VetBots renderizado resolve preços, horários e datas — sem marcador sobrando', async () => {
  const empresa = await one('select * from public.atendimento_config');
  const servicos = await q('select * from public.clinica_servicos');
  const tipos = await q('select * from public.agenda_especialidades');
  const regrasLinhas = await q('select * from public.agenda_regras');
  const profissionais = await q('select * from public.agenda_profissionais');
  const janelas = await q('select * from public.agenda_janelas_semanais');
  const intervalos = await q('select * from public.agenda_intervalos');
  const catalogo = montarCatalogo(tipos, regrasLinhas, profissionais, servicos);
  const horariosPorTipo = {};
  for (const tipo of catalogo) {
    horariosPorTipo[tipo.chave] = textoHorariosTipo(tipo.regras.map((regra) => ({
      profissional: regra.profissional_nome, duracao: parametrosEfetivos(tipo, regra).duracao,
      janelas: janelas.filter((j) => j.regra_id === regra.id), intervalos: intervalos.filter((i) => i.regra_id === regra.id),
    })));
  }
  assert.equal(horariosPorTipo.oncologia, 'segunda a quinta, 09:00 às 18:00 (último horário 17:00)');
  assert.equal(horariosPorTipo.gastroenterologia, 'terça e quinta, 10:00 às 18:00 (último horário 17:00)');
  assert.match(horariosPorTipo.consultaveterinaria, /^segunda a quinta, 09:00 às 18:00 \(último horário 17:00\) — pausa para almoço 13:00 às 14:00\nsexta, 08:00/);

  const { conteudo } = await one('select conteudo from public.meu_prompt_versoes order by versao desc limit 1');
  const { texto, desconhecidas } = renderizarPrompt(conteudo, {
    agora: new Date('2026-10-26T13:10:00Z'), // segunda 10:10 em Brasília
    empresa: { ...empresa, horario_funcionamento: empresa.horario_funcionamento }, cliente: { nomeWhatsapp: 'Maria S.', petNome: 'Thor', telefone: '5541999990001@s.whatsapp.net' },
    servicos, horariosPorTipo, tipos: catalogo.map((t) => ({ chave: t.chave, nome: t.nome })),
  });
  assert.deepEqual(desconhecidas, []);
  assert.doesNotMatch(texto, /\{\{|\}\}/);
  assert.match(texto, /Agora: segunda-feira, 26\/10\/2026, 10:10 \(fuso America\/Sao_Paulo\)/);
  assert.match(texto, /Amanhã é terça-feira, 27\/10\/2026/);
  assert.match(texto, /Você é Luna, assistente virtual de Clínica VetBots/);
  assert.match(texto, /bom dia/);
  assert.match(texto, /Cliente: Maria S\. · telefone \(41\) 9 9999-0001 · e-mail não informado/);
  assert.match(texto, /Valor da consulta oncológica: R\$ 300,00/);
  assert.match(texto, /Valor da consulta \(atendimento particular\): R\$ 120,00/);
  assert.match(texto, /Chave Pix CNPJ 00\.000\.000\/0001-00/);
  assert.match(texto, /Rua das Flores, 123, Centro, Curitiba - PR/);
  assert.match(texto, /Segunda a sexta: 08:00 às 18:00\nSábado: 08:00 às 16:00\nDomingo: fechado/);
  assert.match(texto, /Múltipla \(V8 ou V10\): R\$ 75,00/);
  assert.match(texto, /Agendados SOMENTE pela recepção humana/);
  assert.match(texto, /Planos\/convênios aceitos: Petlove Saúde, Porto\.Pet \(Porto Seguro\), DogLife/);
  assert.doesNotMatch(texto, /Balthazar|\$now|DadosClienteSupabase|Webhook EVO/);
});

await caso('a semente é reexecutável: não duplica nada nem cria versão idêntica', async () => {
  const contar = async () => ({
    versoes: (await one('select count(*)::int n from public.meu_prompt_versoes')).n,
    regras: (await one('select count(*)::int n from public.prompt_regras')).n,
    servicos: (await one('select count(*)::int n from public.clinica_servicos')).n,
    janelas: (await one('select count(*)::int n from public.agenda_janelas_semanais')).n,
    destinatarios: (await one('select count(*)::int n from public.notificacao_destinatarios')).n,
    calendarios: (await one('select count(*)::int n from public.agenda_calendarios')).n,
  });
  // Agenda criada depois no painel (outro profissional, mesmo tipo) + bloqueios que a equipe cadastrou.
  const extra = await comoAdmin(() => one(`insert into public.agenda_profissionais (nome) values ('Dr. Novo') returning id`));
  const tipo = await one(`select id from public.agenda_especialidades where chave = 'consultaveterinaria'`);
  const regra = await comoAdmin(() => one(`insert into public.agenda_regras (profissional_id, especialidade_id) values ('${extra.id}', '${tipo.id}') returning id`));
  await comoAdmin(() => db.exec(`
    insert into public.agenda_janelas_semanais (regra_id, dia_semana, inicio, fim) values ('${regra.id}', 3, '14:00', '18:00');
    insert into public.agenda_intervalos (regra_id, tipo, dia_semana, inicio, fim) values ('${regra.id}', 'almoco', 3, '16:00', '16:30');
    insert into public.agenda_intervalos (regra_id, tipo, data_especifica, inicio, fim, descricao) values ('${regra.id}', 'bloqueio', '2026-12-24', '08:00', '12:00', 'Reunião');`));
  const geral = await one(`select r.id from public.agenda_regras r join public.agenda_profissionais p on p.id = r.profissional_id join public.agenda_especialidades e on e.id = r.especialidade_id where p.nome = 'Clínica Geral' and e.chave = 'consultaveterinaria'`);
  await comoAdmin(() => db.exec(`insert into public.agenda_intervalos (regra_id, tipo, data_especifica, inicio, fim, descricao) values ('${geral.id}', 'bloqueio', '2026-12-31', '08:00', '18:00', 'Confraternização')`));

  const antes = await contar();
  await db.exec(seed);
  const depois = await contar();
  assert.equal(depois.janelas, antes.janelas, 'jornadas semeadas devem ser recriadas sem duplicar');
  assert.deepEqual({ ...depois, janelas: 0 }, { ...antes, janelas: 0 });
  // nada do que foi criado depois no painel some
  assert.equal((await one(`select count(*)::int n from public.agenda_janelas_semanais where regra_id = '${regra.id}'`)).n, 1);
  assert.equal((await one(`select count(*)::int n from public.agenda_intervalos where regra_id = '${regra.id}'`)).n, 2);
  assert.equal((await one(`select count(*)::int n from public.agenda_intervalos where regra_id = '${geral.id}' and tipo = 'bloqueio' and data_especifica = '2026-12-31'`)).n, 1);
  // o almoço da agenda semeada continua uma vez por dia (não duplicou)
  assert.equal((await one(`select count(*)::int n from public.agenda_intervalos where regra_id = '${geral.id}' and tipo = 'almoco'`)).n, 6);
});

resumo();
