#!/usr/bin/env node
// segredos.mjs: confere o .env contra o registro SEGREDOS das edge functions
// (supabase/functions/_shared/segredos.ts) e, com --enviar, publica no Supabase.
// Nunca imprime valores.
//
//   node scripts/segredos.mjs            lista o que está preenchido / faltando
//   node scripts/segredos.mjs --enviar   roda `supabase secrets set` para os preenchidos
//   --arquivo <caminho>  --projeto <ref>
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : undefined);
const arquivo = resolve(opt('--arquivo') ?? (existsSync('.env') ? '.env' : '.env.local'));
if (!existsSync(arquivo)) { console.error(`✗ ${arquivo} não existe (copie de .env.example).`); process.exit(1); }

const fonte = readFileSync('supabase/functions/_shared/segredos.ts', 'utf8');
const bloco = fonte.match(/SEGREDOS = \[([\s\S]*?)\] as const/)?.[1] ?? '';
const nomes = [...bloco.matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1]);

const env = {};
for (const linha of readFileSync(arquivo, 'utf8').split('\n')) {
  const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}

const preenchidos = nomes.filter((n) => env[n]);
for (const n of nomes) console.log(`${env[n] ? '✓' : '·'} ${n}`);
if (!argv.includes('--enviar')) process.exit(0);

const ref = opt('--projeto') ?? readFileSync('supabase/config.toml', 'utf8').match(/project_id\s*=\s*"([^"]+)"/)?.[1];
if (!ref) { console.error('✗ project_id não encontrado.'); process.exit(1); }
console.log(`\nEnviando ${preenchidos.length} segredo(s) para o projeto ${ref}...`);
const r = spawnSync('supabase', ['secrets', 'set', '--project-ref', ref, ...preenchidos.map((n) => `${n}=${env[n]}`)], { stdio: ['ignore', 'ignore', 'inherit'] });
process.exit(r.status ?? 1);
