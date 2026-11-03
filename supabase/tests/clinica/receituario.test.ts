// Testes unitários do Motor Posológico, Hard Rules, Cronograma Visual e PDF/QR Code
//   node --experimental-strip-types --test supabase/tests/clinica/receituario.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BULARIO_PADRAO,
  calcularPosologiaItem,
  validarSegurancaPrescricao,
  gerarGradeCronograma,
  gerarSugestaoCopilotoLocal,
  extrairContextoEntradaClinica,
  detectarRiscoMdr1PorRaca,
  localizarRegraBulario,
} from '../../../src/lib/receituarioMotor.ts';
import {
  escaparHtmlReceita,
  mascararTelefoneTutor,
  gerarCodigoVerificacaoReceita,
  calcularHashSha256Prescricao,
  gerarMatrizQrVisual,
  montarHtmlReceituarioPdf,
} from '../../../src/lib/receituarioPdf.ts';

test('RF-03 e Seção 8.1: Amoxicilina + Clavulanato 12,5 mg/kg em cão de 12 kg gera 150 mg e Synulox 250 mg (1/2 comprimido)', () => {
  const regra = localizarRegraBulario('amoxicilina-clavulanato', BULARIO_PADRAO);
  assert.ok(regra);

  const item = calcularPosologiaItem({
    regra,
    paciente: { especie: 'canina', peso_kg: 12 },
    dose_mg_kg: 12.5,
    frequencia_horas: 12,
    duracao_dias: 10,
  });

  assert.equal(item.posologia.dose_calculada_mg, 150);
  assert.equal(item.nome_comercial_sugerido, 'Synulox 250 mg');
  assert.equal(item.posologia.apresentacao_escolhida, 'comprimido');
  assert.equal(item.posologia.quantidade_por_tomada, '1/2 comprimido');
  assert.equal(item.posologia.frequencia_horas, 12);
  assert.equal(item.posologia.duracao_dias, 10);
  assert.equal(item.icone_via, 'oral');
  assert.match(item.memoria_calculo, /12,5 mg\/kg × 12 kg = 150 mg\/tomada/);
});

test('RF-04 e Seção 9: Bloqueio crítico ao prescrever Paracetamol ou Permetrina para espécie felina', () => {
  const regraParacetamol = localizarRegraBulario('paracetamol', BULARIO_PADRAO)!;
  const item = calcularPosologiaItem({
    regra: regraParacetamol,
    paciente: { especie: 'felina', peso_kg: 4 },
  });

  const validacao = validarSegurancaPrescricao(
    { tutor_nome: 'Ana', nome: 'Mingau', especie: 'felina', peso_kg: 4 },
    [item],
    BULARIO_PADRAO
  );

  assert.equal(validacao.bloqueia_emissao, true);
  assert.equal(validacao.cor_semantica, 'vermelho');
  assert.equal(validacao.alerta_seguranca.nivel, 'critico');
  assert.ok(validacao.alertas.some((a) => a.categoria === 'especie_toxica'));
});

test('RF-04: Detecção automática de mutação no gene MDR1 (Collie, Shetland, Pastor Australiano) bloqueia Ivermectina e Loperamida', () => {
  assert.equal(detectarRiscoMdr1PorRaca('canina', 'Rough Collie'), true);
  assert.equal(detectarRiscoMdr1PorRaca('canina', 'Pastor de Shetland'), true);
  assert.equal(detectarRiscoMdr1PorRaca('canina', 'Poodle'), false);

  const regraIvermectina = localizarRegraBulario('ivermectina', BULARIO_PADRAO)!;
  const item = calcularPosologiaItem({
    regra: regraIvermectina,
    paciente: { especie: 'canina', peso_kg: 20 },
  });

  const validacao = validarSegurancaPrescricao(
    { tutor_nome: 'Roberto', nome: 'Lassie', especie: 'canina', raca: 'Rough Collie', peso_kg: 20 },
    [item],
    BULARIO_PADRAO
  );

  assert.equal(validacao.bloqueia_emissao, true);
  assert.equal(validacao.cor_semantica, 'vermelho');
  assert.ok(validacao.alertas.some((a) => a.categoria === 'mdr1'));
});

test('RF-04: Detecta interação grave entre AINE (Meloxicam) e Corticoide (Prednisolona)', () => {
  const paciente = { tutor_nome: 'Carlos', nome: 'Rex', especie: 'canina' as const, peso_kg: 15 };
  const itemMelox = calcularPosologiaItem({
    regra: localizarRegraBulario('meloxicam')!,
    paciente,
  });
  const itemPred = calcularPosologiaItem({
    regra: localizarRegraBulario('prednisolona')!,
    paciente,
  });

  const validacao = validarSegurancaPrescricao(paciente, [itemMelox, itemPred], BULARIO_PADRAO);
  assert.equal(validacao.bloqueia_emissao, true);
  assert.ok(validacao.alertas.some((a) => a.categoria === 'interacao' && a.cor === 'vermelho'));
});

