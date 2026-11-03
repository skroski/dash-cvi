// Teste da configuração oficial do C.V.I. - Centro Veterinário Integrado Fazenda Rio Grande (Balthazar) com migrações
import { ADMIN, ATENDENTE, ler, criarBanco, ferramentas } from './harness.mjs';
import { renderizarPrompt } from '../../functions/_shared/prompt_variaveis.ts';
import { montarCatalogo } from '../../functions/_shared/agenda_catalogo.ts';

const db = await criarBanco({
  migracoes: [
    '20261021120000_agenda_configuravel.sql',
    '20261021150000_prompt_maia_migrado.sql',
    '20261025120000_prompt_regras_modular_versionamento.sql',
    '20261026100000_configuracao_atendimento_agnostica.sql',
    '20261027100000_clinica_configuracao_prompt.sql',
    '20261027110000_agenda_motor_configuravel.sql',
    '20261101150000_prompt_reverter_desativa_regras_novas.sql',
    '20261102100000_configuracao_cvi.sql',
  ],
});

const { q, one, caso, assert, resumo } = ferramentas(db);

console.log('\nConfiguração do C.V.I. - Centro Veterinário Integrado (Balthazar)');

await caso('dados institucionais do C.V.I. em atendimento_config', async () => {
  const cfg = await one('select * from public.atendimento_config');
  assert.equal(cfg.nome_empresa, 'C.V.I. - Centro Veterinário Integrado');
  assert.equal(cfg.nome_assistente, 'Balthazar');
  assert.equal(cfg.telefone_contato, '(41) 3150-5444');
  assert.equal(cfg.endereco, 'Rua Manoel Claudino Barbosa, 1307, Fazenda Rio Grande, PR, Brasil, 83833-014');
  assert.equal(cfg.frase_encerramento, 'Amor, Ética e Comprometimento não são apenas valores, são a forma como honramos cada vida que nos é confiada!');
  assert.ok(cfg.planos_aceitos.includes('PetHealth'));
  assert.equal(cfg.horario_funcionamento.length, 3);
});

await caso('equipe veterinária e especialidades do C.V.I.', async () => {
  const profissionais = await q('select nome from public.agenda_profissionais where ativo order by nome');
  const nomes = profissionais.map((p) => p.nome);
  assert.ok(nomes.includes('Clínica Geral'));
  assert.ok(nomes.includes('Dr. Frederico'));

  const especialidades = await q('select chave, max_pets_por_agendamento from public.agenda_especialidades order by chave');
  const mapaEsp = Object.fromEntries(especialidades.map((e) => [e.chave, e.max_pets_por_agendamento]));
  assert.equal(mapaEsp.consultaveterinaria, 4);
  assert.equal(mapaEsp.vacina, 4);
  assert.equal(mapaEsp.especialistas, 1);
});

await caso('catálogo de serviços e valores do C.V.I.', async () => {
  const servicos = await q('select chave, preco::float p, quem_agenda from public.clinica_servicos');
  const s = Object.fromEntries(servicos.map((x) => [x.chave, x]));

  assert.equal(s.consulta_clinico_geral_comercial.p, 115);
  assert.equal(s.consulta_clinico_geral_plantao.p, 260);
  assert.equal(s.retorno_consulta_clinica.p, 0);
  assert.equal(s.corte_de_unhas.p, 35);
  assert.equal(s.microchipagem_particular.p, 150);
  assert.equal(s.vacina_v10_vanguard.p, 110);
  assert.equal(s.vacina_antirrabica.p, 70);
  assert.equal(s.vacina_giardia.p, 110);
  assert.equal(s.vacina_gripe_oral.p, 130);
  assert.equal(s.vacina_felocell_v4.p, 95);
  assert.equal(s.vacina_felocell_felv.p, 70);
  assert.equal(s.teste_rapido_fiv_felv.p, 185);
  assert.equal(s.pcr_fiv.p, 270);
  assert.equal(s.pcr_felv.p, 270);
  assert.equal(s.ultrassom_comercial.p, 260);
  assert.equal(s.ultrassom_plantao_sab_dom.p, 350);
  assert.equal(s.raio_x_comercial.p, 260);
  assert.equal(s.raio_x_plantao_sab_dom.p, 350);
  assert.equal(s.ecodoplercardiograma.p, 350);
  assert.equal(s.eletrocardiograma.p, 280);
  assert.equal(s.banho_e_tosa.quem_agenda, 'nao_oferece');
  assert.equal(s.atendimento_domiciliar.quem_agenda, 'nao_oferece');
  assert.equal(s.exame_tomografia.quem_agenda, 'nao_oferece');
  assert.equal(s.internacao_infectocontagiosos.quem_agenda, 'nao_oferece');
});

await caso('regras do prompt do C.V.I. e versão compilada', async () => {
  const { prompt_completo: texto, total_regras_ativas: total } = await one('select * from public.obter_prompt_compilado()');
  assert.ok(total >= 18);

  // Sem marcadores inválidos nem expressões do n8n
  assert.deepEqual((await one(`select public.prompt_marcadores_invalidos($1) m`, [texto])).m, []);
  assert.doesNotMatch(texto, /\{\{\s*\$/);
  assert.doesNotMatch(texto, /MGalv|Galvão|VetBots|Luna|Maia|Judith|cvi Veterinária/);

  const ultima = await one('select conteudo, descricao from public.meu_prompt_versoes order by versao desc limit 1');
  assert.equal(ultima.conteudo, texto);
  assert.match(ultima.descricao, /C\.V\.I\./);
});

await caso('renderização ponta a ponta do prompt do Balthazar', async () => {
  const empresa = await one('select * from public.atendimento_config');
  const servicos = await q('select * from public.clinica_servicos');
  const tipos = await q('select * from public.agenda_especialidades');
  const regrasLinhas = await q('select * from public.agenda_regras');
  const profissionais = await q('select * from public.agenda_profissionais');
  const catalogo = montarCatalogo(tipos, regrasLinhas, profissionais, servicos);

  const { conteudo } = await one('select conteudo from public.meu_prompt_versoes order by versao desc limit 1');
  const { texto, desconhecidas } = renderizarPrompt(conteudo, {
    agora: new Date('2026-11-03T13:00:00Z'), // terça 10:00 em SP
    empresa: { ...empresa, horario_funcionamento: empresa.horario_funcionamento },
    cliente: { nomeWhatsapp: 'Carlos S.', petNome: 'Pipoca', telefone: '5541999998888@s.whatsapp.net' },
    servicos,
    horariosPorTipo: {},
    tipos: catalogo.map((t) => ({ chave: t.chave, nome: t.nome })),
  });

  assert.deepEqual(desconhecidas, []);
  assert.match(texto, /Balthazar/);
  assert.match(texto, /Centro Veterinário Integrado/);
  assert.match(texto, /Rua Manoel Claudino Barbosa/);
  assert.match(texto, /\(41\) 3150-5444/);
  assert.match(texto, /Amor, Ética e Comprometimento não são apenas valores/);
  assert.doesNotMatch(texto, /\{\{[a-z0-9_:]+\}\}/); // nenhum marcador sobrando
});

resumo();
