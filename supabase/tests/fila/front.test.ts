// Funções puras do front da fila: escala de cores da marca e cupom térmico.
//   node --experimental-strip-types --test supabase/tests/fila/front.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { CORES_PRONTAS_FILA, contraste, escalaDaCor, estiloMarca, TONS_FILA } from '../../../src/lib/filaCores.ts';
import { montarHtmlCupom } from '../../../src/lib/filaCupom.ts';

const FUNDO_TV: [number, number, number] = [15, 23, 42];

test('toda cor pronta gera texto legível na TV (300/400 sobre fundo escuro) e botão com texto branco (600)', () => {
  for (const { hex, nome } of CORES_PRONTAS_FILA) {
    const escala = escalaDaCor(hex);
    assert.ok(contraste(escala[300], FUNDO_TV) >= 4.5, `${nome}: fila-300`);
    assert.ok(contraste(escala[400], FUNDO_TV) >= 4.5, `${nome}: fila-400`);
    assert.ok(contraste(escala[600], [255, 255, 255]) >= 3.5, `${nome}: fila-600 com texto branco`);
  }
});

test('cores extremas (branco, preto, amarelo) também ficam dentro dos limites de contraste', () => {
  for (const hex of ['#ffffff', '#000000', '#ffee00']) {
    const escala = escalaDaCor(hex);
    assert.ok(contraste(escala[400], FUNDO_TV) >= 4.5, hex);
    assert.ok(contraste(escala[600], [255, 255, 255]) >= 3.5, hex);
  }
});

test('a escala escurece sempre de 600 para 900 e o estilo traz as 10 variáveis em "r g b"', () => {
  const escala = escalaDaCor('#2294aa');
  const brilho = (c: number[]) => c[0] + c[1] + c[2];
  assert.ok(brilho(escala[600]) > brilho(escala[700]) && brilho(escala[700]) > brilho(escala[800]) && brilho(escala[800]) > brilho(escala[900]));
  const estilo = estiloMarca('#2294aa') as Record<string, string>;
  assert.equal(Object.keys(estilo).length, TONS_FILA.length);
  assert.match(estilo['--fila-500'], /^\d+ \d+ \d+$/);
  assert.equal(estilo['--fila-500'], '34 148 170');
});

test('cor inválida cai na cor padrão em vez de gerar NaN', () => {
  assert.deepEqual(escalaDaCor('vermelho')[500], escalaDaCor('#2294aa')[500]);
});

test('cupom: nomes com HTML são escapados e a largura segue 58/80 mm', () => {
  const html = montarHtmlCupom({
    clinica: 'Clínica <b>X</b>', senha: 'A014', servico: 'Consulta', tutor: 'Carlos <script>alert(1)</script> & Filhos',
    pet: `Thor "o" 'bravo'`, prioridade: 'NORMAL', larguraMm: 80, rodape: 'Obrigado <3',
  });
  assert.ok(!html.includes('<script>alert'), 'sem script injetado');
  assert.ok(html.includes('Carlos &lt;script&gt;alert(1)&lt;/script&gt; &amp; Filhos'));
  assert.ok(html.includes('Clínica &lt;b&gt;X&lt;/b&gt;'));
  assert.ok(html.includes('Obrigado &lt;3'));
  assert.ok(html.includes('width: 80mm'));
  assert.ok(montarHtmlCupom({ clinica: 'X', senha: 'A1', servico: 'S', tutor: 'T', prioridade: 'NORMAL', larguraMm: 99 }).includes('width: 58mm'), 'largura inválida volta para 58 mm');
});

test('cupom: logotipo e pet só aparecem quando informados', () => {
  const sem = montarHtmlCupom({ clinica: 'X', senha: 'A1', servico: 'S', tutor: 'T', prioridade: 'NORMAL' });
  assert.ok(!sem.includes('<img class="logo"') && !sem.includes('Pet:'));
  const com = montarHtmlCupom({ clinica: 'X', senha: 'A1', servico: 'S', tutor: 'T', pet: 'Rex', logoUrl: 'https://x/logo.png', prioridade: 'NORMAL' });
  assert.ok(com.includes('<img class="logo" src="https://x/logo.png"') && com.includes('Pet:</strong> Rex'));
});
