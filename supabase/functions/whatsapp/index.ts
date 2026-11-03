// Proxy autenticado para a UAZAPI. Credenciais nunca chegam ao navegador.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { segredo } from '../_shared/segredos.ts';

type Metodo = 'GET' | 'POST';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const allowedRequests = new Set([
  'GET /instance/status',
  'POST /instance/connect',
  'POST /instance/disconnect',
  'GET /quickreply/showall',
  'POST /group/list',
  'POST /group/info',
  'POST /message/find',
  'POST /chat/details',
  'POST /send/text',
  'POST /send/menu',
  'POST /send/media',
]);

// Gestão do número (conectar, desconectar, ler conversas) fica com a recepção e a gestão.
const PAPEIS_EQUIPE = ['admin', 'lider', 'atendente'];
// Veterinário só envia (ex.: receita e horários para o tutor pelo receituário).
const OPERACOES_VETERINARIO = new Set(['POST /send/text', 'POST /send/media']);

async function usuarioAutenticado(request: Request, admin: SupabaseClient) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return null;
  const { data, error } = await admin.auth.getUser(bearer);
  if (error || !data.user) return null;

  const { data: profile } = await admin
    .from('profiles')
    .select('papel, ativo')
    .eq('id', data.user.id)
    .maybeSingle();
  const papel = String(profile?.papel ?? '');
  if (!profile?.ativo || ![...PAPEIS_EQUIPE, 'veterinario'].includes(papel)) return null;
  return { user: data.user, papel };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const base = segredo('UAZAPI_SERVER_URL')?.replace(/\/$/, '');
  const token = segredo('UAZAPI_INSTANCE_TOKEN');
  if (!url || !serviceRole || !base || !token) return json({ error: 'whatsapp_not_configured' }, 503);

  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const sessao = await usuarioAutenticado(request, admin);
  if (!sessao) return json({ error: 'unauthorized' }, 401);

  let input: { method?: Metodo; path?: string; body?: unknown };
  try {
    input = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const method = input.method === 'GET' ? 'GET' : input.method === 'POST' ? 'POST' : null;
  const path = typeof input.path === 'string' ? input.path : '';
  const operacao = `${method} ${path}`;
  if (!method || !allowedRequests.has(operacao)) return json({ error: 'unsupported_operation' }, 400);
  if (!PAPEIS_EQUIPE.includes(sessao.papel) && !OPERACOES_VETERINARIO.has(operacao)) {
    return json({ error: 'forbidden' }, 403);
  }

  try {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: method === 'POST'
        ? { 'Content-Type': 'application/json', token }
        : { Accept: 'application/json', token },
      body: method === 'POST' ? JSON.stringify(input.body ?? {}) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await response.text();
    let data: unknown = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = { raw: raw.slice(0, 500) }; }
    if (!response.ok) return json({ error: 'whatsapp_provider_error', status: response.status, data }, 502);
    return json({ data });
  } catch (error) {
    const code = error instanceof DOMException && error.name === 'TimeoutError'
      ? 'whatsapp_timeout'
      : 'whatsapp_unavailable';
    console.error('whatsapp_proxy_error', code);
    return json({ error: code }, 502);
  }
});
