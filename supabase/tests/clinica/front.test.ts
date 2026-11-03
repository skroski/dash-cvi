// Bibliotecas puras do front (src/lib) e paridade com os módulos equivalentes do servidor.
// Uso: node --experimental-strip-types --test supabase/tests/clinica/front.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import {
  VARIAVEIS, descreverDias as descreverDiasServidor, marcadoresDesconhecidos as desconhecidasServidor, textoHorarioFuncionamento as textoServidor,
} from '../../functions/_shared/prompt_variaveis.ts';
import { textoHorariosTipo as horariosServidor } from '../../functions/_shared/horarios_texto.ts';
import { montarEvento } from '../../functions/_shared/agenda_agendamento.ts';
import { parametrosEfetivos, montarCatalogo } from '../../functions/_shared/agenda_catalogo.ts';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'front-lib-'));

// O front usa alias "@/" e imports sem extensão: o esbuild resolve como o Vite faz.
async function carregar(relativo: string) {
  const saida = path.join(pasta, `${path.basename(relativo, '.ts')}-${Math.random().toString(36).slice(2)}.mjs`);
  await build({
    entryPoints: [path.join(raiz, relativo)], bundle: true, format: 'esm', platform: 'node', outfile: saida, logLevel: 'silent',
    alias: { '@': path.join(raiz, 'src') },
  });
  return await import(pathToFileURL(saida).href);
}

const horariosTexto = await carregar('src/lib/horariosTexto.ts');
const horariosTipo = await carregar('src/lib/horariosTipo.ts');
const promptFront = await carregar('src/lib/promptVariaveis.ts');
const moeda = await carregar('src/lib/moeda.ts');
const implantacao = await carregar('src/lib/implantacao.ts');
const modelosEvento = await carregar('src/components/config/agenda/modelosEvento.ts');

const registro = VARIAVEIS.map((v) => ({ ...v, parametro: v.parametro ?? null, alias_de: null }));

test('horários: texto de dias e de funcionamento é idêntico no front e no servidor', () => {
  for (const dias of [[1, 2, 3, 4, 5], [2, 4], [1, 3, 5], [6], [0, 6], [1, 2, 3], [], [0, 1, 2, 3, 4, 5, 6]]) {
    assert.equal(horariosTexto.descreverDias(dias), descreverDiasServidor(dias), JSON.stringify(dias));
  }
  const faixas = [{ dias: [1, 2, 3, 4, 5], abre: '08:00', fecha: '18:00' }, { dias: [6], abre: '08:00:00', fecha: '16:00:00' }];
  assert.equal(horariosTexto.textoHorarioFuncionamento(faixas), textoServidor(faixas));
  assert.equal(horariosTexto.textoHorarioFuncionamento([]), '');
});

test('horários: texto dos tipos de agendamento é idêntico no front e no servidor', () => {
  const regra = {
    profissional: 'Dra. Ana', duracao: 60,
    janelas: [{ dia_semana: 1, inicio: '09:00:00', fim: '18:00:00' }, { dia_semana: 2, inicio: '09:00:00', fim: '18:00:00' }, { dia_semana: 4, inicio: '14:00', fim: '17:00', ultimo_inicio: '16:00', recorrencia: 'quinzenal' }],
    intervalos: [{ tipo: 'almoco', dia_semana: 1, inicio: '12:00:00', fim: '13:00:00' }, { tipo: 'almoco', dia_semana: 2, inicio: '12:00', fim: '13:00' }],
  };
  const outra = { profissional: 'Dr. Bruno', nome_exibicao: 'Dr. Bruno C.', duracao: 30, janelas: [{ dia_semana: 6, inicio: '08:00', fim: '12:00' }], intervalos: [] };
  assert.equal(horariosTipo.textoHorariosTipo([regra]), horariosServidor([regra]));
  assert.equal(horariosTipo.textoHorariosTipo([regra, outra]), horariosServidor([regra, outra]));
});

test('variáveis: validação de marcadores igual no front e no servidor', () => {
  const textos = [
    'ok {{nome_empresa}} {{ preco:consulta }} {{horarios:x}}', '{{inexistente}} {{ $now.format("dd") }}', '{{preco}} {{nome_empresa:x}}',
    'sem marcadores', '{{cliente_nome}}{{cliente_nome}}',
  ];
  for (const texto of textos) {
    assert.deepEqual(promptFront.marcadoresDesconhecidos(texto, registro).sort(), desconhecidasServidor(texto).sort(), texto);
  }
  assert.equal(promptFront.marcadorDe({ nome: 'preco', parametro: 'chave do serviço' }), '{{preco:chave}}');
  assert.equal(promptFront.marcadorDe({ nome: 'nome_empresa', parametro: null }), '{{nome_empresa}}');
});

