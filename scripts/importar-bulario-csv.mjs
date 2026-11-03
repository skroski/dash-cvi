#!/usr/bin/env node
// ============================================================================
// CLI: Importador de CSV / Planilhas para o Bulário Veterinário (Supabase)
// Uso:
//   node scripts/importar-bulario-csv.mjs [caminho/arquivo.csv] [--sql]
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

// Carrega variáveis do .env se existir
function carregarEnv() {
  const envPath = path.join(raiz, '.env');
  if (!fs.existsSync(envPath)) return {};
  const linhas = fs.readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const l of linhas) {
    const limpo = l.trim();
    if (!limpo || limpo.startsWith('#')) continue;
    const eqIdx = limpo.indexOf('=');
    if (eqIdx > 0) {
      const k = limpo.slice(0, eqIdx).trim();
      let v = limpo.slice(eqIdx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
    }
  }
  return env;
}

const env = { ...carregarEnv(), ...process.env };
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

// Pega argumentos
const args = process.argv.slice(2);
let arquivoAlvo = args.find((a) => !a.startsWith('--'));
const exportarSql = args.includes('--sql');

if (!arquivoAlvo) {
  arquivoAlvo = path.join(raiz, 'public', 'templates', 'modelo-bulario.csv');
  console.log(`ℹ️ Nenhum arquivo informado. Usando arquivo modelo padrão: ${arquivoAlvo}`);
} else if (!path.isAbsolute(arquivoAlvo)) {
  arquivoAlvo = path.resolve(process.cwd(), arquivoAlvo);
}

if (!fs.existsSync(arquivoAlvo)) {
  console.error(`❌ Arquivo não encontrado: ${arquivoAlvo}`);
  process.exit(1);
}

console.log(`\n📖 Lendo arquivo: ${arquivoAlvo}`);
const conteudo = fs.readFileSync(arquivoAlvo, 'utf8');

