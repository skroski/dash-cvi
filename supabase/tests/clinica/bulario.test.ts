import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsvBulario,
  exportarBularioCsv,
  exportarBularioJson,
  normalizarApresentacoes,
  gerarSlugBulario,
  dividirCsvEmLinhas,
} from '../../../src/lib/bularioParser.ts';
import { BULARIO_PADRAO, calcularPosologiaItem } from '../../../src/lib/receituarioMotor.ts';

test('Bulário Parser: divide CSV com delimitador vírgula e ponto-e-vírgula e preserva campos entre aspas', () => {
  const csvPontoVirgula = `principio_ativo;nome_comercial_sugerido;dose_padrao_mg_kg\n"Amoxicilina + Clavulanato";"Synulox 250 mg";12.5`;
  const linhas = dividirCsvEmLinhas(csvPontoVirgula);

  assert.equal(linhas.length, 2);
  assert.equal(linhas[1][0], 'Amoxicilina + Clavulanato');
  assert.equal(linhas[1][1], 'Synulox 250 mg');
  assert.equal(linhas[1][2], '12.5');
});

test('Bulário Parser: mapeia colunas flexíveis e extrai apresentações e contraindicações', () => {
  const csv = `
Princípio Ativo;Nome Comercial;Classe;Via;Espécies;Contraindicações;MDR1;Dose (mg/kg);Apresentações
Enrofloxacino;Baytril 50 mg;antibiotico;oral;canina, felina;;nao;5.0;"Baytril 15 mg; Baytril 50 mg"
Paracetamol;Tylenol;analgesico;oral;canina;felina;nao;10.0;Gotas 200 mg/mL
Ivermectina;IverCanis;antiparasitario;oral;canina;;sim;0.2;IverCanis 3 mg
`.trim();

  const resultado = parseCsvBulario(csv);
  assert.equal(resultado.erros.length, 0);
  assert.equal(resultado.itens.length, 3);

  const enro = resultado.itens[0];
  assert.equal(enro.principio_ativo, 'Enrofloxacino');
  assert.equal(enro.nome_comercial_sugerido, 'Baytril 50 mg');
  assert.equal(enro.dose_padrao_mg_kg, 5.0);
  assert.equal(enro.icone_via, 'oral');
  assert.equal(enro.apresentacoes.length, 2);

  const paracetamol = resultado.itens[1];
  assert.equal(paracetamol.especies_contraindicadas.includes('felina'), true);

  const ivermectina = resultado.itens[2];
  assert.equal(ivermectina.risco_mdr1, true);
});

test('Bulário Parser: calcula posologia de item importado via CSV com precisão clínica', () => {
  const csv = `
principio_ativo;nome_comercial_sugerido;dose_padrao_mg_kg;apresentacoes
Cefalexina;Rilexine 300 mg;25;[{"rotulo":"Rilexine 300 mg","forma":"comprimido","concentracao_mg":300,"divisivel":true}]
`.trim();

  const { itens } = parseCsvBulario(csv);
  assert.equal(itens.length, 1);

  // Cão de 12 kg com dose de 25 mg/kg = 300 mg (1 comprimido exato)
  const itemPrescricao = calcularPosologiaItem({
    regra: itens[0],
    paciente: { especie: 'canina', peso_kg: 12 },
  });

  assert.equal(itemPrescricao.posologia.dose_calculada_mg, 300);
  assert.equal(itemPrescricao.posologia.quantidade_por_tomada, '1 comprimido');
  assert.match(itemPrescricao.memoria_calculo, /25 mg\/kg × 12 kg = 300 mg\/tomada/);
});

test('Bulário Parser: exporta para CSV e reconverte preservando integridade dos dados', () => {
  const csvExportado = exportarBularioCsv(BULARIO_PADRAO.slice(0, 5));
  assert.ok(csvExportado.includes('amoxicilina-clavulanato'));
  assert.ok(csvExportado.includes('Synulox 250 mg'));

  const parseadoNovamente = parseCsvBulario(csvExportado);
  assert.equal(parseadoNovamente.erros.length, 0);
  assert.equal(parseadoNovamente.itens.length, 5);
  assert.equal(parseadoNovamente.itens[0].slug, 'amoxicilina-clavulanato');
});

test('Bulário Parser: normalizarApresentacoes suporta JSON e texto livre formatado', () => {
  const jsonApresentacoes = '[{"rotulo":"Doxitrat 80 mg","forma":"comprimido","concentracao_mg":80}]';
  const norm1 = normalizarApresentacoes(jsonApresentacoes);
  assert.equal(norm1.length, 1);
  assert.equal(norm1[0].concentracao_mg, 80);

  const textoApresentacoes = 'Dipirona Gotas 500 mg/mL; Dipirona Comprimido 500 mg';
  const norm2 = normalizarApresentacoes(textoApresentacoes);
  assert.equal(norm2.length, 2);
  assert.equal(norm2[0].forma, 'gotas');
  assert.equal(norm2[1].forma, 'comprimido');
});
