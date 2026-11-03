// Leitura autenticada do novo histórico de atendimento. O browser não acessa
// tabelas de fila diretamente: RLS mantém conteúdo e metadados operacionais
// privados e esta função devolve só o necessário para o painel.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function texto(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function numero(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(0, Math.min(parsed, max)) : fallback;
}

function sessionCanonica(input: unknown): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (raw.includes('@')) return raw;
  const digits = raw.replace(/\D/g, '');
  return digits ? `${digits}@s.whatsapp.net` : raw;
}

async function usuarioAutenticado(request: Request, admin: SupabaseClient) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return null;
  const { data, error } = await admin.auth.getUser(bearer);
  if (error || !data.user) return null;
  const { data: profile } = await admin.from('profiles').select('papel,ativo').eq('id', data.user.id).maybeSingle();
  if (!profile?.ativo || !['admin', 'lider', 'atendente', 'veterinario'].includes(profile.papel)) return null;
  return data.user;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRole) return json({ error: 'service_unavailable' }, 503);
  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!(await usuarioAutenticado(request, admin))) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const action = texto(body.action, 30);
  try {
    if (action === 'conversas') {
      const { data, error } = await admin.rpc('atendimento_listar_conversas', {
        p_busca: texto(body.search, 100) || null,
        p_limite: numero(body.limit, 200, 300),
        p_offset: numero(body.offset, 0, 50_000),
      });
      if (error) throw new Error('conversations_load_failed');
      return json({ conversations: data || [] });
    }
    if (action === 'mensagens') {
      const rawSession = texto(body.session_id, 255);
      if (!rawSession) return json({ error: 'invalid_session' }, 400);
      const canonicalSession = sessionCanonica(rawSession);

      let { data, error } = await admin.rpc('atendimento_listar_mensagens', {
        p_session_id: canonicalSession,
        p_limite: numero(body.limit, 100, 300),
      });

      if (!error && (!data || (Array.isArray(data) && data.length === 0)) && rawSession !== canonicalSession) {
        const fallback = await admin.rpc('atendimento_listar_mensagens', {
          p_session_id: rawSession,
          p_limite: numero(body.limit, 100, 300),
        });
        if (!fallback.error && fallback.data && fallback.data.length > 0) {
          data = fallback.data;
        }
      }

      if (error) throw new Error('messages_load_failed');
      return json({ messages: data || [] });
    }
    return json({ error: 'unsupported_action' }, 400);
  } catch (error) {
    console.error('atendimento_painel_error', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'panel_query_failed' }, 500);
  }
});
