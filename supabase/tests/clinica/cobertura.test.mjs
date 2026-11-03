// Garante que NADA do prompt original ficou sem destino: as 94 regras estão na tabela de cobertura e todo
// código de regra citado existe na migração genérica ou na semente da Clínica VetBots.
//   node --test supabase/tests/clinica/cobertura.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');
const doc = ler('docs/prompt-n8n-cobertura.md');
const seed = ler('supabase/seeds/clinica-vetbots.sql');
const migracao = ler('supabase/migrations/20261027100000_clinica_configuracao_prompt.sql');

const linhasRegras = doc.split('\n').filter((l) => /^\| \d+ \|/.test(l));

test('todas as regras 1–94 estão na tabela de cobertura, com destino e tipo', () => {
  const numeros = linhasRegras.map((l) => Number(l.split('|')[1]));
  assert.deepEqual(numeros, Array.from({ length: 94 }, (_, i) => i + 1));
  for (const linha of linhasRegras) {
    const [, n, destino, tipo] = linha.split('|').map((c) => c.trim());
    assert.ok(destino.length > 2 && tipo.length > 1, `regra ${n} sem destino/tipo`);
  }
});

test('regra descartada ou vazia sempre explica o porquê', () => {
  for (const linha of linhasRegras) {
    const colunas = linha.split('|').map((c) => c.trim());
    if (/descartada|n\/a/.test(colunas[3])) assert.ok(colunas[4].length > 20, `regra ${colunas[1]} sem justificativa`);
  }
});

test('todo código de regra citado existe na migração genérica ou na semente', () => {
  const codigos = new Set([...doc.matchAll(/`((?:vb_)?[a-z][a-z0-9_]+)`/g)].map((m) => m[1]));
  const usados = [...codigos].filter((c) => /^vb_[a-z]/.test(c) || [
    'saudacao_inicial', 'coleta_uma_por_vez', 'identidade_e_objetivo', 'ferramentas_disponiveis', 'servicos_e_valores', 'reagendamento_cancelamento',
    'coleta_dados_agendamento', 'comunicacao_sem_termos_tecnicos', 'encaminhamento_humano', 'formatacao_whatsapp', 'sintomas_graves_emergencia',
    'datas_e_horarios_futuros', 'escopo_e_seguranca', 'consulta_disponibilidade_agenda', 'agendamento_imediato', 'proibicao_mensagens_espera',
    'encerramento_atendimento', 'informacoes_da_empresa',
  ].includes(c));
  assert.ok(usados.length > 40);
  for (const codigo of usados) {
    assert.ok(seed.includes(`$r$${codigo}$r$`) || migracao.includes(`'${codigo}'`), `código inexistente: ${codigo}`);
  }
});

test('todo serviço do catálogo citado existe na semente', () => {
  for (const m of doc.matchAll(/serviço `([a-z0-9_]+)`/g)) {
    assert.ok(seed.includes(`('${m[1]}',`), `serviço inexistente: ${m[1]}`);
  }
});

test('as decisões pendentes estão listadas para a clínica', () => {
  assert.match(doc, /## Decisões que dependem da clínica/);
  for (const tema of ['Oncologia e gastro', 'Pets por agendamento', 'Almoço', 'Telefone fixo', 'Pergunta de horário']) assert.match(doc, new RegExp(tema));
});
