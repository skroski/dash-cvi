// Controles operacionais de pausa do bot, substituindo chaves Redis *_block.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function normalizarSessionId(input: string) {
  const trimmed = input.trim();
  if (trimmed.includes('@')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return digits ? `${digits}@s.whatsapp.net` : '';
}

async function autenticar(request: Request, admin: ReturnType<typeof createClient>) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return null;
  const { data, error } = await admin.auth.getUser(bearer);
  if (error || !data.user) return null;
  const { data: profile } = await admin.from('profiles').select('papel, ativo').eq('id', data.user.id).maybeSingle();
  if (!profile?.ativo || !['admin', 'lider', 'atendente'].includes(profile.papel)) return null;
  return data.user;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRole) return json({ error: 'service_unavailable' }, 500);
  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const user = await autenticar(request, admin);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: { action?: string; sessionId?: string; durationSeconds?: number | null };
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  if (body.action === 'listar') {
    const { data, error } = await admin
      .from('atendimento_pausas')
      .select('session_id, expira_em')
      .is('encerrado_em', null)
      .gt('expira_em', new Date().toISOString());
    if (error) return json({ error: 'pause_list_failed' }, 500);
    return json({ pauses: data || [] });
  }

  if (body.action === 'listar_bloqueios') {
    const { data, error } = await admin.rpc('obter_bloqueios_atendimento');
    if (error) return json({ error: 'blacklist_list_failed' }, 500);
    return json({ bloqueios: data || [] });
  }

  const sessionId = normalizarSessionId(String(body.sessionId || ''));
  if (!sessionId) return json({ error: 'invalid_session' }, 400);

  if (body.action === 'bloquear') {
    const telefone = sessionId.split('@')[0];
    const { data, error } = await admin.rpc('bloquear_telefone_atendimento', {
      p_telefone: telefone,
      p_motivo: (body as Record<string, unknown>).motivo || 'operadora_ou_spam',
      p_observacao: (body as Record<string, unknown>).observacao || null,
    });
    if (error) return json({ error: 'block_failed' }, 500);
    return json({ ok: true, data });
  }

  if (body.action === 'desbloquear') {
    const telefone = sessionId.split('@')[0];
    const { data, error } = await admin.rpc('desbloquear_telefone_atendimento', {
      p_telefone: telefone,
    });
    if (error) return json({ error: 'unblock_failed' }, 500);
    return json({ ok: true, data });
  }

  if (body.action === 'retomar') {
    const { error } = await admin
      .from('atendimento_pausas')
      .update({ encerrado_em: new Date().toISOString() })
      .eq('session_id', sessionId)
      .is('encerrado_em', null);
    if (error) return json({ error: 'pause_update_failed' }, 500);
    return json({ ok: true });
  }

  if (body.action !== 'pausar') return json({ error: 'invalid_action' }, 400);
  const duration = Number(body.durationSeconds);
  // A pausa manual substitui a janela de 8 h usada no workflow n8n.
  const seconds = Number.isFinite(duration) && duration >= 60 && duration <= 7 * 86_400
    ? Math.floor(duration)
    : 8 * 60 * 60;
  const expiresAt = new Date(Date.now() + seconds * 1000).toISOString();

  const { error: conversationError } = await admin
    .from('atendimento_conversas')
    .upsert({ session_id: sessionId, atualizado_em: new Date().toISOString() }, { onConflict: 'session_id' });
  if (conversationError) return json({ error: 'conversation_upsert_failed' }, 500);

  const { error } = await admin.rpc('atendimento_definir_pausa', {
    p_session_id: sessionId,
    p_expira_em: expiresAt,
    p_criado_por: user.id,
    p_motivo: 'atendimento_humano',
  });
  if (error) return json({ error: 'pause_create_failed' }, 500);
  return json({ ok: true, expiraEm: expiresAt });
});