test('preço digitado: aceita formatos brasileiros e recusa o resto', () => {
  assert.equal(moeda.lerPreco('120'), 120);
  assert.equal(moeda.lerPreco('120,5'), 120.5);
  assert.equal(moeda.lerPreco('R$ 1.200,00'), 1200);
  assert.equal(moeda.lerPreco('  '), null);
  assert.ok(Number.isNaN(moeda.lerPreco('abc')));
  assert.ok(Number.isNaN(moeda.lerPreco('-5')));
});

test('modelo do evento: variáveis do painel == variáveis resolvidas pelo servidor', () => {
  const tipo = montarCatalogo([{ id: 't', chave: 'consulta', nome: 'Consulta' }], [{ id: 'r', especialidade_id: 't', profissional_id: 'p' }], [{ id: 'p', nome: 'Dra. Ana' }])[0];
  const modelo = modelosEvento.VARIAVEIS_EVENTO.map((v: { nome: string }) => `${v.nome}=[{{${v.nome}}}]`).join('\n');
  const evento = montarEvento({
    tipo, parametros: { ...parametrosEfetivos(tipo, tipo.regras[0]), tituloModelo: 'x', descricaoModelo: modelo },
    profissional: 'Dra. Ana', inicioMs: Date.parse('2026-10-28T17:30:00Z'), fuso: 'America/Sao_Paulo',
    cliente: { nome: 'Maria', nomePet: 'Thor', email: 'm@e.com', telefone: '5541999990001', observacao: 'obs' }, nomeEmpresa: 'Empresa',
  });
  for (const linha of evento.description.split('\n').filter((l) => l.includes('='))) {
    assert.doesNotMatch(linha, /=\[\]/, `variável sem valor no servidor: ${linha}`);
  }
  assert.deepEqual(modelosEvento.marcadoresEventoInvalidos('{{pet_nome}} {{foo}} {{ data }}'), ['{{foo}}']);
  assert.equal(modelosEvento.previaModelo('{{servico}} — {{pet_nome}}'), 'Consulta de Clínica Geral — Thor');
});

test('horário de funcionamento: validação das faixas', () => {
  const v = horariosTexto.validarHorarios;
  assert.equal(v([{ dias: [1, 2], abre: '08:00', fecha: '18:00' }]), null);
  assert.match(v([{ dias: [], abre: '08:00', fecha: '18:00' }]), /ao menos um dia/);
  assert.match(v([{ dias: [1], abre: '18:00', fecha: '08:00' }]), /antes do fechamento/);
  assert.match(v([{ dias: [1], abre: '08:00', fecha: '12:00' }, { dias: [1, 2], abre: '13:00', fecha: '18:00' }]), /mais de uma faixa/);
});

test('implantação: o checklist aponta o que falta e não acusa pendência onde está tudo certo', () => {
  const config = {
    nome_empresa: 'Minha empresa', nome_assistente: 'Assistente', telefone_contato: null, endereco: null, frase_encerramento: null,
    horario_funcionamento: [],
  };
  const base = { config, servicos: [], destinatarios: [], tipos: [], regras: [], janelas: [], openaiConfigurada: false, versoesPrompt: 0 };
  const vazio = implantacao.calcularChecklist(base);
  assert.ok(vazio.every((i: { situacao: string }) => i.situacao !== 'ok'));
  assert.match(vazio.find((i: { chave: string }) => i.chave === 'empresa').detalhe, /nome da empresa, nome do assistente, telefone, endereço/);

  const pronto = implantacao.calcularChecklist({
    config: { ...config, nome_empresa: 'Clínica X', nome_assistente: 'Luna', telefone_contato: '1', endereco: 'Rua', frase_encerramento: 'Até logo', horario_funcionamento: [{ dias: [1], abre: '08:00', fecha: '18:00' }] },
    servicos: [{ ativo: true, preco: 100 }], destinatarios: [{ ativo: true }], tipos: [],
    regras: [{ id: 'r1', ativo: true, calendario_id: 'c1', profissional: { nome: 'Ana' }, especialidade: { nome: 'Consulta' } }],
    janelas: [{ regra_id: 'r1' }], openaiConfigurada: true, versoesPrompt: 3,
  });
  assert.ok(pronto.every((i: { situacao: string }) => i.situacao === 'ok'), JSON.stringify(pronto.filter((i: { situacao: string }) => i.situacao !== 'ok')));

  const semJornada = implantacao.calcularChecklist({
    ...base, regras: [{ id: 'r1', ativo: true, calendario_id: 'c1', profissional: { nome: 'Ana' }, especialidade: { nome: 'Consulta' } }], janelas: [],
  });
  const agenda = semJornada.find((i: { chave: string }) => i.chave === 'agenda');
  assert.equal(agenda.situacao, 'atencao');
  assert.match(agenda.detalhe, /Sem jornada semanal: Ana · Consulta/);
});
