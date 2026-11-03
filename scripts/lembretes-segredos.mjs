#!/usr/bin/env node
// lembretes-segredos.mjs: valida as chaves do módulo de lembretes no .env e,
// quando pedido, publica no Supabase. Nunca imprime valores de segredos.
//
//   node scripts/lembretes-segredos.mjs            confere o .env (nada é enviado)
//   node scripts/lembretes-segredos.mjs --enviar   confere e roda `supabase secrets set`
//   node scripts/lembretes-segredos.mjs --sql      grava o SQL de ativação do cron
//                                                  (supabase/.temp, fora do git)
//
//   --arquivo <caminho>   usa outro arquivo em vez de .env
//   --projeto <ref>       usa outro ref em vez do project_id do supabase/config.toml
//
// O SQL gerado NÃO é executado aqui. Rodar a ativação do cron é o cutover e
// precisa de autorização explícita (veja docs/lembretes-implantacao.md).
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : undefined);
const arquivoPadrao = existsSync('.env') ? '.env' : existsSync('.env.local') ? '.env.local' : '.env';
const arquivo = resolve(opt('--arquivo') ?? arquivoPadrao);
const enviar = argv.includes('--enviar');
const gerarSql = argv.includes('--sql');

const OBRIGATORIAS = ['OPENAI_API_KEY', 'UAZAPI_SERVER_URL', 'UAZAPI_INSTANCE_TOKEN', 'LEMBRETES_CRON_SECRET'];
const falha = (m) => { console.error(`✗ ${m}`); process.exit(1); };

if (!existsSync(arquivo)) {
  falha(`${arquivo} não existe. Copie o bloco de .env.example para o .env e preencha.`);
}

function aplicarFallbacks(env) {
  if (!env.UAZAPI_SERVER_URL && (env.VITE_UAZAPI_SERVER_URL || env.NEXT_PUBLIC_UAZAPI_SERVER_URL)) {
    env.UAZAPI_SERVER_URL = (env.VITE_UAZAPI_SERVER_URL || env.NEXT_PUBLIC_UAZAPI_SERVER_URL).trim();
  }
  if (!env.UAZAPI_INSTANCE_TOKEN && (env.VITE_UAZAPI_INSTANCE_TOKEN || env.NEXT_PUBLIC_UAZAPI_INSTANCE_TOKEN)) {
    env.UAZAPI_INSTANCE_TOKEN = (env.VITE_UAZAPI_INSTANCE_TOKEN || env.NEXT_PUBLIC_UAZAPI_INSTANCE_TOKEN).trim();
  }
  return env;
}