// Parser simples e resiliente de CSV
function normalizarChave(chave) {
  return chave
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function gerarSlug(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseLinhasCsv(csv) {
  const textoLimpo = csv.replace(/^\uFEFF/, '');
  const linhas = [];
  let linhaAtual = [];
  let campoAtual = '';
  let dentroDeAspas = false;

  const sep = textoLimpo.indexOf(';') >= 0 ? ';' : ',';

  for (let i = 0; i < textoLimpo.length; i++) {
    const char = textoLimpo[i];
    const proximo = textoLimpo[i + 1];

    if (char === '"') {
      if (dentroDeAspas && proximo === '"') {
        campoAtual += '"';
        i++;
      } else {
        dentroDeAspas = !dentroDeAspas;
      }
    } else if (char === sep && !dentroDeAspas) {
      linhaAtual.push(campoAtual.trim());
      campoAtual = '';
    } else if ((char === '\n' || char === '\r') && !dentroDeAspas) {
      if (char === '\r' && proximo === '\n') i++;
      linhaAtual.push(campoAtual.trim());
      if (linhaAtual.some((c) => c.length > 0)) linhas.push(linhaAtual);
      linhaAtual = [];
      campoAtual = '';
    } else {
      campoAtual += char;
    }
  }

  if (campoAtual.length > 0 || linhaAtual.length > 0) {
    linhaAtual.push(campoAtual.trim());
    if (linhaAtual.some((c) => c.length > 0)) linhas.push(linhaAtual);
  }

  return linhas;
}

const matriz = parseLinhasCsv(conteudo);
if (matriz.length < 2) {
  console.error('❌ O arquivo CSV não possui cabeçalho e dados.');
  process.exit(1);
}

const cabecalhos = matriz[0].map(normalizarChave);
const registros = [];

for (let i = 1; i < matriz.length; i++) {
  const linha = matriz[i];
  const obj = {};
  for (let j = 0; j < cabecalhos.length; j++) {
    obj[cabecalhos[j]] = linha[j] || '';
  }

  const principio = obj.principio_ativo || obj.principio || obj.substancia || obj.nome_comercial_sugerido || '';
  const nomeComercial = obj.nome_comercial_sugerido || obj.nome_comercial || obj.nome || principio;
  if (!principio && !nomeComercial) continue;

  const slug = obj.slug || gerarSlug(`${nomeComercial}-${principio}`);

  let apresentacoes = [];
  if (obj.apresentacoes) {
    try {
      apresentacoes = JSON.parse(obj.apresentacoes);
    } catch {
      apresentacoes = [{ rotulo: nomeComercial, forma: 'comprimido', divisivel: true }];
    }
  } else {
    apresentacoes = [{ rotulo: nomeComercial, forma: 'comprimido', divisivel: true }];
  }

  registros.push({
    slug,
    principio_ativo: principio,
    nome_comercial_sugerido: nomeComercial,
    classe_terapeutica: obj.classe_terapeutica || 'clinica_geral',
    tipo_padrao: obj.tipo_padrao || 'industrializado',
    icone_via: obj.icone_via || 'oral',
    especies_permitidas: obj.especies_permitidas ? obj.especies_permitidas.split(/[,;]/).map((s) => s.trim().toLowerCase()) : ['canina', 'felina'],
    especies_contraindicadas: obj.especies_contraindicadas ? obj.especies_contraindicadas.split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean) : [],
    motivo_contraindicacao_especie: obj.motivo_contraindicacao_especie || null,
    risco_mdr1: ['sim', 'true', '1'].includes(String(obj.risco_mdr1 || '').toLowerCase()),
    mensagem_mdr1: obj.mensagem_mdr1 || null,
    dose_padrao_mg_kg: parseFloat(String(obj.dose_padrao_mg_kg || 1).replace(',', '.')) || 1.0,
    dose_min_mg_kg: parseFloat(String(obj.dose_min_mg_kg || obj.dose_padrao_mg_kg || 1).replace(',', '.')) || 1.0,
    dose_max_mg_kg: parseFloat(String(obj.dose_max_mg_kg || obj.dose_padrao_mg_kg || 1).replace(',', '.')) || 1.0,
    dose_toxica_mg_kg: obj.dose_toxica_mg_kg ? parseFloat(String(obj.dose_toxica_mg_kg).replace(',', '.')) : null,
    dose_felina_max_mg_kg: obj.dose_felina_max_mg_kg ? parseFloat(String(obj.dose_felina_max_mg_kg).replace(',', '.')) : null,
    alerta_felino_especifico: obj.alerta_felino_especifico || null,
    frequencia_horas_padrao: parseInt(obj.frequencia_horas_padrao) || 12,
    duracao_dias_padrao: parseInt(obj.duracao_dias_padrao) || 7,
    condicao_alimentar: obj.condicao_alimentar || 'com_alimento',
    apresentacoes,
    orientacoes_padrao: obj.orientacoes_padrao || 'Administrar conforme prescrição médica veterinária.',
    palavras_chave: obj.palavras_chave ? obj.palavras_chave.split(/[,;]/).map((s) => s.trim().toLowerCase()) : [principio.toLowerCase()],
    ativo: true,
  });
}

console.log(`✅ ${registros.length} medicamentos identificados com sucesso!\n`);

if (exportarSql) {
  const sqlOut = path.join(raiz, 'supabase', 'migrations', `20261102161000_seed_bulario_customizado.sql`);
  let sql = `-- Inserção gerada automaticamente a partir de ${path.basename(arquivoAlvo)}\n`;
  sql += `insert into public.receituario_bulario (\n`;
  sql += `  slug, principio_ativo, nome_comercial_sugerido, classe_terapeutica, tipo_padrao, icone_via,\n`;
  sql += `  especies_permitidas, especies_contraindicadas, motivo_contraindicacao_especie,\n`;
  sql += `  risco_mdr1, mensagem_mdr1, dose_padrao_mg_kg, dose_min_mg_kg, dose_max_mg_kg,\n`;
  sql += `  dose_toxica_mg_kg, dose_felina_max_mg_kg, alerta_felino_especifico, frequencia_horas_padrao,\n`;
  sql += `  duracao_dias_padrao, condicao_alimentar, apresentacoes, orientacoes_padrao, palavras_chave, ativo\n`;
  sql += `) values\n`;

  const valoresSql = registros.map((r) => {
    const esc = (t) => (t === null || t === undefined ? 'null' : `'${String(t).replace(/'/g, "''")}'`);
    const arr = (a) => `array[${a.map((x) => esc(x)).join(', ')}]::text[]`;
    return `(\n  ${esc(r.slug)}, ${esc(r.principio_ativo)}, ${esc(r.nome_comercial_sugerido)}, ${esc(r.classe_terapeutica)}, ${esc(r.tipo_padrao)}, ${esc(r.icone_via)},\n  ${arr(r.especies_permitidas)}, ${arr(r.especies_contraindicadas)}, ${esc(r.motivo_contraindicacao_especie)},\n  ${r.risco_mdr1}, ${esc(r.mensagem_mdr1)}, ${r.dose_padrao_mg_kg}, ${r.dose_min_mg_kg}, ${r.dose_max_mg_kg},\n  ${r.dose_toxica_mg_kg ?? 'null'}, ${r.dose_felina_max_mg_kg ?? 'null'}, ${esc(r.alerta_felino_especifico)}, ${r.frequencia_horas_padrao},\n  ${r.duracao_dias_padrao}, ${esc(r.condicao_alimentar)}, '${JSON.stringify(r.apresentacoes).replace(/'/g, "''")}'::jsonb, ${esc(r.orientacoes_padrao)}, ${arr(r.palavras_chave)}, true\n)`;
  });

  sql += valoresSql.join(',\n');
  sql += `\non conflict (slug) do update set\n`;
  sql += `  principio_ativo = excluded.principio_ativo,\n  nome_comercial_sugerido = excluded.nome_comercial_sugerido,\n  dose_padrao_mg_kg = excluded.dose_padrao_mg_kg,\n  apresentacoes = excluded.apresentacoes;\n`;

  fs.writeFileSync(sqlOut, sql, 'utf8');
  console.log(`💾 Migration SQL gerada em: ${sqlOut}`);
} else if (supabaseUrl && supabaseKey) {
  console.log(`🚀 Enviando registros para o Supabase (${supabaseUrl})...`);
  const endpoint = `${supabaseUrl}/rest/v1/receituario_bulario?on_conflict=slug`;

  fetch(endpoint, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(registros),
  })
    .then(async (res) => {
      if (res.ok) {
        const dados = await res.json();
        console.log(`🎉 Sucesso! ${Array.isArray(dados) ? dados.length : registros.length} medicamentos gravados no Supabase.`);
      } else {
        const errText = await res.text();
        console.error(`⚠️ Erro na API REST do Supabase: ${res.status} - ${errText}`);
        console.log(`💡 Dica: você também pode rodar com "--sql" para gerar uma migration: node scripts/importar-bulario-csv.mjs ${args[0] || ''} --sql`);
      }
    })
    .catch((err) => {
      console.error(`⚠️ Falha na conexão de rede: ${err.message}`);
    });
} else {
  console.log('ℹ️ Credenciais Supabase não configuradas no ambiente.');
  console.log('💡 Use o painel na rota "/bulario" para importar visualmente ou execute com "--sql" para gerar um script SQL.');
}