test('RF-07: Módulo de Manipulados estrutura veículo, sabor por espécie e quantidade calculada', () => {
  const itemGato = calcularPosologiaItem({
    regra: localizarRegraBulario('gabapentina-manipulada')!,
    paciente: { especie: 'felina', peso_kg: 4.5 },
    tipo: 'manipulado',
    veiculo_manipulado: 'pasta_oral',
    frequencia_horas: 12,
    duracao_dias: 14,
  });

  assert.equal(itemGato.tipo, 'manipulado');
  assert.ok(itemGato.manipulado);
  assert.equal(itemGato.manipulado.veiculo, 'pasta_oral');
  assert.equal(itemGato.manipulado.sabor, 'Salmão');
  assert.equal(itemGato.posologia.dose_calculada_mg, 45);
  assert.match(itemGato.manipulado.quantidade_total_unidades, /28 doses de 45 mg/);
});

test('RF-02 e RF-05: Entrada em linguagem natural extrai contexto e gera cronograma visual', () => {
  const pistas = extrairContextoEntradaClinica('Otite fúngica canina bilateral moderada em cão de 12kg');
  assert.equal(pistas.peso_kg, 12);
  assert.equal(pistas.especie, 'canina');

  const sugestao = gerarSugestaoCopilotoLocal(
    'Otite fúngica canina bilateral moderada em cão de 12kg',
    { tutor_nome: 'Carlos', nome: 'Thor', especie: 'canina', peso_kg: 12 }
  );

  assert.ok(sugestao.itens.length >= 2);
  assert.equal(sugestao.payload_prd.alerta_seguranca.nivel, 'baixo');
  assert.equal(sugestao.payload_prd.alerta_seguranca.mensagem, null);

  const cronograma = gerarGradeCronograma(sugestao.itens);
  assert.ok(cronograma.length >= 2);
  assert.ok(cronograma.some((s) => s.horario === '08:00'));
});

test('RF-08 e Segurança: PDF escapa HTML malicioso (anti-XSS), mascara telefone e gera QR Code e Hash SHA-256', async () => {
  assert.equal(escaparHtmlReceita('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(mascararTelefoneTutor('5541999887766'), '***-***-7766');

  const codigo = gerarCodigoVerificacaoReceita();
  assert.match(codigo, /^RX-\d{4}-[A-Z0-9]{6}$/);

  // QR Code real: matriz quadrada de versão válida (21, 25, 29... módulos) com os três finder patterns
  const matrizQr = gerarMatrizQrVisual(`https://clinica.vet/validar-receita/${codigo}`);
  const lado = matrizQr.length;
  assert.ok(lado >= 21 && (lado - 17) % 4 === 0, `lado ${lado} não corresponde a uma versão de QR`);
  assert.ok(matrizQr.every((linha) => linha.length === lado));
  for (const [r, c] of [[0, 0], [0, lado - 7], [lado - 7, 0]]) {
    assert.equal(matrizQr[r][c], true, 'borda do finder pattern');
    assert.equal(matrizQr[r + 1][c + 1], false, 'anel branco do finder pattern');
    assert.equal(matrizQr[r + 3][c + 3], true, 'miolo do finder pattern');
  }

  const itemSeguro = calcularPosologiaItem({
    regra: localizarRegraBulario('amoxicilina-clavulanato')!,
    paciente: { especie: 'canina', peso_kg: 10 },
  });

  const hash = await calcularHashSha256Prescricao({
    codigo,
    veterinarioCrmv: 'CRMV-PR 12345',
    pacienteNome: 'Thor',
    pesoKg: 10,
    itens: [itemSeguro],
    assinadoEmIso: '2026-10-31T12:00:00.000Z',
  });
  assert.equal(hash.length, 64);

  const html = montarHtmlReceituarioPdf({
    codigoVerificacao: codigo,
    clinicaNome: 'Clínica <img src=x onerror=alert(1)>',
    veterinarioNome: 'Dra. Maria',
    veterinarioCrmv: 'CRMV-PR 12345',
    modalidadeAssinatura: 'icp_brasil_crmv',
    hashSha256: hash,
    assinadoEmIso: '2026-10-31T12:00:00.000Z',
    urlValidacaoPublica: `https://clinica.vet/validar-receita/${codigo}`,
    paciente: {
      tutor_nome: 'Tutor <script>evil()</script>',
      nome: 'Rex',
      especie: 'canina',
      peso_kg: 10,
    },
    itens: [itemSeguro],
    cronograma: gerarGradeCronograma([itemSeguro]),
  });

  assert.ok(!html.includes('<script>evil()'), 'Nenhuma tag script não escapada do usuário entra no HTML');
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'), 'Atributos maliciosos são escapados');
  assert.ok(html.includes(hash));
  assert.ok(html.includes('<svg'));
});