function ler(texto) {
  const out = {};
  for (const linha of texto.split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

let texto = readFileSync(arquivo, 'utf8');
let env = aplicarFallbacks(ler(texto));

// Reutiliza credenciais da UAZAPI existentes no front (.env ou .env.local) se não definidas
if (!env.UAZAPI_SERVER_URL && (env.VITE_UAZAPI_SERVER_URL || env.NEXT_PUBLIC_UAZAPI_SERVER_URL)) {
  env.UAZAPI_SERVER_URL = (env.VITE_UAZAPI_SERVER_URL || env.NEXT_PUBLIC_UAZAPI_SERVER_URL).trim();
}
if (!env.UAZAPI_INSTANCE_TOKEN && (env.VITE_UAZAPI_INSTANCE_TOKEN || env.NEXT_PUBLIC_UAZAPI_INSTANCE_TOKEN)) {
  env.UAZAPI_INSTANCE_TOKEN = (env.VITE_UAZAPI_INSTANCE_TOKEN || env.NEXT_PUBLIC_UAZAPI_INSTANCE_TOKEN).trim();
}

// Segredo do agendador: gera se estiver vazio.
if (!env.LEMBRETES_CRON_SECRET) {
  const novo = randomBytes(32).toString('hex');
  if (/^\s*LEMBRETES_CRON_SECRET\s*=.*$/m.test(texto)) {
    texto = texto.replace(/^\s*LEMBRETES_CRON_SECRET\s*=.*$/m, `LEMBRETES_CRON_SECRET=${novo}`);
  } else {
    texto = `${texto.replace(/\s*$/, '')}\nLEMBRETES_CRON_SECRET=${novo}\n`;
  }
  writeFileSync(arquivo, texto);
  env = aplicarFallbacks(ler(texto));
  console.log('• LEMBRETES_CRON_SECRET estava vazio: gerei um valor aleatório e gravei no arquivo.');
}

const problemas = [];
for (const chave of OBRIGATORIAS) {
  if (!env[chave]) problemas.push(`${chave} está vazia`);
}
if (env.UAZAPI_SERVER_URL && !/^https:\/\/[^/\s]+/i.test(env.UAZAPI_SERVER_URL)) {
  problemas.push('UAZAPI_SERVER_URL deve começar com https://');
}
if (env.OPENAI_API_KEY && !/^sk-/.test(env.OPENAI_API_KEY)) {
  problemas.push('OPENAI_API_KEY não parece uma chave da OpenAI (começa com sk-)');
}
const avisos = [];
for (const k of Object.keys(env)) {
  if (k.startsWith('VITE_') && /OPENAI|UAZAPI|CRON_SECRET/.test(k)) {
    avisos.push(`${k}: variável VITE_ vai para o bundle do front (público). O módulo de lembretes não a usa; as chaves dele são as sem VITE_.`);
  }
}

console.log(`\nArquivo: ${arquivo}`);
for (const chave of OBRIGATORIAS) console.log(`  ${env[chave] ? '✓' : '✗'} ${chave}${env[chave] ? '' : ' (vazia)'}`);
for (const a of avisos) console.warn(`  ! ${a}`);
if (problemas.length) {
  console.error('\nCorrija antes de continuar:');
  for (const p of problemas) console.error(`  - ${p}`);
  process.exit(1);
}

function refDoProjeto() {
  const manual = opt('--projeto');
  if (manual) return manual;
  const toml = resolve('supabase/config.toml');
  if (!existsSync(toml)) falha('Não achei supabase/config.toml. Use --projeto <ref>.');
  const m = readFileSync(toml, 'utf8').match(/^\s*project_id\s*=\s*"([^"]+)"/m);
  if (!m) falha('project_id ausente no supabase/config.toml. Use --projeto <ref>.');
  return m[1];
}

if (enviar) {
  const ref = refDoProjeto();
  console.log(`\nPublicando segredos no projeto ${ref} (os valores não são exibidos)...`);
  const pasta = mkdtempSync(join(tmpdir(), 'lembretes-env-'));
  const tmp = join(pasta, 'segredos.env');
  try {
    writeFileSync(tmp, OBRIGATORIAS.map((k) => `${k}=${env[k]}`).join('\n') + '\n', { mode: 0o600 });
    chmodSync(tmp, 0o600);
    const r = spawnSync('supabase', ['secrets', 'set', '--project-ref', ref, '--env-file', tmp], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (r.status !== 0) falha('supabase secrets set falhou. Confira `supabase login` e o ref do projeto.');
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
  console.log('✓ Segredos publicados. Confira com: supabase secrets list --project-ref ' + ref);
}

if (gerarSql) {
  const ref = refDoProjeto();
  const modelo = resolve('supabase/scripts/lembretes_ativar_cron.sql');
  if (!existsSync(modelo)) falha(`Não achei ${modelo}.`);
  const sql = readFileSync(modelo, 'utf8')
    .replace(/https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/lembretes/, `https://${ref}.supabase.co/functions/v1/lembretes`)
    .replace("'<SEGREDO>'", `'${env.LEMBRETES_CRON_SECRET.replace(/'/g, "''")}'`);
  const destino = resolve('supabase/.temp/lembretes_ativar_cron.gerado.sql');
  mkdirSync(resolve('supabase/.temp'), { recursive: true });
  writeFileSync(destino, sql, { mode: 0o600 });
  console.log(`\n✓ SQL de ativação gravado em ${destino}`);
  console.log('  Contém o segredo. NÃO versione nem compartilhe. Só rode no cutover, com autorização.');
}

if (!enviar && !gerarSql) console.log('\nTudo certo. Use --enviar para publicar no Supabase, ou --sql para gerar o SQL do cron.');
