/**
 * Ponto único de leitura de tokens e chaves das edge functions.
 *
 * Onde cada coisa mora (e onde trocar):
 *  - Chave da OpenAI ........ Vault (painel: card "Chave OpenAI"); OPENAI_API_KEY é só reserva.
 *  - Demais segredos ........ Supabase Edge Function Secrets (`supabase secrets set NOME=valor`
 *                             ou `node scripts/segredos.mjs --enviar`). Lista completa em SEGREDOS.
 *  - SUPABASE_URL / SERVICE_ROLE ... injetados pelo próprio Supabase.
 *
 * Nenhuma function deve chamar Deno.env.get() para um segredo diretamente: use segredo()
 * ou obterOpenAiKey(). Assim, adicionar um fallback ou rotacionar é mexer num arquivo só.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

/** Registro de todos os segredos conhecidos (usado por scripts/segredos.mjs e pelo .env.example). */
export const SEGREDOS = [
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'UAZAPI_SERVER_URL',
  'UAZAPI_INSTANCE_TOKEN',
  'UAZAPI_WEBHOOK_SECRET',
  'ATENDIMENTO_INTERNAL_SECRET',
  'ATENDIMENTO_SEND_ENABLED',
  'LEMBRETES_CRON_SECRET',
  'LEMBRETES_CRON_SECRET_ANTERIOR',
  'AGENDA_CRON_SECRET',
  'GOOGLE_SERVICE_ACCOUNT_KEY',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_CALENDAR_ACCESS_TOKEN',
  'GOOGLE_CALENDAR_REFRESH_TOKEN',
  'GOOGLE_DRIVE_ACCESS_TOKEN',
  'GOOGLE_DRIVE_REFRESH_TOKEN',
  'GOOGLE_FORMS_WEBHOOK_SECRET',
  'MAIA_OPENAI_MODEL',
  'MAIA_SYSTEM_PROMPT',
] as const;

export type NomeSegredo = (typeof SEGREDOS)[number];

/** Lê um segredo dos Edge Function Secrets. Retorna undefined se ausente ou vazio. */
export function segredo(nome: NomeSegredo | string): string | undefined {
  const bruto = Deno.env.get(nome);
  if (!bruto || !bruto.trim()) return undefined;
  // Prompts mantêm a formatação; tokens e chaves perdem espaço/quebra de linha sobrando.
  return nome === 'MAIA_SYSTEM_PROMPT' ? bruto : bruto.trim();
}

let cacheOpenAi: { chave: string; ate: number } | null = null;

/**
 * Chave da OpenAI: Vault primeiro (é a que o painel troca), OPENAI_API_KEY como reserva.
 * Aceita um client admin já criado; sem ele, cria um a partir das variáveis do Supabase.
 */
export async function obterOpenAiKey(admin?: { rpc: (fn: string) => PromiseLike<unknown> }) {
  if (cacheOpenAi && cacheOpenAi.ate > Date.now()) return cacheOpenAi.chave;

  let cliente = admin;
  if (!cliente) {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (url && serviceRole) {
      cliente = createClient(url, serviceRole, { auth: { persistSession: false } });
    }
  }

  let chave: string | undefined;
  if (cliente) {
    try {
      const { data } = (await cliente.rpc('obter_openai_key_interna')) as { data: unknown };
      if (typeof data === 'string' && data.trim()) chave = data.trim();
    } catch {
      // Vault indisponível: cai para a variável de ambiente.
    }
  }
  chave ??= segredo('OPENAI_API_KEY');

  if (chave) cacheOpenAi = { chave, ate: Date.now() + 15_000 };
  return chave;
}
